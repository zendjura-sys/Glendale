<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Clan;
use App\Models\ClanMember;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Адмінка → Клани: пошук, власник, учасники й видалення клану чи гільдії (у журнал). */
class ClanController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'type' => ['nullable', Rule::in(array_keys(Clan::TYPES))],
            'q' => ['nullable', 'string', 'max:60'],
            'sort' => ['nullable', Rule::in(['members', 'new'])],
        ]);

        $clans = Clan::query()->with(['owner', 'game'])
            ->when($filters['type'] ?? null, fn (Builder $q, string $t) => $q->where('type', $t))
            ->when($filters['q'] ?? null, fn (Builder $q, string $t) => $q->where(fn (Builder $q) => $q->where('name', 'like', "%{$t}%")->orWhere('tag', 'like', "%{$t}%")->orWhere('slug', 'like', "%{$t}%")))
            ->when(($filters['sort'] ?? 'members') === 'new', fn (Builder $q) => $q->latest('id'), fn (Builder $q) => $q->orderByDesc('members_count')->latest('id'))
            ->paginate(20)->withQueryString()
            ->through(fn (Clan $c) => [
                ...$c->toCard(),
                'description' => $c->description,
                'owner' => $c->owner?->toCard(),
                'created_at' => $c->created_at->toIso8601String(),
            ]);

        return Inertia::render('admin/clans', [
            'clans' => $clans,
            'filters' => ['type' => $filters['type'] ?? null, 'q' => $filters['q'] ?? '', 'sort' => $filters['sort'] ?? 'members'],
            'types' => Clan::TYPES,
            'stats' => [
                'clans' => Clan::query()->where('type', 'clan')->count(),
                'guilds' => Clan::query()->where('type', 'guild')->count(),
                'members' => ClanMember::query()->where('status', ClanMember::STATUS_ACTIVE)->count(),
            ],
        ]);
    }

    /** Видалити клан (м’яко, з журналом). Зі сторінки клану — повертаємо до каталогу. */
    public function destroy(Request $request, Clan $clan): RedirectResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:300']]);
        $clan->delete();
        Log::info('admin: clan deleted', ['clan' => $clan->id, 'slug' => $clan->slug, 'reason' => $data['reason'] ?? null, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => ($clan->type === 'guild' ? 'Гільдію' : 'Клан').' «'.$clan->name.'» видалено.']);

        return $request->boolean('from_page') ? redirect('/clans') : back();
    }
}
