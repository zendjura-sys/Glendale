<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\CommunityEvent;
use App\Models\CommunityMember;
use App\Models\CommunityWikiPage;
use App\Models\Story;
use App\Models\User;
use App\Services\Communities\CommunityPoints;
use App\Services\CommunityService;
use App\Services\Moderation\ContentFilter;
use App\Services\Stories;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Календар і події спільноти зі спільними історіями, вікі з історією правок, бали учасників. */
class CommunityHubController extends Controller
{
    public function __construct(
        private readonly CommunityService $communities,
        private readonly CommunityPoints $points,
    ) {}

    /** Бічний блок на сторінці спільноти: найближчі події, вікі, найактивніші. */
    public function hub(Request $request, Community $community): JsonResponse
    {
        $this->authorizeView($request, $community);
        $plugins = app(Plugins::class);

        return response()->json([
            'events' => $plugins->on('community_calendar') ? CommunityEvent::query()->where('community_id', $community->id)
                ->where('starts_at', '>=', now()->subHours(6))->orderBy('starts_at')->limit(3)->get()
                ->map(fn (CommunityEvent $e) => $this->eventCard($e, $request->user()))->values()->all() : null,
            'wiki' => $plugins->on('community_wiki') ? CommunityWikiPage::query()->where('community_id', $community->id)->count() : null,
            'top' => $plugins->on('community_points') ? $this->points->top($community, 5) : null,
            'can_manage' => $this->manages($request->user(), $community),
        ]);
    }

    public function calendar(Request $request, Community $community): Response
    {
        app(Plugins::class)->ensure('community_calendar');
        $this->authorizeView($request, $community);
        // Завжди перше число: інакше Carbon бере сьогоднішній день, і 31-го «листопад» стає груднем.
        $month = Carbon::createFromFormat('!Y-m', (string) $request->query('month', now('Europe/Kyiv')->format('Y-m')), 'Europe/Kyiv') ?: now('Europe/Kyiv')->startOfMonth();
        $from = $month->copy()->startOfMonth()->startOfWeek();
        $to = $month->copy()->endOfMonth()->endOfWeek();

        return Inertia::render('communities/calendar', [
            'community' => $community->toCard(),
            'month' => $month->format('Y-m'),
            'events' => CommunityEvent::query()->where('community_id', $community->id)
                ->whereBetween('starts_at', [$from->copy()->utc(), $to->copy()->utc()])->orderBy('starts_at')->get()
                ->map(fn (CommunityEvent $e) => $this->eventCard($e, $request->user()))->values()->all(),
            'upcoming' => CommunityEvent::query()->where('community_id', $community->id)->where('starts_at', '>=', now())
                ->orderBy('starts_at')->limit(10)->get()->map(fn (CommunityEvent $e) => $this->eventCard($e, $request->user()))->values()->all(),
            'can' => ['manage' => $this->manages($request->user(), $community), 'member' => $this->isMember($request->user(), $community)],
        ]);
    }

    public function storeEvent(Request $request, Community $community): RedirectResponse
    {
        app(Plugins::class)->ensure('community_calendar');
        abort_unless($this->manages($request->user(), $community), 403);
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'place' => ['nullable', 'string', 'max:120'],
            'starts_at' => ['required', 'date', 'after:now'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
        ]);
        $filter = app(ContentFilter::class);
        CommunityEvent::query()->create([
            'community_id' => $community->id,
            'user_id' => $request->user()->id,
            'title' => (string) $filter->clean(trim($data['title'])),
            'description' => $filter->clean($data['description'] ?? null),
            'place' => $data['place'] ?? null,
            'starts_at' => Carbon::parse($data['starts_at']),
            'ends_at' => isset($data['ends_at']) ? Carbon::parse($data['ends_at']) : null,
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Подію додано в календар.']);

        return back();
    }

    public function destroyEvent(Request $request, Community $community, CommunityEvent $event): RedirectResponse
    {
        abort_unless($event->community_id === $community->id, 404);
        abort_unless($this->manages($request->user(), $community), 403);
        $event->delete();
        Log::info('community: event deleted', ['community' => $community->id, 'event' => $event->id, 'by' => $request->user()->id]);

        return back();
    }

    public function rsvp(Request $request, Community $community, CommunityEvent $event): RedirectResponse
    {
        abort_unless($event->community_id === $community->id, 404);
        $user = $request->user();
        abort_unless($this->isMember($user, $community), 403, 'Відмітитися можуть учасники спільноти.');
        $data = $request->validate(['status' => ['required', Rule::in(['going', 'maybe', 'none'])]]);
        $key = ['event_id' => $event->id, 'user_id' => $user->id];
        $before = DB::table('community_event_rsvps')->where($key)->value('status');
        if ($data['status'] === 'none') {
            DB::table('community_event_rsvps')->where($key)->delete();
        } else {
            DB::table('community_event_rsvps')->updateOrInsert($key, ['status' => $data['status'], 'updated_at' => now(), 'created_at' => now()]);
        }
        $event->forceFill(['going_count' => DB::table('community_event_rsvps')->where('event_id', $event->id)->where('status', 'going')->count()])->save();
        if ($data['status'] === 'going' && $before === null) {
            $this->points->award($community->id, $user->id, CommunityPoints::EVENT);
        }

        return back();
    }

    /** Спільні історії події: усі активні історії учасників, привʼязані до неї. */
    public function eventStories(Request $request, Community $community, CommunityEvent $event, Stories $stories): JsonResponse
    {
        abort_unless($event->community_id === $community->id, 404);
        $this->authorizeView($request, $community);

        return response()->json(['stories' => Story::query()->with('user')->where('community_event_id', $event->id)
            ->where('expires_at', '>', now())->orderBy('id')->limit(60)->get()
            ->map(fn (Story $s) => [...$stories->present($s, $request->user(), true), 'author' => $s->user?->toCard()])->values()->all()]);
    }

    public function storeEventStory(Request $request, Community $community, CommunityEvent $event, Stories $stories): JsonResponse
    {
        app(Plugins::class)->ensure('event_stories');
        abort_unless($event->community_id === $community->id, 404);
        abort_unless($this->isMember($request->user(), $community), 403, 'Історії до події додають учасники спільноти.');
        abort_if($event->starts_at->isAfter(now()->addHours(2)), 422, 'Історії до події — коли вона вже почалася.');
        $data = $request->validate([
            'media' => ['required', 'file', 'mimetypes:image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime', 'max:51200'],
            'caption' => ['nullable', 'string', 'max:200'],
        ]);
        $file = $request->file('media');
        abort_if($file === null, 422);
        $story = $stories->create($request->user(), $file, $data['caption'] ?? null, Story::PRIVACY_FRIENDS, null);
        $story->forceFill(['community_event_id' => $event->id])->save();

        return $this->eventStories($request, $community, $event, $stories);
    }

    public function wikiIndex(Request $request, Community $community): Response
    {
        app(Plugins::class)->ensure('community_wiki');
        $this->authorizeView($request, $community);

        return Inertia::render('communities/wiki', [
            'community' => $community->toCard(),
            'pages' => CommunityWikiPage::query()->where('community_id', $community->id)->orderBy('title')->get(['id', 'slug', 'title', 'updated_at'])
                ->map(fn (CommunityWikiPage $p) => ['slug' => $p->slug, 'title' => $p->title, 'updated_at' => $p->updated_at->toIso8601String()])->values()->all(),
            'page' => null,
            'can_edit' => $this->canEditWiki($request->user(), $community),
        ]);
    }

    public function wikiShow(Request $request, Community $community, string $slug): Response
    {
        app(Plugins::class)->ensure('community_wiki');
        $this->authorizeView($request, $community);
        $page = CommunityWikiPage::query()->with('editor')->where('community_id', $community->id)->where('slug', $slug)->firstOrFail();

        return Inertia::render('communities/wiki', [
            'community' => $community->toCard(),
            'pages' => CommunityWikiPage::query()->where('community_id', $community->id)->orderBy('title')->get(['slug', 'title'])
                ->map(fn (CommunityWikiPage $p) => ['slug' => $p->slug, 'title' => $p->title])->values()->all(),
            'page' => [
                'slug' => $page->slug,
                'title' => $page->title,
                'body' => $page->body,
                'editor' => $page->editor?->toCard(),
                'updated_at' => $page->updated_at->toIso8601String(),
                'revisions' => DB::table('community_wiki_revisions')->leftJoin('users', 'users.id', '=', 'community_wiki_revisions.user_id')
                    ->where('page_id', $page->id)->orderByDesc('community_wiki_revisions.id')->limit(20)
                    ->get(['community_wiki_revisions.id', 'community_wiki_revisions.title', 'community_wiki_revisions.created_at', 'users.name'])
                    ->map(fn ($r) => ['id' => (int) $r->id, 'title' => (string) $r->title, 'author' => $r->name, 'created_at' => Carbon::parse($r->created_at)->toIso8601String()])->values()->all(),
            ],
            'can_edit' => $this->canEditWiki($request->user(), $community),
        ]);
    }

    /** Створити чи змінити сторінку (попередня версія йде в історію). */
    public function wikiSave(Request $request, Community $community): RedirectResponse
    {
        app(Plugins::class)->ensure('community_wiki');
        abort_unless($this->canEditWiki($request->user(), $community), 403);
        $data = $request->validate([
            'slug' => ['nullable', 'string', 'max:60'],
            'title' => ['required', 'string', 'min:2', 'max:120'],
            'body' => ['required', 'string', 'max:50000'],
        ]);
        $filter = app(ContentFilter::class);
        $page = isset($data['slug']) ? CommunityWikiPage::query()->where('community_id', $community->id)->where('slug', $data['slug'])->first() : null;
        if ($page === null) {
            abort_if(CommunityWikiPage::query()->where('community_id', $community->id)->count() >= 200, 422, 'У вікі вже 200 сторінок.');
            $base = Str::slug($data['title']) ?: 'page';
            $slug = $base;
            for ($i = 2; CommunityWikiPage::query()->where('community_id', $community->id)->where('slug', $slug)->exists(); $i++) {
                $slug = $base.'-'.$i;
            }
            $page = new CommunityWikiPage(['community_id' => $community->id, 'slug' => mb_substr($slug, 0, 60)]);
        } else {
            DB::table('community_wiki_revisions')->insert(['page_id' => $page->id, 'user_id' => $page->updated_by, 'title' => $page->title, 'body' => $page->body, 'created_at' => $page->updated_at]);
        }
        $page->fill(['title' => trim($data['title']), 'body' => (string) $filter->clean($data['body']), 'updated_by' => $request->user()->id])->save();

        return to_route('communities.wiki.show', [$community, $page->slug]);
    }

    /** Повернути попередню версію (поточна теж іде в історію). */
    public function wikiRevert(Request $request, Community $community, string $slug, int $revision): RedirectResponse
    {
        abort_unless($this->canEditWiki($request->user(), $community), 403);
        $page = CommunityWikiPage::query()->where('community_id', $community->id)->where('slug', $slug)->firstOrFail();
        $old = DB::table('community_wiki_revisions')->where('page_id', $page->id)->where('id', $revision)->first();
        abort_if($old === null, 404);
        DB::table('community_wiki_revisions')->insert(['page_id' => $page->id, 'user_id' => $page->updated_by, 'title' => $page->title, 'body' => $page->body, 'created_at' => $page->updated_at]);
        $page->update(['title' => $old->title, 'body' => $old->body, 'updated_by' => $request->user()->id]);
        Log::info('community: wiki reverted', ['community' => $community->id, 'page' => $page->id, 'revision' => $revision, 'by' => $request->user()->id]);

        return to_route('communities.wiki.show', [$community, $page->slug]);
    }

    public function wikiDestroy(Request $request, Community $community, string $slug): RedirectResponse
    {
        abort_unless($this->manages($request->user(), $community), 403);
        CommunityWikiPage::query()->where('community_id', $community->id)->where('slug', $slug)->delete();
        Log::info('community: wiki page deleted', ['community' => $community->id, 'slug' => $slug, 'by' => $request->user()->id]);

        return to_route('communities.wiki.index', $community);
    }

    /** Керівник додає чи знімає бали учаснику (у журнал). */
    public function grantPoints(Request $request, Community $community, User $user): RedirectResponse
    {
        app(Plugins::class)->ensure('community_points');
        abort_unless($this->manages($request->user(), $community), 403);
        $data = $request->validate(['points' => ['required', 'integer', 'between:-1000,1000', 'not_in:0']]);
        $this->points->award($community->id, $user->id, (int) $data['points']);
        Log::info('community: points granted', ['community' => $community->id, 'user' => $user->id, 'points' => (int) $data['points'], 'by' => $request->user()->id]);

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function eventCard(CommunityEvent $event, ?User $viewer): array
    {
        return [
            'id' => $event->id,
            'title' => $event->title,
            'description' => $event->description,
            'place' => $event->place,
            'starts_at' => $event->starts_at->toIso8601String(),
            'ends_at' => $event->ends_at?->toIso8601String(),
            'going' => $event->going_count,
            'my' => $viewer ? DB::table('community_event_rsvps')->where('event_id', $event->id)->where('user_id', $viewer->id)->value('status') : null,
            'stories' => Story::query()->where('community_event_id', $event->id)->where('expires_at', '>', now())->count(),
        ];
    }

    private function authorizeView(Request $request, Community $community): void
    {
        abort_unless($this->communities->canView($community, $request->user()), 403);
    }

    private function isMember(?User $user, Community $community): bool
    {
        return $user !== null && $community->membershipFor($user)?->status === CommunityMember::STATUS_ACTIVE;
    }

    private function manages(?User $user, Community $community): bool
    {
        return $user !== null && ((bool) $community->membershipFor($user)?->isManager() || $user->isStaff());
    }

    private function canEditWiki(?User $user, Community $community): bool
    {
        return $this->manages($user, $community) || ($community->wiki_open && $this->isMember($user, $community));
    }
}
