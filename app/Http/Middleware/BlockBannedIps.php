<?php

namespace App\Http\Middleware;

use App\Models\SpamBlock;
use App\Models\User;
use App\Services\Antispam\IpBans;
use App\Support\Plugins\Plugins;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * Забанений IP (Адмінка → Антиспам) може читати сайт, але не надсилати нічого:
 * ні входу й реєстрації, ні записів, ні повідомлень. Адміністрацію не блокуємо.
 */
class BlockBannedIps
{
    private const OPEN = ['logout', 'api/livekit/webhook', 'billing/monobank/webhook', 'billing/google-play/rtdn', 'mail/unsubscribe/*'];

    public function __construct(private readonly IpBans $bans, private readonly Plugins $plugins) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethodSafe() || $request->is(...self::OPEN) || ! $this->plugins->on('ip_bans')) {
            return $next($request);
        }
        $user = $request->user();
        if ($user instanceof User && $user->isStaff()) {
            return $next($request);
        }
        $ban = $this->bans->banned($request->ip());
        if ($ban === null || $ban['community_id'] !== null) {
            return $next($request);
        }
        // У журнал — не частіше разу на хвилину з однієї адреси.
        $hash = IpBans::hash((string) $request->ip());
        if (Cache::add('antispam.ip-ban-logged.'.$hash, true, 60)) {
            SpamBlock::query()->create(['kind' => 'ip_ban', 'user_id' => $user?->id, 'ip_hash' => $hash, 'detail' => $request->path(), 'created_at' => now()]);
        }
        // Inertia-форма отримає тост, застосунок — JSON, браузер — сторінку 403.
        abort(403, 'Дії з вашої IP-адреси обмежено адміністрацією GameCon.');
    }
}
