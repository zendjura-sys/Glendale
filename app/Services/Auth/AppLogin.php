<?php

namespace App\Services\Auth;

use App\Models\AppLoginRequest;
use App\Models\User;
use App\Services\Geo\VisitorCountry;
use App\Services\Push\PushNotifier;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * «Увійти через застосунок GameCon»: браузер створює запит і показує QR та 2 цифри,
 * людина в застосунку (де вже увійшла) вибирає ці цифри й підтверджує — браузер входить.
 */
class AppLogin
{
    /** Скільки живе запит, секунд. */
    public const TTL = 120;

    /** Скільки підтверджений запит чекає, поки браузер його забере, секунд. */
    public const CONSUME_WINDOW = 60;

    public function __construct(
        private readonly AccountSecurity $security,
        private readonly PushNotifier $push,
        private readonly VisitorCountry $country,
        private readonly SiteSettings $settings,
    ) {}

    /**
     * Новий запит. Секрет повертається лише браузеру, у базі — його хеш.
     * Якщо вказано логін і в людини є застосунок — надсилаємо push. Чи існує логін, не розкриваємо.
     *
     * @return array{0: AppLoginRequest, 1: string}
     */
    public function create(Request $request, ?string $login): array
    {
        $secret = Str::random(48);
        $login = $login !== null ? trim($login) : null;
        $login = $login !== '' ? $login : null;

        $entry = AppLoginRequest::query()->create([
            'login_hint' => $login !== null ? Str::limit($login, 255, '') : null,
            'secret_hash' => hash('sha256', $secret),
            'code' => (string) random_int(10, 99),
            'status' => AppLoginRequest::PENDING,
            'ip' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
            'country' => $this->country->of($request),
            'city' => $this->city($request),
            'expires_at' => now()->addSeconds(self::TTL),
        ]);

        $user = $login !== null ? $this->findByLogin($login) : null;
        if ($user !== null && ! $user->isBanned()) {
            rescue(fn () => $this->push->appLogin($user, $entry), report: true);
        }

        return [$entry, $secret];
    }

    public function owns(AppLoginRequest $entry, string $secret): bool
    {
        return $secret !== '' && hash_equals($entry->secret_hash, hash('sha256', $secret));
    }

    /**
     * Стан для браузера. Використаний запит — «expired»: вдруге ним не увійти.
     */
    public function status(AppLoginRequest $entry): string
    {
        return match (true) {
            $entry->consumed_at !== null => 'expired',
            $entry->status === AppLoginRequest::DENIED => 'denied',
            $entry->status === AppLoginRequest::APPROVED => $this->consumable($entry) ? 'approved' : 'expired',
            $entry->isExpired() => 'expired',
            default => 'pending',
        };
    }

    /**
     * Браузер забирає підтверджений запит і входить (один раз). Null — увійти не можна.
     *
     * Другий фактор: підтвердження із застосунку, де людина вже увійшла (зокрема з кодом 2FA),
     * — це вже довірений пристрій і другий фактор, тому TOTP-код тут удруге не питаємо.
     */
    public function consume(Request $request, AppLoginRequest $entry): ?User
    {
        $user = $entry->user;
        if ($user === null || $this->status($entry) !== 'approved') {
            return null;
        }
        // Заблокований після підтвердження — ті самі правила, що й для звичайного входу.
        if ($user->isBanned()) {
            $entry->forceFill(['status' => AppLoginRequest::DENIED])->save();
            $this->security->logLogin($user, 'app', false, $request);

            return null;
        }

        $taken = AppLoginRequest::query()
            ->whereKey($entry->id)
            ->where('status', AppLoginRequest::APPROVED)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => now(), 'updated_at' => now()]);
        if ($taken !== 1) {
            return null;
        }

        // Подія Login сама запише вхід у журнал (метод «app» — за назвою маршруту login.app.*).
        Auth::guard('web')->login($user, false);
        $request->session()->regenerate();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Вхід підтверджено в застосунку']);
        $this->audit('consumed', $entry, $user);

        return $user;
    }

    /**
     * Що бачить застосунок: звідки просять вхід і три варіанти коду (справжній + 2 випадкові).
     *
     * @return array<string, mixed>
     */
    public function details(AppLoginRequest $entry): array
    {
        [$browser, $os] = array_pad(explode(' · ', AccountSecurity::device($entry->user_agent), 2), 2, null);

        return [
            'id' => $entry->id,
            'browser' => $browser,
            'os' => $os,
            'ip_country' => $entry->country,
            'ip_city' => $entry->city,
            'created_at' => $entry->created_at->toIso8601String(),
            'expires_at' => $entry->expires_at->toIso8601String(),
            'code_choices' => $this->choices($entry->code),
        ];
    }

    public function open(AppLoginRequest $entry): bool
    {
        return $this->status($entry) === 'pending';
    }

    /**
     * Підтвердження в застосунку. Неправильний код — запит відхиляється.
     */
    public function approve(AppLoginRequest $entry, User $user, string $code): void
    {
        abort_unless($this->open($entry), 410, 'Запит на вхід застарів.');
        abort_if($user->isBanned(), 403, 'Обліковий запис заблоковано.');
        if ($entry->login_hint !== null && $this->findByLogin($entry->login_hint)?->is($user) !== true) {
            abort(403, 'Цей запит на вхід створено для іншого акаунта.');
        }

        if (! hash_equals($entry->code, $code)) {
            $this->settle($entry, $user, AppLoginRequest::DENIED);
            $this->security->logLogin($user, 'app', false, ip: $entry->ip, agent: $entry->user_agent);
            $this->audit('wrong_code', $entry, $user);

            throw ValidationException::withMessages(['code' => 'Код не збігається — вхід скасовано.']);
        }

        abort_unless($this->settle($entry, $user, AppLoginRequest::APPROVED), 410, 'Запит на вхід застарів.');
        $this->audit('approved', $entry, $user);
    }

    public function deny(AppLoginRequest $entry, User $user): void
    {
        abort_unless($this->open($entry), 410, 'Запит на вхід застарів.');
        if ($this->settle($entry, $user, AppLoginRequest::DENIED)) {
            $this->security->logLogin($user, 'app', false, ip: $entry->ip, agent: $entry->user_agent);
            $this->audit('denied', $entry, $user);
        }
    }

    /** Атомарно закриває pending-запит: двічі підтвердити чи відхилити не вийде. */
    private function settle(AppLoginRequest $entry, User $user, string $status): bool
    {
        $done = AppLoginRequest::query()
            ->whereKey($entry->id)
            ->where('status', AppLoginRequest::PENDING)
            ->where('expires_at', '>', now())
            ->update([
                'status' => $status,
                'user_id' => $user->id,
                'approved_at' => $status === AppLoginRequest::APPROVED ? now() : null,
                'updated_at' => now(),
            ]);

        return $done === 1;
    }

    private function consumable(AppLoginRequest $entry): bool
    {
        return $entry->approved_at !== null && $entry->approved_at->gt(now()->subSeconds(self::CONSUME_WINDOW));
    }

    /**
     * @return list<string>
     */
    private function choices(string $code): array
    {
        $choices = [$code];
        while (count($choices) < 3) {
            $other = (string) random_int(10, 99);
            if (! in_array($other, $choices, true)) {
                $choices[] = $other;
            }
        }
        shuffle($choices);

        return $choices;
    }

    private function findByLogin(string $login): ?User
    {
        $login = mb_strtolower(trim($login));

        return str_contains($login, '@') && ! str_starts_with($login, '@')
            ? User::query()->where('email', $login)->first()
            : User::query()->where('username', ltrim($login, '@'))->first();
    }

    /** Місто — лише із заголовка Cloudflare (якщо в адмінці сказано, що сайт за ним). */
    private function city(Request $request): ?string
    {
        if ($this->settings->get('geo_trust_cloudflare') !== true) {
            return null;
        }
        $city = trim((string) $request->header('CF-IPCity'));

        return $city !== '' ? Str::limit($city, 80, '') : null;
    }

    private function audit(string $action, AppLoginRequest $entry, User $user): void
    {
        Log::info('app-login.'.$action, ['request' => $entry->id, 'user_id' => $user->id, 'ip' => $entry->ip]);
    }
}
