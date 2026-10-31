<?php

namespace App\Services\Crosspost;

use App\Jobs\SendCrosspost;
use App\Models\CrosspostTarget;
use App\Models\GtaServer;
use App\Models\User;
use App\Services\Bots\TelegramApi;
use App\Support\Plugins\Plugins;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Автопостинг: свої записи й початок стріму (людина), новини сервера (власник) —
 * у Discord через вебхук каналу або в Telegram-канал через бота GameCon.
 */
class Crossposting
{
    private const DISCORD = '#^https://(?:ptb\.|canary\.)?(?:discord|discordapp)\.com/api/webhooks/\d{5,30}/[\w-]{20,120}$#';

    private const TELEGRAM = '/^(@[A-Za-z][A-Za-z0-9_]{4,31}|-100\d{6,16})$/';

    public function __construct(private readonly TelegramApi $telegram) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function list(string $type, int $id): array
    {
        return array_values(CrosspostTarget::query()->where('owner_type', $type)->where('owner_id', $id)->orderBy('id')->get()
            ->map(fn (CrosspostTarget $t) => [
                'id' => $t->id,
                'platform' => $t->platform,
                'label' => $t->label,
                'events' => $t->events,
                'enabled' => $t->enabled,
                'last_error' => $t->last_error,
                'last_sent_at' => $t->last_sent_at?->toIso8601String(),
            ])->all());
    }

    /**
     * @param  list<string>  $events
     */
    public function add(string $type, int $id, string $platform, string $target, array $events): CrosspostTarget
    {
        $target = trim($target);
        if ($platform === 'discord' && preg_match(self::DISCORD, $target) !== 1) {
            throw ValidationException::withMessages(['target' => 'Вставте вебхук каналу Discord: Налаштування каналу → Інтеграції → Вебхуки → Копіювати URL.']);
        }
        if ($platform === 'telegram') {
            if (preg_match(self::TELEGRAM, $target) !== 1) {
                throw ValidationException::withMessages(['target' => 'Вкажіть канал як @назва або числовий id (-100…).']);
            }
            if (! $this->telegram->configured()) {
                throw ValidationException::withMessages(['target' => 'Бот Telegram ще не підключений адміністрацією сайту.']);
            }
        }
        if (CrosspostTarget::query()->where('owner_type', $type)->where('owner_id', $id)->count() >= 5) {
            throw ValidationException::withMessages(['target' => 'Не більше п’яти каналів.']);
        }
        $row = new CrosspostTarget([
            'owner_type' => $type,
            'owner_id' => $id,
            'platform' => $platform,
            'target' => $target,
            'label' => $platform === 'discord' ? 'Discord · вебхук …'.substr($target, -6) : 'Telegram · '.$target,
            'events' => array_values(array_intersect($events, CrosspostTarget::EVENTS[$type])),
        ]);
        // Пробне повідомлення: одразу видно, що канал правильний і бот має доступ.
        $error = $this->deliver($row, ['title' => 'GameCon підключено', 'text' => 'Сюди будуть приходити оновлення з GameCon.', 'url' => url('/')]);
        if ($error !== null) {
            throw ValidationException::withMessages(['target' => $error]);
        }
        $row->last_sent_at = now();
        $row->save();

        return $row;
    }

    /**
     * Розіслати подію у всі ввімкнені канали власника (у черзі).
     *
     * @param  array{title: string, text: string, url: string, image?: string|null}  $payload
     */
    public function dispatch(string $type, int $id, string $event, array $payload): void
    {
        if (! app(Plugins::class)->on('crossposting')) {
            return;
        }
        $ids = CrosspostTarget::query()->where('owner_type', $type)->where('owner_id', $id)->where('enabled', true)->get()
            ->filter(fn (CrosspostTarget $t) => in_array($event, $t->events, true))->pluck('id')->all();
        foreach ($ids as $targetId) {
            SendCrosspost::dispatch((int) $targetId, $payload);
        }
    }

    /**
     * Надіслати й записати результат.
     *
     * @param  array{title: string, text: string, url: string, image?: string|null}  $payload
     */
    public function send(CrosspostTarget $target, array $payload): void
    {
        $error = $this->deliver($target, $payload);
        $target->forceFill(['last_error' => $error, 'last_sent_at' => $error === null ? now() : $target->last_sent_at])->save();
        if ($error !== null) {
            Log::warning('crosspost failed', ['target' => $target->id, 'error' => $error]);
        }
    }

    /**
     * @param  array{title: string, text: string, url: string, image?: string|null}  $payload
     */
    private function deliver(CrosspostTarget $target, array $payload): ?string
    {
        $text = Str::limit($payload['text'], 1500);
        if ($target->platform === 'discord') {
            try {
                $response = Http::timeout(10)->asJson()->post($target->target, [
                    'username' => 'GameCon',
                    'embeds' => [array_filter([
                        'title' => Str::limit($payload['title'], 250),
                        'description' => $text,
                        'url' => $payload['url'],
                        'color' => 0x6366F1,
                        'image' => ! empty($payload['image']) ? ['url' => $payload['image']] : null,
                    ])],
                ]);
            } catch (ConnectionException) {
                return 'Discord не відповідає. Спробуйте пізніше.';
            }

            return $response->successful() ? null : 'Discord відхилив вебхук (його видалили або адреса неправильна).';
        }

        $result = $this->telegram->call('sendMessage', [
            'chat_id' => $target->target,
            'text' => '<b>'.e(Str::limit($payload['title'], 200)).'</b>'."\n\n".e($text)."\n\n".$payload['url'],
            'parse_mode' => 'HTML',
        ]);

        return $result !== null ? null : 'Telegram відмовив: додайте бота GameCon адміністратором каналу.';
    }

    public static function canManage(?User $user, string $type, int $id): bool
    {
        if ($user === null) {
            return false;
        }

        return match ($type) {
            'user' => $user->id === $id,
            'server' => $user->isStaff() || GtaServer::query()->whereKey($id)->value('owner_id') === $user->id,
            default => false,
        };
    }
}
