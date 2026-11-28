<?php

namespace App\Services\Developer;

use App\Models\DeveloperApp;
use App\Models\User;
use App\Services\Billing\Wallet;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Платний пакет для розробників GameCon Dev Pro (№305): 30 днів за баланс GameCon. Що входить,
 * ціну й ліміти адміністратор обирає в Інтеграціях («Пакет для розробників»):
 * більше застосунків, вищий ліміт API, ШІ-відповіді для форумів і ботів (з місячною квотою),
 * пріоритет у підтримці.
 */
class DeveloperPro
{
    /** Функції пакета → налаштування-перемикач в адмінці й опис для порталу. */
    public const FEATURES = [
        'apps' => ['setting' => 'dev_pro_f_apps', 'label' => 'Більше застосунків'],
        'rate' => ['setting' => 'dev_pro_f_rate', 'label' => 'Вищий ліміт запитів API'],
        'ai' => ['setting' => 'dev_pro_f_ai', 'label' => 'ШІ-відповіді для форуму й ботів'],
        'support' => ['setting' => 'dev_pro_f_support', 'label' => 'Пріоритет у підтримці'],
    ];

    public const DAYS = 30;

    public function __construct(private readonly SiteSettings $settings) {}

    /** Пакет продається (увімкнено в адмінці й є хоч одна функція). */
    public function offered(): bool
    {
        return $this->settings->get('dev_pro_enabled') === true && $this->features() !== [] && $this->price() > 0;
    }

    /** Ціна за 30 днів, од. балансу. */
    public function price(): int
    {
        return max(0, (int) $this->settings->get('dev_pro_price'));
    }

    /** @return list<string> увімкнені адміністратором функції */
    public function features(): array
    {
        return array_values(array_filter(array_keys(self::FEATURES), fn (string $key) => $this->settings->get(self::FEATURES[$key]['setting']) === true));
    }

    public function until(User $user): ?Carbon
    {
        $value = $user->pref('dev_pro_until');

        return is_string($value) ? Carbon::parse($value) : null;
    }

    public function active(User $user): bool
    {
        return $this->until($user)?->isFuture() ?? false;
    }

    /** Людина з Pro має цю функцію (функцію вимкнули в адмінці — діє одразу для всіх). */
    public function has(User $user, string $feature): bool
    {
        return in_array($feature, $this->features(), true) && $this->active($user);
    }

    public function appsLimit(User $user): int
    {
        return $this->has($user, 'apps') ? max(DeveloperApp::MAX_PER_USER, (int) ($this->settings->get('dev_pro_apps') ?: 30)) : DeveloperApp::MAX_PER_USER;
    }

    /** Ліміт запитів API за хвилину для застосунків власника (кеш на хвилину — без зайвих запитів у БД). */
    public function rateFor(int $ownerId, int $base): int
    {
        return (int) Cache::remember("devpro.rate.{$ownerId}", 60, function () use ($ownerId, $base) {
            $owner = User::query()->find($ownerId);

            return $owner !== null && $this->has($owner, 'rate') ? max($base, (int) ($this->settings->get('dev_pro_rate') ?: 600)) : $base;
        });
    }

    public function aiQuota(): int
    {
        return max(0, (int) ($this->settings->get('dev_pro_ai_quota') ?: 1000));
    }

    /** Скільки ШІ-відповідей власник уже використав цього місяця. */
    public function aiUsed(User $owner): int
    {
        return (int) Cache::get($this->aiKey($owner), 0);
    }

    /** Списати одну ШІ-відповідь із квоти; false — квота вичерпана. */
    public function takeAi(User $owner): bool
    {
        $key = $this->aiKey($owner);
        Cache::add($key, 0, now()->endOfMonth()->addDay());
        if ((int) Cache::get($key, 0) >= $this->aiQuota()) {
            return false;
        }
        Cache::increment($key);

        return true;
    }

    /** Купити чи продовжити на 30 днів (з поточної дати завершення, якщо ще діє). */
    public function purchase(User $user): Carbon
    {
        if (! $this->offered()) {
            throw ValidationException::withMessages(['pro' => 'Пакет для розробників зараз не продається.']);
        }

        $until = DB::transaction(function () use ($user) {
            $user = User::query()->lockForUpdate()->findOrFail($user->id);
            app(Wallet::class)->debit($user, $this->price() * 100, 'purchase', 'GameCon Dev Pro · '.self::DAYS.' днів', 'dev_pro');
            $from = $this->active($user) ? $this->until($user) : now();
            $until = ($from ?? now())->copy()->addDays(self::DAYS);
            $user->mergePref(['dev_pro_until' => $until->toIso8601String()]);

            return $until;
        });
        Cache::forget("devpro.rate.{$user->id}");
        $until = Carbon::instance($until);
        Log::info('developers: pro purchased', ['user' => $user->id, 'until' => $until->toIso8601String(), 'price' => $this->price()]);

        return $until;
    }

    /**
     * Для порталу: що входить, ціна, чи діє й до коли.
     *
     * @return array<string, mixed>
     */
    public function card(?User $user): array
    {
        $features = $this->features();

        return [
            'offered' => $this->offered(),
            'price' => $this->price(),
            'days' => self::DAYS,
            'features' => array_map(fn (string $key) => ['key' => $key, 'label' => self::FEATURES[$key]['label']], $features),
            'apps' => in_array('apps', $features, true) ? max(DeveloperApp::MAX_PER_USER, (int) ($this->settings->get('dev_pro_apps') ?: 30)) : null,
            'rate' => in_array('rate', $features, true) ? (int) ($this->settings->get('dev_pro_rate') ?: 600) : null,
            'ai_quota' => in_array('ai', $features, true) ? $this->aiQuota() : null,
            'active' => $user !== null && $this->active($user),
            'until' => $user !== null ? $this->until($user)?->toIso8601String() : null,
            'ai_used' => $user !== null ? $this->aiUsed($user) : 0,
        ];
    }

    private function aiKey(User $owner): string
    {
        return 'devpro.ai.'.$owner->id.'.'.now()->format('Y-m');
    }
}
