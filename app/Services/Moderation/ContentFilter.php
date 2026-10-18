<?php

namespace App\Services\Moderation;

use App\Models\Conversation;
use App\Models\FamilyMember;
use App\Models\FamilyPunishment;
use App\Models\Message;
use App\Models\User;
use App\Support\Settings\SiteSettings;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

/**
 * Автомодерація: мат (маскуємо або не пропускаємо), спам і флуд у чатах, посилання від
 * щойно створених акаунтів, мут на сайті й мут у чаті сім’ї. Налаштування — Адмінка → Модерація.
 */
class ContentFilter
{
    public const DEFAULTS = [
        // mask — замінити зірочками, block — не пропускати, off — вимкнено.
        'profanity' => 'mask',
        'extra_words' => [],
        // Скільки повідомлень за хвилину можна надіслати в чати.
        'flood_limit' => 20,
        // Скільки однакових повідомлень поспіль за 2 хвилини.
        'repeat_limit' => 3,
        // Посилання від акаунтів, молодших за стільки годин, не пропускаємо (0 — вимкнено).
        'new_account_link_hours' => 24,
    ];

    /**
     * Корені нецензурних слів (українська, російська, англійська). Шукаємо з початку слова,
     * щоб не чіпати звичайні слова на кшталт «сукня», «небо» чи «хлеб».
     */
    private const ROOTS = [
        'ху[йяеєюї]', 'хуё', '(?:на|по|ни|ні|от|до|за)ху[йяеєюїё]', 'пизд', 'пізд', 'бля(?:\b|д|ть|т\b)', 'ебл[ауоия]', 'ебан', 'ебат', 'еба[лн]', 'ёб', 'їб', 'йоб',
        '(?:за|по|на|у|ви|вы|от|раз|роз|до|про|пере|при|под|під|об|съ|з)(?:ъ|\')?[еёї]б[аеиуолн]',
        'сука\b', 'суки\b', 'сучк', 'сучар', 'мудак', 'мудил', 'мудозвон', 'залуп', 'гандон', 'гондон',
        'пидор', 'пидар', 'підар', 'підор', 'педик', 'шлюх', 'шалав', 'курв', 'дроч', 'манд[аиуо]\b',
        'fuck', 'motherfuck', 'shit', 'bitch', 'cunt', 'asshole', 'dickhead', 'whore', 'faggot',
    ];

    public function __construct(private readonly SiteSettings $settings) {}

    /**
     * @return array{profanity: string, extra_words: list<string>, flood_limit: int, repeat_limit: int, new_account_link_hours: int}
     */
    public function config(): array
    {
        $stored = $this->settings->get('moderation');
        $stored = is_array($stored) ? $stored : [];
        $words = is_array($stored['extra_words'] ?? null) ? array_values(array_filter(array_map(fn ($w) => mb_strtolower(trim((string) $w)), $stored['extra_words']))) : [];

        return [
            'profanity' => in_array($stored['profanity'] ?? null, ['mask', 'block', 'off'], true) ? (string) $stored['profanity'] : self::DEFAULTS['profanity'],
            'extra_words' => $words,
            'flood_limit' => max(0, (int) ($stored['flood_limit'] ?? self::DEFAULTS['flood_limit'])),
            'repeat_limit' => max(0, (int) ($stored['repeat_limit'] ?? self::DEFAULTS['repeat_limit'])),
            'new_account_link_hours' => max(0, (int) ($stored['new_account_link_hours'] ?? self::DEFAULTS['new_account_link_hours'])),
        ];
    }

    /**
     * Текст запису, коментаря чи повідомлення: мат зірочками або помилка (режим «не пропускати»).
     */
    public function clean(?string $text): ?string
    {
        if ($text === null || $text === '') {
            return $text;
        }
        $mode = $this->config()['profanity'];
        if ($mode === 'off') {
            return $text;
        }
        $pattern = $this->pattern();
        if ($mode === 'block') {
            if (preg_match($pattern, $text) === 1) {
                throw ValidationException::withMessages(['body' => 'Без мату, будь ласка — повідомлення не надіслано.']);
            }

            return $text;
        }

        return preg_replace_callback($pattern, function (array $m) {
            $word = $m[0];
            $first = mb_substr($word, 0, 1);

            return $first.str_repeat('*', max(1, mb_strlen($word) - 1));
        }, $text) ?? $text;
    }

    public function hasProfanity(string $text): bool
    {
        return preg_match($this->pattern(), $text) === 1;
    }

    /**
     * Можна писати на сайті (записи, коментарі, повідомлення)?
     */
    public function ensureCanPost(User $user): void
    {
        if ($user->isMuted()) {
            $until = $user->muted_until?->setTimezone('Europe/Kyiv')->format('d.m H:i');
            throw ValidationException::withMessages(['body' => "Вас тимчасово заглушено до {$until}".($user->mute_reason ? ": {$user->mute_reason}" : '.')]);
        }
    }

    /**
     * Перевірки перед повідомленням у чаті: мут, мут у сім’ї, флуд, повтори, посилання від новачків.
     * Повертає текст після фільтра мату.
     */
    public function guardMessage(User $user, Conversation $conversation, ?string $body): ?string
    {
        $this->ensureCanPost($user);
        if ($conversation->family_id !== null) {
            $this->ensureNotFamilyMuted($user, $conversation->family_id);
        }
        $config = $this->config();

        if ($config['flood_limit'] > 0) {
            $key = "moderation.flood.{$user->id}.".intdiv(time(), 60);
            $count = (int) Cache::get($key, 0) + 1;
            Cache::put($key, $count, 120);
            if ($count > $config['flood_limit']) {
                throw ValidationException::withMessages(['body' => 'Забагато повідомлень за хвилину — зачекайте трохи.']);
            }
        }

        if ($body !== null && $body !== '') {
            if ($config['repeat_limit'] > 0) {
                $same = Message::query()->where('user_id', $user->id)->where('created_at', '>=', now()->subMinutes(2))
                    ->where('body', $body)->count();
                if ($same >= $config['repeat_limit']) {
                    throw ValidationException::withMessages(['body' => 'Однакові повідомлення поспіль схожі на спам.']);
                }
            }
            if ($config['new_account_link_hours'] > 0 && $user->created_at !== null
                && $user->created_at->gt(now()->subHours($config['new_account_link_hours']))
                && preg_match('#(https?://|www\.|t\.me/|discord\.gg/)#iu', $this->withoutOwnLinks($body)) === 1) {
                throw ValidationException::withMessages(['body' => "Посилання можна надсилати через {$config['new_account_link_hours']} год після реєстрації — це захист від спаму."]);
            }
        }

        return $this->clean($body);
    }

    public function ensureNotFamilyMuted(User $user, int $familyId): void
    {
        $member = FamilyMember::query()->where('family_id', $familyId)->where('user_id', $user->id)->value('id');
        if ($member === null) {
            return;
        }
        $until = FamilyPunishment::query()->where('member_id', $member)->where('type', FamilyPunishment::TYPE_MUTE)
            ->whereNull('revoked_at')->where('expires_at', '>', now())->max('expires_at');
        if ($until !== null) {
            $at = CarbonImmutable::parse((string) $until)->setTimezone('Europe/Kyiv')->format('d.m H:i');
            throw ValidationException::withMessages(['body' => "Вас заглушено в чаті сім’ї до {$at}."]);
        }
    }

    /** Посилання на сам GameCon (запрошення, профілі) — не спам. */
    private function withoutOwnLinks(string $body): string
    {
        $host = (string) parse_url((string) config('app.url'), PHP_URL_HOST);

        return $host === '' ? $body : (string) preg_replace('#https?://(www\.)?'.preg_quote($host, '#').'\S*#iu', '', $body);
    }

    /**
     * Той самий шаблон для браузера (RegExp з прапорцями giu): \b у JS не бачить кирилицю.
     */
    public function clientPattern(): string
    {
        $pattern = $this->pattern();
        $body = substr($pattern, 1, (int) strrpos($pattern, '/') - 1);

        return str_replace(['\\b', '\\/'], ['(?![\\p{L}\\p{N}])', '/'], $body);
    }

    private function pattern(): string
    {
        $extra = array_map(fn (string $w) => preg_quote($w, '/'), $this->config()['extra_words']);
        $roots = [...self::ROOTS, ...$extra];

        // Слово, що починається з кореня: (?<!\p{L}) — початок слова, далі решта літер.
        return '/(?<![\p{L}\p{N}])(?:'.implode('|', $roots).')[\p{L}\p{N}\']*/iu';
    }
}
