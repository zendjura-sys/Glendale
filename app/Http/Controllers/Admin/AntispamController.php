<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\IpBan;
use App\Models\SpamBlock;
use App\Services\Antispam\IpBans;
use App\Services\Antispam\IpLog;
use App\Services\Antispam\LinkFilter;
use App\Support\Plugins\Plugins;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Адмінка → Антиспам: фільтр доменів, бани за IP (і гостей), журнал IP, що зупинив антиспам. */
class AntispamController extends Controller
{
    public function __construct(private readonly IpBans $bans) {}

    public function index(Request $request, LinkFilter $links, IpLog $log): Response
    {
        $plugins = app(Plugins::class);

        return Inertia::render('admin/antispam', [
            'links' => [...$links->config(), 'on' => $plugins->on('link_filter')],
            'bans_on' => $plugins->on('ip_bans'),
            'bans' => IpBan::query()->active()->with(['author', 'community'])->latest('id')->limit(200)->get()
                ->map(fn (IpBan $ban) => [
                    'id' => $ban->id,
                    'ip' => $ban->ip,
                    'guest' => $ban->ip_hash !== null ? ($ban->label ?? 'Гість') : null,
                    'community' => $ban->community?->name,
                    'reason' => $ban->reason,
                    'expires_at' => $ban->expires_at?->toIso8601String(),
                    'created_at' => $ban->created_at->toIso8601String(),
                    'by' => $ban->author?->name,
                ])->values(),
            'log' => $log->lookup((string) $request->query('q', '')),
            'recent' => SpamBlock::query()->with('user')->latest('id')->limit(40)->get()
                ->map(fn (SpamBlock $block) => [
                    'id' => $block->id,
                    'kind' => SpamBlock::KINDS[$block->kind] ?? $block->kind,
                    'user' => $block->user?->toCard(),
                    'detail' => $block->detail,
                    'created_at' => $block->created_at->toIso8601String(),
                ])->values(),
        ]);
    }

    public function links(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'mode' => ['required', Rule::in(LinkFilter::MODES)],
            'blocked' => ['nullable', 'string', 'max:20000'],
            'allowed' => ['nullable', 'string', 'max:20000'],
        ]);
        $config = [
            'mode' => $data['mode'],
            'blocked' => LinkFilter::domains($data['blocked'] ?? ''),
            'allowed' => LinkFilter::domains($data['allowed'] ?? ''),
        ];
        app(SiteSettings::class)->put(['link_filter' => $config]);
        Log::info('admin: link filter', ['mode' => $config['mode'], 'blocked' => count($config['blocked']), 'allowed' => count($config['allowed']), 'by' => $request->user()?->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Фільтр доменів збережено.']);

        return back();
    }

    public function ban(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'ip' => ['required', 'string', 'max:64'],
            'reason' => ['nullable', 'string', 'max:200'],
            'days' => ['nullable', 'integer', Rule::in([1, 7, 30, 365])],
        ]);
        abort_if(trim($data['ip']) === (string) $request->ip(), 422, 'Це ваша власна адреса — так ви заблокуєте себе.');
        $this->bans->banIp($request->user(), $data['ip'], $data['reason'] ?? null, isset($data['days']) ? (int) $data['days'] : null);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Адресу заблоковано.']);

        return back();
    }

    public function lift(Request $request, IpBan $ban): RedirectResponse
    {
        $this->bans->lift($ban, $request->user());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Бан знято.']);

        return back();
    }
}
