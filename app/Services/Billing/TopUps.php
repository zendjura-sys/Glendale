<?php

namespace App\Services\Billing;

use App\Models\PlusDonation;
use App\Models\User;
use App\Models\WalletTopup;
use App\Notifications\BillingNotice;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Поповнення рахунку донатом.
 *
 * Людина створює заявку з кодом (GC-XXXXXX), донатить будь-яким увімкненим способом і пише код у
 * повідомленні. Donatello зараховується сам (API, команда billing:donations), інші — після перевірки
 * адміністратором (Адмінка → Білінг).
 */
class TopUps
{
    public const MIN = 10;

    public const MAX = 50000;

    /** Скільки відкритих заявок може мати одна людина. */
    public const OPEN_LIMIT = 5;

    /** Без 0/O й 1/I, щоб код легко переписати. */
    private const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    public function __construct(
        private readonly Wallet $wallet,
        private readonly Shop $shop,
        private readonly SiteSettings $settings,
        private readonly Donatello $donatello,
    ) {}

    /**
     * Налаштування способів з адмінки поверх довідника config/plus.php.
     *
     * @return array<string, array{key: string, label: string, url: string|null, enabled: bool, auto: bool, currency: string, note: string|null, placeholder: string}>
     */
    public function allMethods(): array
    {
        $saved = (array) $this->settings->get('plus_methods', []);
        $out = [];
        foreach ((array) config('plus.methods') as $key => $meta) {
            $row = (array) ($saved[$key] ?? []);
            $url = is_string($row['url'] ?? null) && $row['url'] !== '' ? (string) $row['url'] : null;
            $out[(string) $key] = [
                'key' => (string) $key,
                'label' => (string) (($row['label'] ?? null) ?: $meta['label']),
                'url' => $url,
                'enabled' => (bool) ($row['enabled'] ?? false) && $url !== null,
                'auto' => (bool) $meta['auto'] && ($key !== 'donatello' || $this->donatello->configured()),
                'currency' => (string) $meta['currency'],
                'note' => is_string($row['note'] ?? null) && $row['note'] !== '' ? (string) $row['note'] : null,
                'placeholder' => (string) $meta['placeholder'],
            ];
        }

        return $out;
    }

    /**
     * Увімкнені способи для людей.
     *
     * @return list<array{key: string, label: string, url: string|null, enabled: bool, auto: bool, currency: string, note: string|null, placeholder: string}>
     */
    public function methods(): array
    {
        return array_values(array_filter($this->allMethods(), fn (array $m) => $m['enabled']));
    }

    public function create(User $user, int $amount): WalletTopup
    {
        if ($this->methods() === []) {
            throw ValidationException::withMessages(['amount' => 'Поповнення тимчасово недоступне.']);
        }
        if ($amount < self::MIN || $amount > self::MAX) {
            throw ValidationException::withMessages(['amount' => 'Сума поповнення — від '.self::MIN.' до '.self::MAX.' ₴.']);
        }
        $open = WalletTopup::query()->where('user_id', $user->id)->where('status', WalletTopup::PENDING)->get()->filter->open();
        if ($open->count() >= self::OPEN_LIMIT) {
            throw ValidationException::withMessages(['amount' => 'У вас уже є кілька неоплачених заявок — оплатіть або скасуйте їх.']);
        }

        return WalletTopup::query()->create([
            'code' => $this->newCode(),
            'user_id' => $user->id,
            'amount' => $amount,
            'status' => WalletTopup::PENDING,
            'expires_at' => now()->addHours((int) config('plus.order_hours', 72)),
        ]);
    }

    /** «Я оплатив»: заявка переходить у чергу на перевірку (Donatello ще й перевіряється одразу). */
    public function claim(WalletTopup $topup, string $method, ?string $note): void
    {
        abort_unless($topup->status === WalletTopup::PENDING, 422, 'Ця заявка вже закрита.');
        abort_unless(array_key_exists($method, $this->allMethods()), 422);
        $topup->update(['method' => $method, 'claimed_at' => now(), 'note' => $note !== null ? mb_substr(trim($note), 0, 300) : null]);

        if ($method === 'donatello' && $this->donatello->configured()) {
            $this->syncDonatello();
        }
    }

    public function cancel(WalletTopup $topup): void
    {
        abort_unless($topup->status === WalletTopup::PENDING, 422, 'Ця заявка вже закрита.');
        $topup->update(['status' => WalletTopup::CANCELLED]);
    }

    /**
     * Зарахувати поповнення. credited — копійки (за замовчуванням — сума заявки).
     * Повторний виклик нічого не робить.
     */
    public function confirm(WalletTopup $topup, ?User $by = null, ?int $credited = null, ?PlusDonation $donation = null): bool
    {
        $done = DB::transaction(function () use ($topup, $by, $credited, $donation) {
            $row = WalletTopup::query()->lockForUpdate()->find($topup->id);
            if ($row === null || $row->status === WalletTopup::PAID) {
                return false;
            }
            $amount = $credited ?? $row->amount * 100;
            abort_if($amount <= 0, 422, 'Сума має бути більшою за нуль.');
            $method = $donation->provider ?? $row->method;
            $label = $method !== null ? (string) (config("plus.methods.{$method}.label") ?? $method) : 'донат';

            $this->wallet->credit($row->user, $amount, 'topup', 'Поповнення · '.$label.' · '.$row->code, null, $row->code, $by);
            $row->update([
                'status' => WalletTopup::PAID,
                'method' => $method,
                'credited' => $amount,
                'donation_id' => $donation?->id,
                'confirmed_by' => $by?->id,
                'paid_at' => now(),
            ]);
            $donation?->update(['topup_id' => $row->id]);
            $topup->setRawAttributes($row->getAttributes(), true);

            return true;
        });

        if ($done) {
            $user = $topup->user;
            $user->notify(new BillingNotice('wallet_topup', 'Рахунок поповнено на '.Wallet::uah((int) $topup->credited).'. Баланс: '.Wallet::uah((int) $user->fresh()?->balance).'.'));
            $this->shop->renewDueFor($user);
        }

        return $done;
    }

    /**
     * Донат з API → заявка за кодом у повідомленні. Зараховуємо фактично отриману суму (лише в гривнях;
     * інша валюта — на розгляд адміністратора).
     */
    public function match(PlusDonation $donation): ?WalletTopup
    {
        if ($donation->topup_id !== null || strtoupper($donation->currency) !== 'UAH') {
            return null;
        }
        $code = self::codeIn($donation->message);
        $topup = $code !== null ? WalletTopup::query()->where('code', $code)->where('status', WalletTopup::PENDING)->first() : null;
        if ($topup === null) {
            return null;
        }

        return $this->confirm($topup, null, $donation->amount * 100, $donation) ? $topup : null;
    }

    /** Забрати нові донати Donatello й зарахувати ті, де є код. */
    public function syncDonatello(): int
    {
        $matched = 0;
        foreach ($this->donatello->donations() as $row) {
            $donation = PlusDonation::query()->firstOrCreate(
                ['provider' => 'donatello', 'external_id' => $row['id']],
                [
                    'name' => $row['name'],
                    'message' => $row['message'],
                    'amount' => $row['amount'],
                    'currency' => $row['currency'],
                    'donated_at' => $row['created_at'],
                ],
            );
            if ($donation->topup_id === null && $this->match($donation) !== null) {
                $matched++;
            }
        }

        return $matched;
    }

    /** Код у довільному тексті: «gc-ab3k9z», «GC AB3K9Z», «GCAB3K9Z». */
    public static function codeIn(?string $text): ?string
    {
        if ($text === null || preg_match('/GC[\s\-–—_.:#]*([A-Z0-9]{6})(?![A-Z0-9])/u', mb_strtoupper($text), $m) !== 1) {
            return null;
        }

        return 'GC-'.$m[1];
    }

    private function newCode(): string
    {
        do {
            $code = 'GC-'.collect(range(1, 6))->map(fn () => self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)])->implode('');
        } while (WalletTopup::query()->where('code', $code)->exists());

        return $code;
    }
}
