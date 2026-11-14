<?php

namespace App\Http\Controllers\Fun;

use App\Http\Controllers\Controller;
use App\Models\Movie;
use App\Models\MovieList;
use App\Models\MovieListComment;
use App\Services\Moderation\ContentFilter;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

/** Добірки фільмів: популярні, мої, на які стежу; лайки, стеження, додавання зі сторінки тайтлу. */
class MovieListController extends Controller
{
    public function index(Request $request): Response
    {
        app(Plugins::class)->ensure('movie_lists');
        $viewer = $request->user();
        $tab = in_array($request->query('tab'), ['mine', 'following', 'new'], true) ? (string) $request->query('tab') : 'popular';
        $lists = MovieList::query()->with('user')
            ->when($tab === 'popular', fn ($q) => $q->where('is_public', true)->where('items_count', '>', 0)->orderByDesc('likes_count')->orderByDesc('followers_count'))
            ->when($tab === 'new', fn ($q) => $q->where('is_public', true)->where('items_count', '>', 0)->orderByDesc('created_at'))
            ->when($tab === 'mine', fn ($q) => $q->where('user_id', $viewer->id))
            ->when($tab === 'following', fn ($q) => $q->where('is_public', true)
                ->whereIn('id', DB::table('movie_list_follows')->where('user_id', $viewer->id)->select('movie_list_id')))
            ->orderByDesc('updated_at')->paginate(18)->withQueryString();

        return Inertia::render('cinema/lists', [
            'tab' => $tab,
            'lists' => Inertia::scroll(fn () => $lists->through(fn (MovieList $l) => $l->toCard())),
        ]);
    }

    public function show(Request $request, MovieList $list): Response
    {
        app(Plugins::class)->ensure('movie_lists');
        $viewer = $request->user();
        abort_unless($list->visibleTo($viewer), 404);
        $list->load('user');

        return Inertia::render('cinema/list', [
            'list' => [
                ...$list->toCard(),
                'mine' => $list->user_id === $viewer->id,
                'liked' => DB::table('movie_list_likes')->where('movie_list_id', $list->id)->where('user_id', $viewer->id)->exists(),
                'following' => DB::table('movie_list_follows')->where('movie_list_id', $list->id)->where('user_id', $viewer->id)->exists(),
            ],
            'movies' => $list->movies()->published()->get()->map(fn (Movie $m) => [...$m->toCard(), 'note' => $m->getRelationValue('pivot')?->note])->values(),
        ]);
    }

    public function store(Request $request, ContentFilter $filter): JsonResponse
    {
        app(Plugins::class)->ensure('movie_lists');
        $user = $request->user();
        abort_if(MovieList::query()->where('user_id', $user->id)->count() >= MovieList::MAX_LISTS, 422, 'Добірок уже '.MovieList::MAX_LISTS.' — видаліть зайву.');
        $data = $this->validated($request);
        $filter->ensureCanPost($user);
        $list = MovieList::query()->create([...$data, 'user_id' => $user->id, 'title' => (string) $filter->clean($data['title'])]);
        if ($request->filled('movie')) {
            $this->attach($list, (int) $request->integer('movie'));
        }

        return response()->json(['ok' => true, 'list' => $list->load('user')->toCard(), 'message' => 'Добірку створено.']);
    }

    public function update(Request $request, MovieList $list, ContentFilter $filter): JsonResponse
    {
        app(Plugins::class)->ensure('movie_lists');
        abort_unless($list->user_id === $request->user()->id, 403);
        $data = $this->validated($request);
        $list->update([...$data, 'title' => (string) $filter->clean($data['title'])]);

        return response()->json(['ok' => true, 'list' => $list->load('user')->toCard(), 'message' => 'Добірку збережено.']);
    }

    public function destroy(Request $request, MovieList $list): JsonResponse
    {
        app(Plugins::class)->ensure('movie_lists');
        abort_unless($list->user_id === $request->user()->id, 403);
        $list->delete();

        return response()->json(['ok' => true, 'message' => 'Добірку видалено.']);
    }

    /** Додати тайтл у добірку або прибрати з неї. */
    public function item(Request $request, MovieList $list): JsonResponse
    {
        app(Plugins::class)->ensure('movie_lists');
        abort_unless($list->user_id === $request->user()->id, 403);
        $data = $request->validate(['movie' => ['required', 'integer'], 'on' => ['required', 'boolean'], 'note' => ['nullable', 'string', 'max:200']]);
        if ($data['on']) {
            $this->attach($list, (int) $data['movie'], $data['note'] ?? null);
        } else {
            $list->movies()->detach((int) $data['movie']);
            $list->update(['items_count' => $list->movies()->count()]);
        }

        return response()->json(['ok' => true, 'items_count' => $list->items_count]);
    }

    /** Мої добірки для шторки «Додати в добірку» на сторінці тайтлу. */
    public function forMovie(Request $request, Movie $movie): JsonResponse
    {
        app(Plugins::class)->ensure('movie_lists');
        $user = $request->user();
        $inside = DB::table('movie_list_items')->where('movie_id', $movie->id)->pluck('movie_list_id')->map(fn ($id) => (int) $id)->all();

        return response()->json(['lists' => MovieList::query()->where('user_id', $user->id)->orderByDesc('updated_at')->get()
            ->map(fn (MovieList $l) => ['id' => $l->id, 'title' => $l->title, 'items_count' => $l->items_count, 'is_public' => $l->is_public, 'contains' => in_array($l->id, $inside, true)])->values()]);
    }

    public function like(Request $request, MovieList $list): JsonResponse
    {
        return $this->toggle($request, $list, 'movie_list_likes', 'likes_count', 'liked');
    }

    public function follow(Request $request, MovieList $list): JsonResponse
    {
        return $this->toggle($request, $list, 'movie_list_follows', 'followers_count', 'following');
    }

    /** Коментарі до публічної добірки (новіші — знизу), по 30. */
    public function comments(Request $request, MovieList $list): JsonResponse
    {
        app(Plugins::class)->ensure('movie_lists');
        abort_unless($list->visibleTo($request->user()), 404);
        $viewer = $request->user();
        $rows = MovieListComment::query()->with('user')->where('movie_list_id', $list->id)
            ->when($request->integer('before') > 0, fn ($q) => $q->where('id', '<', $request->integer('before')))
            ->orderByDesc('id')->limit(30)->get();

        return response()->json([
            'comments' => $rows->reverse()->map(fn (MovieListComment $c) => $c->toCard($viewer, $list))->values(),
            'more' => $rows->count() === 30,
        ]);
    }

    public function comment(Request $request, MovieList $list, ContentFilter $filter): JsonResponse
    {
        app(Plugins::class)->ensure('movie_lists');
        $user = $request->user();
        abort_unless($list->is_public || $list->user_id === $user->id, 404);
        $data = $request->validate(['body' => ['required', 'string', 'min:1', 'max:1000']]);
        $filter->ensureCanPost($user);
        $comment = MovieListComment::query()->create(['movie_list_id' => $list->id, 'user_id' => $user->id, 'body' => (string) $filter->clean(trim($data['body']))]);
        $this->recount($list);

        return response()->json(['ok' => true, 'comment' => $comment->load('user')->toCard($user, $list), 'comments_count' => $list->comments_count]);
    }

    /** Видалити коментар: автор, власник добірки або модератор (дію модератора пишемо в журнал). */
    public function destroyComment(Request $request, MovieList $list, MovieListComment $comment): JsonResponse
    {
        app(Plugins::class)->ensure('movie_lists');
        $user = $request->user();
        abort_unless($comment->movie_list_id === $list->id, 404);
        abort_unless($comment->canDelete($user, $list), 403);
        if ($comment->user_id !== $user->id && $list->user_id !== $user->id) {
            Log::info('movie_list.comment.deleted_by_staff', ['by' => $user->id, 'comment' => $comment->id, 'list' => $list->id]);
        }
        $comment->delete();
        $this->recount($list);

        return response()->json(['ok' => true, 'comments_count' => $list->comments_count]);
    }

    /** Новий порядок тайтлів (для рейтингу): список id у потрібному порядку. */
    public function reorder(Request $request, MovieList $list): JsonResponse
    {
        app(Plugins::class)->ensure('movie_lists');
        abort_unless($list->user_id === $request->user()->id, 403);
        $ids = $request->validate(['ids' => ['required', 'array', 'max:'.MovieList::MAX_ITEMS], 'ids.*' => ['integer']])['ids'];
        $inside = DB::table('movie_list_items')->where('movie_list_id', $list->id)->pluck('movie_id')->map(fn ($id) => (int) $id)->all();
        DB::transaction(function () use ($ids, $inside, $list) {
            foreach (array_values(array_intersect(array_map('intval', $ids), $inside)) as $position => $movieId) {
                DB::table('movie_list_items')->where('movie_list_id', $list->id)->where('movie_id', $movieId)->update(['position' => $position]);
            }
        });
        $list->touch();

        return response()->json(['ok' => true, 'message' => 'Порядок збережено.']);
    }

    private function recount(MovieList $list): void
    {
        $list->timestamps = false;
        $list->update(['comments_count' => MovieListComment::query()->where('movie_list_id', $list->id)->count()]);
    }

    private function toggle(Request $request, MovieList $list, string $table, string $counter, string $key): JsonResponse
    {
        app(Plugins::class)->ensure('movie_lists');
        $user = $request->user();
        abort_unless($list->is_public, 404);
        abort_if($list->user_id === $user->id, 422, 'Це ваша добірка.');
        $query = DB::table($table)->where('movie_list_id', $list->id)->where('user_id', $user->id);
        $on = ! $query->exists();
        $row = ['movie_list_id' => $list->id, 'user_id' => $user->id];
        $on ? DB::table($table)->insert($table === 'movie_list_follows' ? [...$row, 'created_at' => now()] : $row) : $query->delete();
        $list->timestamps = false;
        $list->update([$counter => DB::table($table)->where('movie_list_id', $list->id)->count()]);

        return response()->json([$key => $on, $counter => $list->{$counter}]);
    }

    private function attach(MovieList $list, int $movieId, ?string $note = null): void
    {
        abort_unless(Movie::query()->whereKey($movieId)->where('is_published', true)->exists(), 404);
        $count = $list->movies()->count();
        abort_if($count >= MovieList::MAX_ITEMS, 422, 'У добірці вже '.MovieList::MAX_ITEMS.' тайтлів.');
        $list->movies()->syncWithoutDetaching([$movieId => ['position' => $count, 'note' => $note, 'created_at' => now()]]);
        $list->update(['items_count' => $list->movies()->count()]);
        $list->touch();
    }

    /**
     * @return array{title: string, description: string|null, is_public: bool, is_ranked: bool}
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:2', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_public' => ['required', 'boolean'],
            'is_ranked' => ['sometimes', 'boolean'],
        ]);

        return ['title' => trim($data['title']), 'description' => isset($data['description']) ? trim($data['description']) : null, 'is_public' => (bool) $data['is_public'], 'is_ranked' => (bool) ($data['is_ranked'] ?? false)];
    }
}
