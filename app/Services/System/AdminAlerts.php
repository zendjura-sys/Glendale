<?php

namespace App\Services\System;

use App\Models\MessageReport;
use App\Models\PaymentOrder;
use App\Models\UserReport;
use App\Services\Alerts\UkraineAlarm;
use App\Services\Bots\TelegramApi;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Алерти адміністраторам у Telegram через офіційного бота GameCon.
 * Чат (особистий, група чи канал) і типи подій задаються в «Інтеграції → Бот Telegram».
 * Кожен алерт має ключ дедуплікації, а загальний ліміт не дає засипати чат під час збою.
 */
class AdminAlerts
{
    /** Типи алертів: ключ налаштування → підпис у адмінці. */
    public const KINDS = [
        'errors' => 'Нові помилки сайту',
        'health' => 'Збої: черга задач, пуші, тривоги',
        'payments' => 'Невдалі платежі',
        'reports' => 'Скарги в черзі модерації',
    ];

    /** Не більше стількох повідомлень на годину, решта — в лог. */
    public const HOURLY_LIMIT = 30;

    public function __construct(private readonly SiteSettings $settings, private readonly TelegramApi $telegram) {}

    public function chat(): ?string
    {
        $chat = $this->settings->get('admin_alert_chat');

        return is_string($chat) && preg_match('/^(-?\d{5,20}|@[A-Za-z0-9_]{5,64})$/', trim($chat)) ? trim($chat) : null;
    }

    public function enabled(string $kind): bool
    {
        return $this->chat() !== null && $this->telegram->token() !== null
            && $this->settings->get('admin_alert_'.$kind, true) !== false;
    }

    /**
     * Надсилає алерт, якщо тип увімкнено й такий самий не надсилався протягом $ttl секунд.
     */
    public function send(string $kind, string $title, string $body = '', ?string $dedupe = null, int $ttl = 1800, ?string $link = null): bool
    {
        if (! $this->enabled($kind)) {
            return false;
        }
        if ($dedupe !== null && ! Cache::add('admin_alert:'.sha1($kind.'|'.$dedupe), 1, $ttl)) {
            return false;
        }
        $hour = 'admin_alert:hour:'.now()->format('YmdH');
        Cache::add($hour, 0, 3700);
        if (Cache::increment($hour) > self::HOURLY_LIMIT) {
            Log::warning('admin_alerts.throttled', ['kind' => $kind, 'title' => $title]);

            return false;
        }

        $chat = (string) $this->chat();
        $text = '<b>'.e($title).'</b>'.($body !== '' ? "\n".e(Str::limit($body, 3000)) : '')
            .($link !== null ? "\n".'<a href="'.e($link).'">Відкрити в адмінці</a>' : '');

        // Окремою задачею: алерт не має гальмувати запит, у якому стався збій.
        dispatch(function () use ($chat, $text) {
            app(TelegramApi::class)->call('sendMessage', [
                'chat_id' => $chat,
                'text' => $text,
                'parse_mode' => 'HTML',
                'disable_web_page_preview' => true,
            ]);
        });

        return true;
    }

    /** Перевірка з адмінки: надсилає тестове повідомлення одразу. */
    public function test(): bool
    {
        $chat = $this->chat();
        if ($chat === null) {
            return false;
        }

        return $this->telegram->call('sendMessage', [
            'chat_id' => $chat,
            'text' => '✅ GameCon: алерти адміністраторам працюють. Сюди приходитимуть збої, помилки, невдалі платежі й скарги.',
        ]) !== null;
    }

    /** Нова група в журналі помилок. */
    public function newError(string $class, string $message, string $file, int $line, string $url): void
    {
        rescue(fn () => $this->send(
            'errors',
            '🔴 Нова помилка: '.class_basename($class),
            Str::limit($message, 500)."\n{$file}:{$line}\n{$url}",
            dedupe: $class.'|'.$file.'|'.$line,
            ttl: 3600,
            link: url('/admin/system'),
        ), report: false);
    }

    public function paymentFailed(PaymentOrder $order, string $reason): void
    {
        rescue(fn () => $this->send(
            'payments',
            '💳 Невдалий платіж #'.$order->id,
            "Продукт: {$order->product} · ".number_format($order->price / 100, 2, ',', ' ')." грн\nПричина: {$reason}",
            dedupe: 'order:'.$order->id,
            ttl: 86400,
        ), report: false);
    }

    /**
     * Планова перевірка здоров'я (кожні 10 хв): нові провалені задачі, сплеск невдалих пушів,
     * завислий опитувач тривог, нові скарги. Кожна подія — раз на свій інтервал.
     */
    public function health(): void
    {
        if ($this->chat() === null) {
            return;
        }

        // Провалені задачі черги — лише нові з минулої перевірки.
        if (Schema::hasTable('failed_jobs')) {
            $lastId = (int) Cache::get('admin_alert:failed_job_id', 0);
            $fresh = DB::table('failed_jobs')->where('id', '>', $lastId)->orderBy('id')->get(['id', 'payload', 'exception']);
            if ($fresh->isNotEmpty()) {
                Cache::forever('admin_alert:failed_job_id', (int) $fresh->last()->id);
                if ($lastId > 0) {
                    $names = $fresh->map(fn ($row) => (string) (json_decode((string) $row->payload, true)['displayName'] ?? '?'))
                        ->countBy()->map(fn ($n, $name) => class_basename($name).' ×'.$n)->implode(', ');
                    $this->send('health', '⚠️ Провалено задач у черзі: '.$fresh->count(), $names."\n".Str::limit(strtok((string) $fresh->last()->exception, "\n") ?: '', 300),
                        dedupe: 'failed_jobs:'.$fresh->last()->id, link: url('/admin/system'));
                }
            }
        }

        // Пуші: за сьогодні понад 30% невдалих при помітному обсязі.
        $day = now()->format('Y-m-d');
        $sent = $failed = 0;
        foreach (['app', 'web'] as $channel) {
            $sent += (int) Cache::get("push_stats:{$day}:{$channel}:sent", 0);
            $failed += (int) Cache::get("push_stats:{$day}:{$channel}:failed", 0);
        }
        if ($sent + $failed >= 50 && $failed / ($sent + $failed) > 0.3) {
            $this->send('health', '📵 Багато невдалих пушів', "Сьогодні: {$failed} невдалих із ".($sent + $failed).'. Перевірте ключі FCM і VAPID.',
                dedupe: 'push:'.$day, ttl: 6 * 3600, link: url('/admin/push-stats'));
        }

        // Опитувач тривог завис, хоча інтеграцію ввімкнено.
        if (app(UkraineAlarm::class)->enabled()) {
            $tick = Cache::get('ua_alarm_at');
            if (is_int($tick) && time() - $tick > 600) {
                $this->send('health', '🚨 Тривоги не оновлюються', 'Останнє оновлення '.now()->setTimestamp($tick)->diffForHumans().'. Перевірте планувальник і ключ UkraineAlarm.',
                    dedupe: 'alarm_stale', ttl: 3 * 3600, link: url('/admin/alerts'));
            }
        }

        // Скарги: нагадування, якщо в черзі накопичилося.
        $pending = UserReport::query()->where('status', UserReport::PENDING)->count()
            + MessageReport::query()->where('status', MessageReport::PENDING)->count();
        if ($pending >= 10) {
            $this->send('reports', '🛡️ Скарг у черзі: '.$pending, 'Модерація чекає на розгляд.',
                dedupe: 'reports:'.intdiv($pending, 10), ttl: 6 * 3600, link: url('/admin/moderation'));
        }
    }
}
