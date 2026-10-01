<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\ServerController as PublicServerController;
use App\Models\GtaServer;
use App\Services\Servers\ServerCatalog;
use App\Services\Servers\ServerDirectory;
use App\Services\Servers\ServerIconFetcher;
use App\Support\Settings\SiteSettings;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ServerController extends Controller
{
    public function __construct(
        private readonly ServerDirectory $directory,
        private readonly ServerIconFetcher $icons,
        private readonly SiteSettings $settings,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in([...GtaServer::STATUSES, 'trashed'])],
            'q' => ['nullable', 'string', 'max:60'],
        ]);
        $status = $filters['status'] ?? GtaServer::STATUS_PUBLISHED;

        $servers = GtaServer::query()
            ->with('suggester')
            ->withCount('families')
            ->when($status === 'trashed', fn (Builder $q) => $q->onlyTrashed(), fn (Builder $q) => $q->where('status', $status))
            ->when($filters['q'] ?? null, fn (Builder $q, string $t) => $q->where('name', 'like', "%{$t}%"))
            ->orderByDesc('is_featured')
            ->orderBy('position')
            ->orderBy('name')
            ->get()
            ->map(fn (GtaServer $s) => [
                ...$s->toCard(),
                'description' => $s->description,
                'discord_invite' => $s->discord_invite,
                'icon_url' => $s->icon_url,
                'icon_source' => $s->icon_source,
                'icon_fetched_at' => $s->icon_fetched_at?->toIso8601String(),
                'status' => $s->status,
                'origin' => $s->origin,
                'origin_label' => GtaServer::ORIGINS[$s->origin] ?? $s->origin,
                'review_note' => $s->review_note,
                'position' => $s->position,
                'suggester' => $s->suggester?->toCard(),
                'created_at' => $s->created_at->toIso8601String(),
                'deleted_at' => $s->deleted_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/servers', [
            'servers' => $servers,
            'filters' => ['status' => $status, 'q' => $filters['q'] ?? ''],
            'counts' => [
                GtaServer::STATUS_PUBLISHED => GtaServer::query()->where('status', GtaServer::STATUS_PUBLISHED)->count(),
                GtaServer::STATUS_PENDING => GtaServer::query()->where('status', GtaServer::STATUS_PENDING)->count(),
                GtaServer::STATUS_REJECTED => GtaServer::query()->where('status', GtaServer::STATUS_REJECTED)->count(),
                'trashed' => GtaServer::onlyTrashed()->count(),
            ],
            'options' => ['platforms' => GtaServer::PLATFORMS, 'multiplayers' => GtaServer::MULTIPLAYERS],
            'auto_publish' => (bool) $this->settings->get('servers_auto_publish'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([...PublicServerController::rules(), ...$this->extraRules()], PublicServerController::messages());

        $server = GtaServer::query()->create([
            ...PublicServerController::payload($data),
            'slug' => $this->directory->uniqueSlug($data['name']),
            'status' => GtaServer::STATUS_PUBLISHED,
            'origin' => 'manual',
            'is_featured' => (bool) ($data['is_featured'] ?? false),
            'position' => (int) ($data['position'] ?? 0),
        ]);
        $this->applyIcon($request, $server);
        rescue(fn () => $this->directory->refreshStats($server), report: false);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Сервер «{$server->name}» додано".($server->icon_path ? ' — іконку підтягнуто.' : '. Іконку не знайдено — завантажте вручну.')]);

        return back();
    }

    public function update(Request $request, GtaServer $server): RedirectResponse
    {
        $data = $request->validate([...PublicServerController::rules(), ...$this->extraRules()], PublicServerController::messages());
        $linksChanged = $server->website !== ($data['website'] ?? null)
            || $server->discord_invite !== PublicServerController::payload($data)['discord_invite']
            || $server->icon_url !== ($data['icon_url'] ?? null);

        $server->update([
            ...PublicServerController::payload($data),
            'is_featured' => (bool) ($data['is_featured'] ?? false),
            'position' => (int) ($data['position'] ?? 0),
        ]);

        if ($request->hasFile('icon') || ($linksChanged && $server->icon_source !== 'upload') || $request->boolean('refetch_icon')) {
            $this->applyIcon($request, $server, force: true);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Сервер оновлено.']);

        return back();
    }

    public function moderate(Request $request, GtaServer $server): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(GtaServer::STATUSES)],
            'review_note' => ['nullable', 'string', 'max:300'],
        ]);

        $server->update($data);
        if ($data['status'] === GtaServer::STATUS_PUBLISHED) {
            rescue(fn () => $this->directory->refreshStats($server), report: false);
            if (! $server->icon_path) {
                rescue(fn () => $this->icons->fetch($server), report: false);
            }
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => $data['status'] === GtaServer::STATUS_PUBLISHED ? "«{$server->name}» опубліковано." : 'Статус змінено.']);

        return back();
    }

    public function refresh(GtaServer $server): RedirectResponse
    {
        $source = $server->icon_source === 'upload' ? 'upload' : $this->icons->fetch($server);
        $this->directory->refreshStats($server);

        Inertia::flash('toast', ['type' => $source ? 'success' : 'error', 'message' => $source ? 'Іконку й онлайн оновлено.' : 'Онлайн оновлено, але іконку автоматично не знайдено.']);

        return back();
    }

    public function destroy(GtaServer $server): RedirectResponse
    {
        $server->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Сервер приховано з каталогу.']);

        return back();
    }

    public function restore(int $server): RedirectResponse
    {
        GtaServer::onlyTrashed()->findOrFail($server)->restore();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Сервер відновлено.']);

        return back();
    }

    public function sync(Request $request, ServerCatalog $catalog): RedirectResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['seed', 'discover', 'stats'])],
        ]);

        if ($data['action'] === 'stats') {
            $message = 'Онлайн оновлено: '.$this->directory->refreshStats()['updated'];
        } else {
            $created = $data['action'] === 'seed' ? $catalog->import() : $this->directory->discover();
            foreach ($created as $server) {
                rescue(fn () => $this->icons->fetch($server), report: false);
            }
            $message = ($data['action'] === 'seed' ? 'Додано з базового списку: ' : 'Знайдено нових серверів: ').count($created);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }

    public function settings(Request $request): RedirectResponse
    {
        $data = $request->validate(['auto_publish' => ['required', 'boolean']]);
        $this->settings->put(['servers_auto_publish' => $data['auto_publish']]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування каталогу збережено.']);

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function extraRules(): array
    {
        return [
            'icon' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp,gif', 'max:4096'],
            'is_featured' => ['sometimes', 'boolean'],
            'position' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'refetch_icon' => ['sometimes', 'boolean'],
        ];
    }

    private function applyIcon(Request $request, GtaServer $server, bool $force = false): void
    {
        $file = $request->file('icon');
        if ($file && $this->icons->storeUpload($server, (string) file_get_contents((string) $file->getRealPath()))) {
            return;
        }
        if ($force || ! $server->icon_path) {
            rescue(fn () => $this->icons->fetch($server), report: false);
        }
    }
}
