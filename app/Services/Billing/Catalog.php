<?php

namespace App\Services\Billing;

use App\Models\User;
use App\Services\Phones\PhoneNumbers;
use App\Support\Settings\SiteSettings;

/**
 * Тарифи й товари: базові з config/plus.php, поверх них — правки з адмінки (ціна, строк, назва,
 * «стара» ціна для знижки, позначка, порядок, автопродовження, продаж) і власні тарифи адміністратора.
 * Тут же — правила підписок (коли продовжувати, скільки разів повторювати невдалу оплату).
 */
class Catalog
{
    public const KINDS = ['plus', 'family', 'gift', 'promo', 'phone'];

    public const PROMOS = ['top', 'highlight', 'banner'];

    /** Правила підписок за замовчуванням (Адмінка → Білінг → «Тарифи й підписки»). */
    public const RULES = [
        // За скільки годин до кінця періоду списувати продовження.
        'renew_before_hours' => 24,
        // Через скільки годин повторити невдале продовження і скільки разів пробувати.
        'retry_hours' => 24,
        'retry_max' => 3,
        // Скільки годин чекає неоплачене замовлення.
        'order_hours' => 72,
        // Продовжувати збереженою карткою, коли на рахунку не вистачає коштів.
        'card_renewals' => true,
        // Пропонувати зберегти картку під час оплати (для автопродовження).
        'offer_save_card' => true,
        // Значки способів оплати внизу сайту (лише ті, що реально приймає еквайринг).
        'badges' => ['plata', 'visa', 'mastercard', 'apple_pay', 'google_pay'],
    ];

    /** Значки, які можна показати: Visa, Mastercard, Maestro, ПРОСТІР, Apple Pay, Google Pay. */
    public const BADGES = ['plata', 'visa', 'mastercard', 'maestro', 'prostir', 'apple_pay', 'google_pay'];

    public function __construct(private readonly SiteSettings $settings) {}

    /**
     * Усі товари з урахуванням правок адмінки, у порядку показу.
     *
     * @return array<string, array{key: string, kind: string, promo: string|null, name: string, price: int, old_price: int|null, days: int, recurring: bool, enabled: bool, badge: string|null, position: int, custom: bool}>
     */
    public function products(): array
    {
        $overrides = (array) $this->settings->get('billing_products', []);
        $disabled = (array) $this->settings->get('plus_disabled', []);
        $out = [];
        $position = 0;
        foreach ((array) config('plus.products') as $key => $base) {
            $out[(string) $key] = $this->row((string) $key, (array) $base, (array) ($overrides[$key] ?? []), $position++, false, $disabled);
        }
        foreach ($overrides as $key => $row) {
            $row = (array) $row;
            if (isset($out[$key]) || ! in_array($row['kind'] ?? null, self::KINDS, true)) {
                continue;
            }
            $out[(string) $key] = $this->row((string) $key, $row, [], $position++, true, $disabled);
        }
        uasort($out, fn (array $a, array $b) => $a['position'] <=> $b['position']);

        return $out;
    }

    /**
     * @return array{key: string, kind: string, promo: string|null, name: string, price: int, old_price: int|null, days: int, recurring: bool, enabled: bool, badge: string|null, position: int, custom: bool}|null
     */
    public function get(string $key): ?array
    {
        return $this->products()[$key] ?? null;
    }

    /** Ціна в копійках. */
    public function price(string $key): int
    {
        return (int) ($this->get($key)['price'] ?? 0) * 100;
    }

    /** Ціна для покупця (копійки): номери з GameCon+ — зі знижкою з Адмінка → Номери. */
    public function priceFor(?User $user, string $key): int
    {
        $price = $this->price($key);
        if ($user !== null && $user->isPlus() && ($this->get($key)['kind'] ?? null) === 'phone') {
            $discount = app(PhoneNumbers::class)->config()['plus_discount'];
            $price = (int) (round($price * (100 - $discount) / 100 / 100) * 100);
        }

        return $price;
    }

    public function enabled(string $key): bool
    {
        return (bool) ($this->get($key)['enabled'] ?? false);
    }

    public function label(string $key): string
    {
        return (string) ($this->get($key)['name'] ?? $key);
    }

    /**
     * Тарифи, які можна продовжувати автоматично: GameCon+ людини чи сім’ї з дозволеним автопродовженням.
     *
     * @return list<string>
     */
    public function renewable(): array
    {
        return array_keys(array_filter(
            $this->products(),
            fn (array $p) => in_array($p['kind'], ['plus', 'family'], true) && $p['recurring'],
        ));
    }

    /**
     * @return array{renew_before_hours: int, retry_hours: int, retry_max: int, order_hours: int, card_renewals: bool, offer_save_card: bool, badges: list<string>}
     */
    public function rules(): array
    {
        $saved = (array) $this->settings->get('billing_rules', []);
        $rules = self::RULES;
        foreach ($rules as $key => $default) {
            if (! array_key_exists($key, $saved)) {
                continue;
            }
            if (is_array($default)) {
                $rules[$key] = array_values(array_intersect(self::BADGES, (array) $saved[$key]));
            } else {
                $rules[$key] = is_bool($default) ? (bool) $saved[$key] : max(0, (int) $saved[$key]);
            }
        }

        return $rules;
    }

    /**
     * @param  array<string, mixed>  $base
     * @param  array<string, mixed>  $override
     * @param  array<int|string, mixed>  $disabled
     * @return array{key: string, kind: string, promo: string|null, name: string, price: int, old_price: int|null, days: int, recurring: bool, enabled: bool, badge: string|null, position: int, custom: bool}
     */
    private function row(string $key, array $base, array $override, int $position, bool $custom, array $disabled): array
    {
        $value = fn (string $field, mixed $default = null) => array_key_exists($field, $override) && $override[$field] !== null ? $override[$field] : ($base[$field] ?? $default);
        $kind = (string) $base['kind'];
        $oldPrice = $value('old_price');

        return [
            'key' => $key,
            'kind' => $kind,
            'promo' => $kind === 'promo' ? (string) ($base['promo'] ?? 'top') : null,
            'name' => (string) $value('name', $key),
            'price' => max(1, (int) $value('price', 0)),
            'old_price' => is_numeric($oldPrice) && (int) $oldPrice > 0 ? (int) $oldPrice : null,
            'days' => max(1, (int) $value('days', 30)),
            // Автопродовження має сенс лише для власного GameCon+ і GameCon+ сім’ї.
            // (поле recurring у config/plus.php лишилося від старих платіжних сервісів — його не читаємо).
            'recurring' => in_array($kind, ['plus', 'family'], true) && (! array_key_exists('recurring', $override) || (bool) $override['recurring']),
            'enabled' => (bool) $value('enabled', true) && ! in_array($key, $disabled, true),
            'badge' => is_string($value('badge')) && trim((string) $value('badge')) !== '' ? trim((string) $value('badge')) : null,
            'position' => (int) $value('position', $position),
            'custom' => $custom,
        ];
    }
}
