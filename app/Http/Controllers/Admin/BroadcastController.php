<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SendBroadcast;
use App\Models\Broadcast;
use App\Models\Community;
use App\Models\Game;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Розсилки: сповіщення в дзвіночок і push усім, власникам GameCon+, користувачам застосунку чи команді. */
class BroadcastController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/broadcasts', [
            'broadcasts' => Broadcast::query()->with('user')->latest()->limit(50)->get()->map(fn (Broadcast $b) => [
                'id' => $b->id,
                'title' => $b->title,
                'body' => $b->body,
                'url' => $b->url,
                'audience' => $b->audience,
                'filters' => $b->filters,
                'sent_count' => $b->sent_count,
                'finished' => $b->finished_at !== null,
                'by' => $b->user?->name,
                'created_at' => $b->created_at->toIso8601String(),
            ]),
            'segments' => [
                'countries' => User::query()->whereNotNull('country')->where('country', '!=', '')->select('country', DB::raw('count(*) as n'))->groupBy('country')->orderByDesc('n')->limit(30)->pluck('n', 'country'),
                'locales' => User::query()->whereNotNull('locale')->select('locale', DB::raw('count(*) as n'))->groupBy('locale')->orderByDesc('n')->pluck('n', 'locale'),
                'games' => Game::query()->where('is_published', true)->orderByDesc('popularity')->limit(80)->get(['id', 'name'])->map(fn (Game $g) => ['id' => $g->id, 'name' => $g->name]),
                'communities' => Community::query()->orderByDesc('members_count')->limit(60)->get(['id', 'name'])->map(fn (Community $c) => ['id' => $c->id, 'name' => $c->name]),
            ],
            'audiences' => array_combine(Broadcast::AUDIENCES, array_map(fn (string $a) => SendBroadcast::audience($a)->count(), Broadcast::AUDIENCES)),
        ]);
    }

    /** Скільки людей у сегменті (живий підрахунок у формі). */
    public function count(Request $request): JsonResponse
    {
        $data = $request->validate(['audience' => ['required', Rule::in(Broadcast::AUDIENCES)], ...$this->filterRules()]);

        return response()->json(['count' => SendBroadcast::audience($data['audience'], $this->filters($data))->count()]);
    }

    /**
     * @return array<string, mixed>
     */
    private function filterRules(): array
    {
        return [
            'country' => ['nullable', 'string', 'size:2'],
            'locale' => ['nullable', 'string', 'max:5'],
            'joined' => ['nullable', Rule::in(['week', 'month', 'old'])],
            'activity' => ['nullable', Rule::in(['active', 'dormant'])],
            'game_id' => ['nullable', 'integer', 'exists:games,id'],
            'community_id' => ['nullable', 'integer', 'exists:communities,id'],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function filters(array $data): array
    {
        return array_filter(array_intersect_key($data, array_flip(['country', 'locale', 'joined', 'activity', 'game_id', 'community_id'])), fn ($v) => $v !== null && $v !== '');
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:80'],
            'body' => ['required', 'string', 'min:3', 'max:500'],
            'url' => ['nullable', 'string', 'max:300', 'regex:#^(/[^\s]*|https://[^\s]+)$#'],
            'audience' => ['required', Rule::in(Broadcast::AUDIENCES)],
            ...$this->filterRules(),
        ]);
        $filters = $this->filters($data);
        abort_if(SendBroadcast::audience($data['audience'], $filters)->count() === 0, 422, 'У сегменті нікого немає.');
        $broadcast = Broadcast::query()->create([...array_diff_key($data, $filters), 'filters' => $filters ?: null, 'user_id' => $request->user()?->id]);
        SendBroadcast::dispatch($broadcast->id);
        Log::info('broadcast: queued', ['broadcast' => $broadcast->id, 'audience' => $broadcast->audience, 'filters' => $filters, 'by' => $request->user()?->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Розсилку поставлено в чергу — сповіщення підуть за кілька хвилин.']);

        return back();
    }
}
