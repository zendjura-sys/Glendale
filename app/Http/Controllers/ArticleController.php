<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\Game;
use App\Models\User;
use App\Services\ArticleRenderer;
use App\Services\ImageStorage;
use App\Services\Moderation\ContentFilter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Статті: стрічка, читання зі змістом, редактор Markdown з картинками.
 * Редагує автор; видалити може автор або модератор (видалення модератором — у журнал).
 */
class ArticleController extends Controller
{
    public function __construct(private readonly ArticleRenderer $renderer) {}

    public function index(Request $request): Response
    {
        $user = $this->user($request);
        $game = $request->filled('game') ? Game::query()->where('slug', (string) $request->query('game'))->first() : null;

        return Inertia::render('articles/index', [
            'articles' => Article::query()->published()->with(['user', 'game'])
                ->when($game, fn ($q) => $q->where('game_id', $game?->id))
                ->latest('published_at')->paginate(18)->withQueryString()
                ->through(fn (Article $a) => $a->toCard()),
            'drafts' => Article::query()->with(['user', 'game'])->where('user_id', $user->id)->where('is_published', false)
                ->latest('updated_at')->limit(10)->get()->map(fn (Article $a) => $a->toCard())->values(),
            'game' => $game?->toCard(),
        ]);
    }

    public function show(Request $request, Article $article): Response
    {
        $user = $this->user($request);
        $own = $article->user_id === $user->id;
        abort_unless($article->is_published || $own || $user->isStaff(), 404);
        if ($article->is_published && ! $own && Cache::add("article-view:{$article->id}:{$user->id}", 1, now()->addHour())) {
            $article->increment('views_count');
        }
        $rendered = $this->renderer->render($article->body);
        $article->loadMissing(['user', 'game']);

        return Inertia::render('articles/show', [
            'article' => [...$article->toCard(), 'html' => $rendered['html'], 'toc' => $rendered['toc']],
            'can_edit' => $own,
            'can_delete' => $own || $user->isStaff(),
            'more' => Article::query()->published()->with(['user', 'game'])->where('user_id', $article->user_id)
                ->whereKeyNot($article->id)->latest('published_at')->limit(3)->get()->map(fn (Article $a) => $a->toCard())->values(),
        ]);
    }

    public function create(Request $request): Response
    {
        $this->user($request);

        return Inertia::render('articles/edit', ['article' => null]);
    }

    public function edit(Request $request, Article $article): Response
    {
        abort_unless($article->user_id === $this->user($request)->id, 403);
        $article->loadMissing(['user', 'game']);

        return Inertia::render('articles/edit', ['article' => [...$article->toCard(), 'body' => $article->body]]);
    }

    public function store(Request $request, ContentFilter $filter): RedirectResponse
    {
        $user = $this->user($request);
        $filter->ensureCanPost($user);
        $data = $this->validated($request);
        $article = Article::query()->create([
            ...$this->attributes($data, $filter),
            'user_id' => $user->id,
            'slug' => $this->slug($data['title']),
        ]);

        return redirect('/articles/'.$article->slug);
    }

    public function update(Request $request, Article $article, ContentFilter $filter): RedirectResponse
    {
        $user = $this->user($request);
        abort_unless($article->user_id === $user->id, 403);
        $filter->ensureCanPost($user);
        $data = $this->validated($request);
        $attributes = $this->attributes($data, $filter, $article);
        if ($request->hasFile('cover') && $article->cover_path) {
            Storage::disk('public')->delete($article->cover_path);
        }
        $article->update($attributes);

        return redirect('/articles/'.$article->slug);
    }

    public function destroy(Request $request, Article $article): RedirectResponse
    {
        $user = $this->user($request);
        abort_unless($article->user_id === $user->id || $user->isStaff(), 403);
        if ($article->user_id !== $user->id) {
            Log::info('moderation: article deleted', ['article' => $article->id, 'author' => $article->user_id, 'by' => $user->id]);
        }
        if ($article->cover_path) {
            Storage::disk('public')->delete($article->cover_path);
        }
        $article->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Статтю видалено.']);

        return redirect('/articles');
    }

    /** Картинка в текст статті: повертає адресу для Markdown. */
    public function image(Request $request, ImageStorage $images): JsonResponse
    {
        $this->user($request);
        $request->validate(['image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:10240']]);
        $file = $request->file('image');
        abort_unless($file !== null, 422);
        $stored = $images->store($file, 'articles', 1920);

        return response()->json(['url' => Storage::disk('public')->url($stored['path'])]);
    }

    /**
     * @return array{title: string, excerpt: string|null, body: string, game_id: int|null, publish: bool}
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:140'],
            'excerpt' => ['nullable', 'string', 'max:300'],
            'body' => ['required', 'string', 'min:50', 'max:100000'],
            'game_id' => ['nullable', 'integer', 'exists:games,id'],
            'cover' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
            'publish' => ['required', 'boolean'],
        ], ['body.min' => 'Стаття має бути щонайменше на кілька речень.']);

        return [
            'title' => trim($data['title']),
            'excerpt' => isset($data['excerpt']) && trim($data['excerpt']) !== '' ? trim($data['excerpt']) : null,
            'body' => $data['body'],
            'game_id' => isset($data['game_id']) ? (int) $data['game_id'] : null,
            'publish' => (bool) $data['publish'],
        ];
    }

    /**
     * @param  array{title: string, excerpt: string|null, body: string, game_id: int|null, publish: bool}  $data
     * @return array<string, mixed>
     */
    private function attributes(array $data, ContentFilter $filter, ?Article $article = null): array
    {
        $attributes = [
            'title' => (string) $filter->clean($data['title']),
            'excerpt' => $data['excerpt'] !== null ? $filter->clean($data['excerpt']) : null,
            'body' => (string) $filter->clean($data['body']),
            'game_id' => $data['game_id'],
            'is_published' => $data['publish'],
            'reading_minutes' => ArticleRenderer::minutes($data['body']),
        ];
        if ($data['publish'] && $article?->published_at === null) {
            $attributes['published_at'] = now();
        }
        if (request()->hasFile('cover')) {
            $file = request()->file('cover');
            if ($file !== null && ! is_array($file)) {
                $attributes['cover_path'] = app(ImageStorage::class)->store($file, 'articles', 1920)['path'];
            }
        }

        return $attributes;
    }

    private function slug(string $title): string
    {
        $base = Str::limit(Str::slug($title) ?: 'stattia', 120, '');
        $slug = $base;
        while (Article::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.Str::lower(Str::random(4));
        }

        return $slug;
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
