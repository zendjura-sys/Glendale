<?php

namespace Addons\Notifications\Listeners;

use Addons\MemberCenter\Models\MemberWarning;
use Addons\Notifications\Services\NotificationService;
use App\Models\User;
use Illuminate\Support\Facades\Route;

/**
 * Покарання за правилами родини — учасник дізнається одразу (дзвіночок,
 * push) з конкретикою: сума й строк штрафу, лічильник
 * зауважень/доган, наслідки. Кнопка веде на «Мої покарання», де штраф
 * можна сплатити з рахунку. Штрафи додатково лишають квитанцію в чаті
 * Monsory Finance (якщо встановлено Bonuses + Messenger).
 */
class NotifyOnMemberWarningIssued
{
    public function __construct(private readonly NotificationService $notifications)
    {
    }

    public function handle($event): void
    {
        $w = $event->warning;
        $user = User::find($w->user_id);
        if (! $user) {
            return;
        }

        // Автодогана за прострочений штраф — про неї вже каже сповіщення
        // "штраф прострочено" (MemberPenaltyUpdated overdue), без дубля.
        if ($w->auto && $w->type === 'reprimand' && $w->source_id
            && MemberWarning::query()->whereKey($w->source_id)->value('type') === 'fine') {
            return;
        }

        [$title, $body] = self::texts($w);

        $this->notifications->notify($user, 'member_warning_issued', $title, $body, self::button());

        if ($w->type === 'fine' && class_exists(\Addons\Bonuses\Support\FinanceNotifier::class)) {
            \Addons\Bonuses\Support\FinanceNotifier::receipt($user, '🧾', $title, $body);
        }
    }

    public static function button(): ?array
    {
        return Route::has('discipline.index')
            ? ['text' => '⚖️  Мої покарання', 'url' => route('discipline.index')]
            : null;
    }

    public static function money(?int $amount): string
    {
        return number_format((int) $amount, 0, ',', ' ').'₴';
    }

    public static function date($date): string
    {
        return $date ? $date->copy()->setTimezone('Europe/Kyiv')->format('d.m.Y H:i') : '';
    }

    /** @return array{0:string,1:string} */
    public static function texts(MemberWarning $w): array
    {
        $short = $w->rule_code && method_exists(\App\Support\FamilyRules::class, 'shortLabel')
            ? \App\Support\FamilyRules::shortLabel($w->rule_code) : null;
        $rule = $w->rule_code ? "п. {$w->rule_code}".($short ? " · {$short}" : '') : 'правила родини';
        $reason = trim((string) $w->reason);
        $count = fn (string $type) => MemberWarning::query()
            ->where('user_id', $w->user_id)->where('type', $type)->where('status', 'active')->count();

        return match ($w->type) {
            'fine' => [
                'Вам нараховано штраф у розмірі '.self::money($w->amount),
                "Причина: {$reason} ({$rule}).\nСплатити до ".self::date($w->due_at)
                    .' — з рахунку в розділі «Мої покарання» або керівництву. Несплата в строк: сума подвоюється, плюс догана.',
            ],
            'remark' => [
                'Вам винесено зауваження ('.$count('remark').'/3)',
                "Причина: {$reason} ({$rule}).\n3 активні зауваження = догана. Згорить ".self::date($w->expires_at).', якщо не буде нових порушень.',
            ],
            'reprimand' => [
                ($w->auto ? 'Автоматична догана' : 'Вам винесено догану').' ('.$count('reprimand').'/3)',
                "Причина: {$reason} ({$rule}).\nПоки діє догана — тижнева премія нараховується на 50%, підвищення неможливе. Згорить "
                    .self::date($w->expires_at).' без нових порушень. 3/3 догани — виключення.',
            ],
            'demotion' => ['Вас понижено в посаді', "Причина: {$reason} ({$rule})."],
            'kick' => ['Вас виключено з родини', "Причина: {$reason} ({$rule}). Повернення — не раніше ніж через 14 днів і лише за рішенням Директора."],
            'blacklist' => ['Вас внесено до чорного списку родини', "Причина: {$reason} ({$rule})."],
            default => ['Покарання', $reason],
        };
    }
}
