<?php

namespace App\Services\Servers;

use App\Models\GtaServer;
use App\Models\User;
use App\Support\Net\PublicUrl;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Значок перевіреного сервера. Власник підтверджує, що сайт сервера — його: ставить на головну
 * сторінку метатег з кодом GameCon, і ми знаходимо його. Без сайту — запит на ручну перевірку
 * персоналом. Персонал може видати або зняти значок будь-коли (дії пишуться в журнал).
 */
class ServerVerification
{
    /** Мінімум днів на GameCon до перевірки — щоб не верифікували одноденки. */
    public const MIN_DAYS = 7;

    public function token(GtaServer $server): string
    {
        if (! $server->verify_token) {
            $server->forceFill(['verify_token' => Str::lower(Str::random(24))])->save();
        }

        return (string) $server->verify_token;
    }

    /**
     * Умови значка: що вже виконано.
     *
     * @return list<array{key: string, done: bool}>
     */
    public function requirements(GtaServer $server): array
    {
        return [
            ['key' => 'owner', 'done' => $server->owner_id !== null],
            ['key' => 'profile', 'done' => filled($server->description) && filled($server->icon_path ?? $server->icon_url)],
            ['key' => 'links', 'done' => filled($server->website) || filled($server->discord_invite)],
            ['key' => 'age', 'done' => $server->created_at !== null && $server->created_at->lte(now()->subDays(self::MIN_DAYS))],
        ];
    }

    /**
     * Блок для сторінки сервера (власнику — з кодом і умовами).
     *
     * @return array<string, mixed>
     */
    public function card(GtaServer $server, User $viewer): array
    {
        $owner = $server->owner_id === $viewer->id;

        return [
            'verified' => $server->verified_at !== null,
            'verified_at' => $server->verified_at?->toIso8601String(),
            'requested' => $server->verify_requested_at !== null,
            'can_manage' => $viewer->isStaff(),
            'requirements' => $owner ? $this->requirements($server) : null,
            'meta' => $owner && $server->verified_at === null ? '<meta name="gamecon-verify" content="'.$this->token($server).'">' : null,
            'has_website' => filled($server->website),
        ];
    }

    /** Власник: перевірити метатег на сайті й видати значок. */
    public function check(GtaServer $server, User $owner): void
    {
        abort_unless($server->owner_id === $owner->id, 403);
        $this->ensureRequirements($server);
        $url = (string) $server->website;
        if (! preg_match('#^https?://#i', $url)) {
            throw ValidationException::withMessages(['verify' => 'У сервера немає сайту — надішліть запит на ручну перевірку.']);
        }
        // Лише публічні адреси (захист від SSRF): з'єднуємось на перевірений IP, без переадресацій.
        $inspected = app(PublicUrl::class)->inspect($url);
        if ($inspected['reason'] !== null) {
            throw ValidationException::withMessages(['verify' => 'Адреса сайту недоступна для перевірки.']);
        }
        $options = ['allow_redirects' => false];
        $resolve = PublicUrl::curlResolve($inspected);
        if ($resolve !== [] && defined('CURLOPT_RESOLVE')) {
            $options['curl'] = [CURLOPT_RESOLVE => $resolve];
        }
        try {
            $html = Http::connectTimeout(5)->timeout(8)->withUserAgent('GameConBot/1.0 (+https://gamecon.online)')
                ->withOptions($options)->get($url)->body();
        } catch (\Throwable) {
            throw ValidationException::withMessages(['verify' => 'Не вдалося відкрити сайт сервера. Спробуйте пізніше.']);
        }
        $token = preg_quote($this->token($server), '/');
        if (preg_match('/gamecon-verify["\']?\s+content=["\']'.$token.'["\']|content=["\']'.$token.'["\']\s+name=["\']gamecon-verify/i', mb_substr($html, 0, 512_000)) !== 1) {
            throw ValidationException::withMessages(['verify' => 'Метатег з кодом не знайдено на головній сторінці сайту.']);
        }
        $server->forceFill(['verified_at' => now(), 'verified_by' => null, 'verify_requested_at' => null])->save();
        Log::info('servers: verified by website meta', ['server' => $server->id, 'owner' => $owner->id]);
    }

    /** Власник без сайту: запит на ручну перевірку. */
    public function request(GtaServer $server, User $owner): void
    {
        abort_unless($server->owner_id === $owner->id, 403);
        $this->ensureRequirements($server);
        $server->forceFill(['verify_requested_at' => now()])->save();
        Log::info('servers: verification requested', ['server' => $server->id, 'owner' => $owner->id]);
    }

    /** Персонал: видати або зняти значок. */
    public function set(GtaServer $server, User $staff, bool $verified): void
    {
        $server->forceFill([
            'verified_at' => $verified ? now() : null,
            'verified_by' => $verified ? $staff->id : null,
            'verify_requested_at' => null,
        ])->save();
        Log::info('admin: server verification '.($verified ? 'granted' : 'revoked'), ['server' => $server->id, 'admin' => $staff->id]);
    }

    private function ensureRequirements(GtaServer $server): void
    {
        if (collect($this->requirements($server))->contains('done', false)) {
            throw ValidationException::withMessages(['verify' => 'Спершу виконайте всі умови значка.']);
        }
    }
}
