<?php

namespace App\Http\Controllers;

use App\Models\Idea;
use App\Models\User;
use App\Services\Moderation\ContentFilter;
use App\Support\Plugins\Plugins;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Дошка ідей: пропозиції, голоси, статус від команди. */
class IdeaController extends Controller
{
    public function index(Request $request): Response
    {
        app(Plugins::class)->ensure('ideas_board');
        $viewer = $request->user();
        $sort = $request->query('sort') === 'new' ? 'new' : 'top';
        $status = in_array($request->query('status'), Idea::STATUSES, true) ? (string) $request->query('status') : null;

        $ideas = Idea::query()->with('user')
            ->when($status !== null, fn (Builder $q) => $q->where('status', $status))
            ->when($status === null, fn (Builder $q) => $q->where('status', '!=', 'declined'))
            ->when($sort === 'top', fn (Builder $q) => $q->orderByDesc('votes_count'))
            ->orderByDesc('id')
            ->paginate(30)->withQueryString();
        $voted = DB::table('idea_votes')->where('user_id', $viewer->id)->whereIn('idea_id', $ideas->pluck('id'))->pluck('idea_id')->all();

        $ideas->setCollection($ideas->getCollection()->map(fn (Idea $idea) => [
            'id' => $idea->id,
            'title' => $idea->title,
            'body' => $idea->body,
            'status' => $idea->status,
            'answer' => $idea->answer,
            'votes' => $idea->votes_count,
            'voted' => in_array($idea->id, $voted),
            'author' => $idea->user?->toCard(),
            'created_at' => $idea->created_at->toIso8601String(),
        ]));

        return Inertia::render('ideas/index', [
            'ideas' => Inertia::scroll(fn () => $ideas),
            'sort' => $sort,
            'status' => $status,
            'canManage' => $viewer->isStaff(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        app(Plugins::class)->ensure('ideas_board');
        $data = $request->validate(['title' => ['required', 'string', 'min:5', 'max:120'], 'body' => ['nullable', 'string', 'max:2000']]);
        $filter = app(ContentFilter::class);
        $filter->ensureCanPost($request->user());
        $idea = Idea::query()->create(['user_id' => $request->user()->id, 'title' => (string) $filter->clean(trim($data['title'])), 'body' => $filter->clean(trim((string) ($data['body'] ?? '')) ?: null)]);
        $this->vote($request->user(), $idea, true);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Ідею додано — нехай голосують!']);

        return back();
    }

    public function toggleVote(Request $request, Idea $idea): RedirectResponse
    {
        app(Plugins::class)->ensure('ideas_board');
        $has = DB::table('idea_votes')->where('idea_id', $idea->id)->where('user_id', $request->user()->id)->exists();
        $this->vote($request->user(), $idea, ! $has);

        return back();
    }

    /** Команда ставить статус і коротку відповідь (у журнал). */
    public function status(Request $request, Idea $idea): RedirectResponse
    {
        abort_unless($request->user()->isStaff(), 403);
        $data = $request->validate(['status' => ['required', Rule::in(Idea::STATUSES)], 'answer' => ['nullable', 'string', 'max:500']]);
        $idea->update(['status' => $data['status'], 'answer' => trim((string) ($data['answer'] ?? '')) ?: null]);
        Log::info('admin: idea status', ['idea' => $idea->id, 'status' => $data['status'], 'by' => $request->user()->id]);

        return back();
    }

    private function vote(User $user, Idea $idea, bool $on): void
    {
        if ($on) {
            DB::table('idea_votes')->insertOrIgnore(['idea_id' => $idea->id, 'user_id' => $user->id, 'created_at' => now()]);
        } else {
            DB::table('idea_votes')->where('idea_id', $idea->id)->where('user_id', $user->id)->delete();
        }
        $idea->forceFill(['votes_count' => DB::table('idea_votes')->where('idea_id', $idea->id)->count()])->save();
    }
}
