<?php

namespace App\Services\Phones;

use App\Models\PhoneNumber;
use App\Models\PhoneNumberRule;
use App\Models\User;
use App\Services\Billing\Catalog;
use App\Services\FriendshipService;
use App\Support\Settings\SiteSettings;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Внутрішні номери GameCon: випадковий безкоштовний (+555, з шансом на рідкісний) або куплений (+777,
 * людина сама вводить код оператора й цифри, ціна — за рівнем). Налаштування — Адмінка → Номери
 * (setting phone_numbers), ціни — Адмінка → Білінг (товари phone_*).
 */
class PhoneNumbers
{
    public const SETTING = 'phone_numbers';

    /** Хто може дзвонити й писати за номером. */
    public const PRIVACY = ['everyone', 'friends', 'nobody'];

    public const DEFAULTS = [
        'premium_code' => '777',
        'random_code' => '555',
        // Знижка для GameCon+ на куплені номери, %.
        'plus_discount' => 20,
        // Шанс випадкового номера стати рідкісним, %.
        'chances' => ['bronze' => 5, 'silver' => 1, 'gold' => 0.2, 'platinum' => 0.05, 'diamond' => 0.01],
        // Безкоштовна зміна випадкового номера — раз на стільки днів.
        'random_cooldown_days' => 7,
    ];

    public function __construct(
        private readonly SiteSettings $settings,
        private readonly Catalog $catalog,
    ) {}

    /**
     * @return array{premium_code: string, random_code: string, plus_discount: int, chances: array<string, float>, random_cooldown_days: int}
     */
    public function config(): array
    {
        $saved = (array) $this->settings->get(self::SETTING, []);
        $code = fn (string $key, string $default) => preg_match('/^\d{1,4}$/', (string) ($saved[$key] ?? '')) === 1 ? (string) $saved[$key] : $default;
        $chances = [];
        foreach (self::DEFAULTS['chances'] as $tier => $default) {
            $value = $saved['chances'][$tier] ?? $default;
            $chances[$tier] = max(0.0, min(100.0, (float) $value));
        }

        return [
            'premium_code' => $code('premium_code', self::DEFAULTS['premium_code']),
            'random_code' => $code('random_code', self::DEFAULTS['random_code']),
            'plus_discount' => max(0, min(100, (int) ($saved['plus_discount'] ?? self::DEFAULTS['plus_discount']))),
            'chances' => $chances,
            'random_cooldown_days' => max(0, (int) ($saved['random_cooldown_days'] ?? self::DEFAULTS['random_cooldown_days'])),
        ];
    }

    public static function format(string $country, string $operator, string $digits): string
    {
        return sprintf('+%s (%s) %s-%s-%s', $country, $operator, substr($digits, 0, 3), substr($digits, 3, 2), substr($digits, 5, 2));
    }

    /** «(05) 123-45-67» — без коду мережі (він не входить в унікальність). */
    public static function local(string $operator, string $digits): string
    {
        return sprintf('(%s) %s-%s-%s', $operator, substr($digits, 0, 3), substr($digits, 3, 2), substr($digits, 5, 2));
    }

    public static function product(string $tier): string
    {
        return 'phone_'.$tier;
    }

    public function current(User $user): ?PhoneNumber
    {
        return PhoneNumber::query()->where('user_id', $user->id)->where('status', PhoneNumber::ACTIVE)->first();
    }

    /** Рівень: правка адміністратора або за цифрами. */
    public function tierOf(string $operator, string $digits): string
    {
        $rule = $this->rule($operator, $digits);

        return $rule !== null && $rule->tier !== null ? $rule->tier : PhoneTiers::detect($operator, $digits);
    }

    /** Ціна номера рівня для людини (копійки), зі знижкою GameCon+. */
    public function price(string $tier, ?User $user): int
    {
        return $this->catalog->priceFor($user, self::product($tier));
    }

    /** Коли наступна безкоштовна зміна випадкового номера (null — можна вже). */
    public function nextRandomAt(User $user): ?Carbon
    {
        $last = $user->pref('phone_random_at');
        if (! is_string($last) || $this->current($user) === null) {
            return null;
        }
        $next = Carbon::parse($last)->addDays($this->config()['random_cooldown_days']);

        return $next->isFuture() ? $next : null;
    }

    /**
     * Випадковий безкоштовний номер (+555): рівень — за шансами, далі вільний номер цього рівня.
     * Попередній номер звільняється. Змінити випадковий можна раз на random_cooldown_days;
     * куплений номер на випадковий не міняється (лише на інший куплений).
     */
    public function random(User $user): PhoneNumber
    {
        if ($this->current($user)?->kind === PhoneNumber::PURCHASED) {
            throw ValidationException::withMessages(['phone' => 'Куплений номер не можна змінити на випадковий — лише на інший куплений.']);
        }
        if (($next = $this->nextRandomAt($user)) !== null) {
            throw ValidationException::withMessages(['phone' => 'Безкоштовно змінити номер можна '.$next->timezone('Europe/Kyiv')->format('d.m о H:i').'. Купити номер можна будь-коли.']);
        }
        $config = $this->config();
        $tier = $this->rollTier($config['chances']);

        $retries = 0;
        for ($rank = PhoneTiers::rank($tier); $rank >= 0; $rank--) {
            $candidate = $this->freeOfTier(PhoneTiers::ALL[$rank]);
            if ($candidate === null) {
                continue;
            }
            [$operator, $digits, $found] = $candidate;
            try {
                $number = DB::transaction(function () use ($user, $config, $operator, $digits, $found) {
                    $this->releaseActive($user);

                    return PhoneNumber::query()->create([
                        'user_id' => $user->id,
                        'country' => $config['random_code'],
                        'operator' => $operator,
                        'digits' => $digits,
                        'tier' => $found,
                        'kind' => PhoneNumber::RANDOM,
                        'status' => PhoneNumber::ACTIVE,
                    ]);
                });
            } catch (UniqueConstraintViolationException) {
                // Цей номер щойно забрав хтось інший — беремо інший того ж рівня.
                if (++$retries < 5) {
                    $rank++;
                }

                continue;
            }
            $user->mergePref(['phone_random_at' => now()->toIso8601String(), 'phone_prompt' => false]);

            return $number;
        }

        throw ValidationException::withMessages(['phone' => 'Не вдалося підібрати номер, спробуйте ще раз.']);
    }

    /**
     * Перевірка номера для покупки (+777): вільний / зайнятий / зарезервований, рівень і ціна.
     *
     * @return array{number: string, operator: string, digits: string, tier: string, available: bool, reason: string|null, product: string, price: int, full_price: int}
     */
    public function check(?User $user, string $operator, string $digits): array
    {
        $this->assertFormat($operator, $digits);
        $country = $this->config()['premium_code'];
        $tier = $this->tierOf($operator, $digits);
        $own = $user !== null ? $this->current($user) : null;
        $mine = $own !== null && $own->operator === $operator && $own->digits === $digits;
        $reason = match (true) {
            $mine => 'Це вже ваш номер.',
            (bool) $this->rule($operator, $digits)?->reserved => 'Номер зарезервовано.',
            $this->taken($operator, $digits, $user) => 'Номер уже зайнятий.',
            default => null,
        };

        return [
            'number' => self::format($country, $operator, $digits),
            'operator' => $operator,
            'digits' => $digits,
            'tier' => $tier,
            'available' => $reason === null,
            'reason' => $reason,
            'product' => self::product($tier),
            'price' => $this->price($tier, $user),
            'full_price' => $this->catalog->price(self::product($tier)),
        ];
    }

    /**
     * Вільні номери рівня для підказок «Підібрати» (з кодом оператора, якщо його вже ввели).
     *
     * @return list<array{number: string, operator: string, digits: string, tier: string}>
     */
    public function suggest(string $tier, ?string $operator, int $count = 6): array
    {
        $country = $this->config()['premium_code'];
        $out = [];
        $seen = [];
        for ($i = 0; $i < 400 && count($out) < $count; $i++) {
            [$op, $digits] = PhoneTiers::generate($tier, $tier === 'diamond' ? null : $operator);
            $key = $op.$digits;
            if (isset($seen[$key]) || $this->tierOf($op, $digits) !== $tier || $this->taken($op, $digits, null) || $this->rule($op, $digits)?->reserved) {
                continue;
            }
            $seen[$key] = true;
            $out[] = ['number' => self::format($country, $op, $digits), 'operator' => $op, 'digits' => $digits, 'tier' => $tier];
        }

        return $out;
    }

    /**
     * Тримати номер на час оплати (одна бронь на людину). Ціну визначає рівень номера — товар має збігатися.
     */
    public function hold(User $user, string $operator, string $digits, string $product): PhoneNumber
    {
        $check = $this->check($user, $operator, $digits);
        if (! $check['available']) {
            throw ValidationException::withMessages(['phone' => (string) $check['reason']]);
        }
        if ($check['product'] !== $product) {
            throw ValidationException::withMessages(['phone' => 'Ціна номера змінилася — перевірте його ще раз.']);
        }
        $country = $this->config()['premium_code'];

        try {
            return DB::transaction(function () use ($user, $country, $operator, $digits, $check) {
                PhoneNumber::query()->where('user_id', $user->id)->where('status', PhoneNumber::PENDING)->delete();
                $this->purgeExpired($operator, $digits);

                return PhoneNumber::query()->create([
                    'user_id' => $user->id,
                    'country' => $country,
                    'operator' => $operator,
                    'digits' => $digits,
                    'tier' => $check['tier'],
                    'kind' => PhoneNumber::PURCHASED,
                    'status' => PhoneNumber::PENDING,
                    'hold_until' => now()->addHours(max(1, $this->catalog->rules()['order_hours'])),
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['phone' => 'Номер уже зайнятий.']);
        }
    }

    /** Оплачено: заброньований номер стає номером людини, попередній звільняється. */
    public function activate(PhoneNumber $number, ?int $paymentId): void
    {
        DB::transaction(function () use ($number, $paymentId) {
            $user = $number->user;
            $this->releaseActive($user, $number->id);
            $number->update(['status' => PhoneNumber::ACTIVE, 'hold_until' => null, 'payment_id' => $paymentId]);
            $user->mergePref(['phone_prompt' => false]);
        });
    }

    /** Повернення коштів за номер — номер звільняється. */
    public function revoke(int $paymentId): void
    {
        PhoneNumber::query()->where('payment_id', $paymentId)->delete();
    }

    /** Скасоване замовлення — бронь знімається. */
    public function releaseHold(int $id): void
    {
        PhoneNumber::query()->whereKey($id)->where('status', PhoneNumber::PENDING)->delete();
    }

    /**
     * Номер із рядка: «+777 (05) 123-45-67», «77705 1234567» або без коду мережі «05 123-45-67»
     * (код оператора + цифри унікальні в усій мережі, тож збіг завжди один).
     */
    public function find(string $input): ?PhoneNumber
    {
        $digits = preg_replace('/\D/', '', $input) ?? '';
        $config = $this->config();
        $query = PhoneNumber::query()->with('user')->where('status', PhoneNumber::ACTIVE);
        foreach ([$config['premium_code'], $config['random_code']] as $code) {
            if (strlen($digits) === strlen($code) + 9 && str_starts_with($digits, $code)) {
                return (clone $query)->where('country', $code)->where('operator', substr($digits, strlen($code), 2))->where('digits', substr($digits, -7))->first();
            }
        }
        if (strlen($digits) === 9) {
            return (clone $query)->where('operator', substr($digits, 0, 2))->where('digits', substr($digits, 2))->first();
        }

        return null;
    }

    /** Чи можна дзвонити й писати людині за номером (її налаштування приватності). */
    public function reachable(User $viewer, User $owner): bool
    {
        if ($viewer->is($owner)) {
            return false;
        }

        return match ((string) $owner->pref('phone_privacy', 'everyone')) {
            'nobody' => false,
            'friends' => app(FriendshipService::class)->status($viewer, $owner) === FriendshipService::FRIENDS,
            default => true,
        };
    }

    /** Чи показувати номер у профілі. */
    public function visibleOnProfile(User $owner): bool
    {
        return $owner->pref('phone_visible', true) !== false;
    }

    /**
     * @param  array<string, float>  $chances
     */
    private function rollTier(array $chances): string
    {
        // Від найрідшого: кидок у 0…100 з точністю до тисячних відсотка.
        $roll = random_int(0, 99_999) / 1000;
        $edge = 0.0;
        foreach (array_reverse(PhoneTiers::ALL) as $tier) {
            if ($tier === 'regular') {
                break;
            }
            $edge += $chances[$tier] ?? 0;
            if ($roll < $edge) {
                return $tier;
            }
        }

        return 'regular';
    }

    /**
     * @return array{0: string, 1: string, 2: string}|null [operator, digits, tier]
     */
    private function freeOfTier(string $tier): ?array
    {
        for ($i = 0; $i < 300; $i++) {
            [$operator, $digits] = PhoneTiers::generate($tier);
            if ($this->tierOf($operator, $digits) !== $tier || $this->taken($operator, $digits, null) || $this->rule($operator, $digits)?->reserved) {
                continue;
            }

            return [$operator, $digits, $tier];
        }

        return null;
    }

    /** Зайнятий у будь-якій мережі (+555 чи +777) — активний або заброньований на час оплати. */
    private function taken(string $operator, string $digits, ?User $except): bool
    {
        return PhoneNumber::query()->where(['operator' => $operator, 'digits' => $digits])
            ->where(fn ($q) => $q->where('status', PhoneNumber::ACTIVE)->orWhere('hold_until', '>', now()))
            ->when($except !== null, fn ($q) => $q->where('user_id', '!=', $except?->id))
            ->exists();
    }

    /** Прострочена бронь не тримає номер (рядок прибираємо, щоб не заважав унікальному індексу). */
    private function purgeExpired(string $operator, string $digits): void
    {
        PhoneNumber::query()->where(['operator' => $operator, 'digits' => $digits])
            ->where('status', PhoneNumber::PENDING)->where('hold_until', '<=', now())->delete();
    }

    private function releaseActive(User $user, ?int $except = null): void
    {
        PhoneNumber::query()->where('user_id', $user->id)->where('status', PhoneNumber::ACTIVE)
            ->when($except !== null, fn ($q) => $q->whereKeyNot($except))->delete();
    }

    private function rule(string $operator, string $digits): ?PhoneNumberRule
    {
        return PhoneNumberRule::query()->where(['operator' => $operator, 'digits' => $digits])->first();
    }

    private function assertFormat(string $operator, string $digits): void
    {
        if (preg_match('/^(0[1-9]|[1-9]\d)$/', $operator) !== 1) {
            throw ValidationException::withMessages(['operator' => 'Код оператора — дві цифри від 01 до 99.']);
        }
        if (preg_match('/^\d{7}$/', $digits) !== 1) {
            throw ValidationException::withMessages(['digits' => 'Номер — 7 цифр.']);
        }
    }
}
