<?php

namespace App\Http\Controllers\Fun;

use App\Http\Controllers\Controller;
use App\Models\GameJournalEntry;
use App\Models\User;
use App\Services\Moderation\ContentFilter;
use App\Support\Plugins\Plugins;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Ігровий щоденник: що пройшов, як було, скільки грав. Записи приватні, якщо не позначено «Показувати в профілі». */
class GameJournalController extends Controller
{
    public function index(Request $request): Response
    {
        return $this->page($request, $request->user());
    }

    public function show(Request $request, User $user): Response
    {
        return $this->page($request, $user);
    }

    public function store(Request $request): RedirectResponse
    {
        app(Plugins::class)->ensure('game_journal');
        $data = $request->validate([
            'game_id' => ['nullable', 'integer', Rule::exists('games', 'id')],
            'body' => ['required', 'string', 'min:2', 'max:3000'],
            'mood' => ['required', Rule::in(GameJournalEntry::MOODS)],
            'minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
            'played_on' => ['nullable', 'date', 'before_or_equal:today', 'after:2000-01-01'],
            'is_public' => ['boolean'],
        ]);
        $filter = app(ContentFilter::class);
        if ($data['is_public'] ?? false) {
            $filter->ensureCanPost($request->user());
        }
        GameJournalEntry::query()->create([
            ...$data,
            'body' => (string) $filter->clean(trim($data['body'])),
            'user_id' => $request->user()->id,
            'played_on' => $data['played_on'] ?? today(),
            'is_public' => (bool) ($data['is_public'] ?? false),
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запис додано в щоденник.']);

        return back();
    }

    public function destroy(Request $request, GameJournalEntry $entry): RedirectResponse
    {
        app(Plugins::class)->ensure('game_journal');
        abort_unless($entry->user_id === $request->user()->id, 403);
        $entry->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запис видалено.']);

        return back();
    }

    private function page(Request $request, User $owner): Response
    {
        app(Plugins::class)->ensure('game_journal');
        $mine = $owner->id === $request->user()->id;
        $entries = GameJournalEntry::query()->with('game')
            ->where('user_id', $owner->id)
            ->when(! $mine, fn ($q) => $q->where('is_public', true))
            ->orderByDesc('played_on')->orderByDesc('id')
            ->paginate(30);
        $stats = GameJournalEntry::query()->where('user_id', $owner->id)->when(! $mine, fn ($q) => $q->where('is_public', true))
            ->selectRaw('count(*) as entries, coalesce(sum(minutes), 0) as minutes, count(distinct game_id) as games')->first();

        return Inertia::render('journal/index', [
            'owner' => $owner->toCard(),
            'mine' => $mine,
            'entries' => Inertia::scroll(fn () => $entries->through(fn (GameJournalEntry $e) => $e->toCard())),
            'stats' => [
                'entries' => (int) ($stats->entries ?? 0),
                'minutes' => (int) ($stats->minutes ?? 0),
                'games' => (int) ($stats->games ?? 0),
            ],
            'moods' => GameJournalEntry::MOODS,
        ]);
    }
}
