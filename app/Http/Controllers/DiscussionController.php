<?php

namespace App\Http\Controllers;

use App\Models\Discussion;
use App\Models\DiscussionReply;
use App\Models\User;
use App\Services\Discussions\DiscussionSubjects;
use App\Services\Moderation\ContentFilter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * «Обговорення»: теми до будь-чого на GameCon (фільм, серіал, аніме, гра, сервер, сім’я, клан,
 * спільнота, стаття) і загальний розділ за категоріями. Той самий контролер — сайт, застосунок
 * (/api/v1/discussions) і міст /api/v1/site. Персонал закріплює, закриває й видаляє теми — у журнал.
 */
class DiscussionController extends Controller
{
    public function __construct(
        private readonly DiscussionSubjects $subjects,
        private readonly ContentFilter $filter,
    ) {}

    /** Сторінка сайту «Обговорення» (загальний розділ). */
    public function page(Request $request): Response
    {

        return Inertia::render('discussions/index', ['categories' => $this->subjects->categories()]);
    }

    /** Список тем: предмета (type + id) чи категорії загального розділу; сортування й пошук. */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['nullable', Rule::in(array_keys(DiscussionSubjects::TYPES))],
            'id' => ['nullable', 'required_with:type', 'integer'],
            'category' => ['nullable', Rule::in(array_keys(Discussion::CATEGORIES))],
            'sort' => ['nullable', Rule::in(['active', 'new', 'top'])],
            'q' => ['nullable', 'string', 'max:80'],
            'mine' => ['nullable', 'boolean'],
        ]);
        $user = $this->user($request);
        $subject = null;
        $query = Discussion::query()->with('user');
        if (isset($data['type'])) {
            $subject = $this->subjects->find($data['type'], (int) $data['id']);
            abort_if($subject === null, 404);
            $query->where('subject_type', $data['type'])->where('subject_id', $subject->getKey());
        } else {
            $categories = array_keys($this->subjects->categories());
            $query->whereIn('category', isset($data['category']) ? array_intersect([$data['category']], $categories) : $categories);
            // Теми про предмет вимкненого розділу не показуємо в загальному списку.
            $types = array_values(array_filter(array_keys(DiscussionSubjects::TYPES), fn (string $t) => $this->subjects->allowed($t)));
            $query->where(fn (Builder $q) => $q->whereNull('subject_type')->orWhereIn('subject_type', $types));
        }
        if (! empty($data['q'])) {
            $query->where('title', 'like', '%'.$data['q'].'%');
        }
        if (! empty($data['mine'])) {
            $query->where('user_id', $user->id);
        }
        $query->orderByDesc('is_pinned');
        match ($data['sort'] ?? 'active') {
            'new' => $query->latest('id'),
            'top' => $query->orderByDesc('likes_count')->orderByDesc('replies_count'),
            default => $query->orderByRaw('COALESCE(last_reply_at, created_at) DESC'),
        };
        $page = $query->paginate(20);
        $liked = $this->likedTopics($user, array_values($page->getCollection()->map(fn (Discussion $d) => $d->id)->all()));

        return response()->json([
            'subject' => $subject ? $this->subjects->card($data['type'], $subject) : null,
            'categories' => $this->subjects->categories(),
            'discussions' => [
                'data' => $page->getCollection()->map(fn (Discussion $d) => $this->card($d, $user, $liked))->values(),
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /** Пошук картки для вставки: фільм, гра, сервер, трек, сім’я, клан, спільнота, стаття. */
    public function embeds(Request $request): JsonResponse
    {
        $data = $request->validate(['type' => ['required', Rule::in(array_keys(DiscussionSubjects::TYPES))], 'q' => ['required', 'string', 'max:80']]);

        return response()->json([
            'types' => array_map(fn (array $t) => $t['label'], array_filter(DiscussionSubjects::TYPES, fn (array $t, string $k) => $this->subjects->allowed($k), ARRAY_FILTER_USE_BOTH)),
            'items' => $this->subjects->search($data['type'], $data['q']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['nullable', Rule::in(array_keys(DiscussionSubjects::TYPES))],
            'id' => ['nullable', 'required_with:type', 'integer'],
            'category' => ['nullable', Rule::in(array_keys(Discussion::CATEGORIES))],
            'title' => ['required', 'string', 'min:4', 'max:160'],
            'body' => ['nullable', 'string', 'max:10000'],
            'spoiler' => ['sometimes', 'boolean'],
            'embeds' => ['nullable', 'array', 'max:6'],
        ]);
        $user = $this->user($request);
        $category = $data['category'] ?? 'general';
        $subjectId = null;
        if (isset($data['type'])) {
            $subject = $this->subjects->find($data['type'], (int) $data['id']);
            abort_if($subject === null, 404);
            $subjectId = (int) $subject->getKey();
            // Розділ людина може обрати сама; не обрала — за предметом (аніме → «Аніме», гра → «Ігри»…).
            $category = isset($data['category']) && array_key_exists($data['category'], $this->subjects->categories())
                ? $data['category']
                : $this->subjects->categoryFor($data['type'], $subject);
        } else {
            abort_unless(array_key_exists($category, $this->subjects->categories()), 404);
        }
        $discussion = Discussion::query()->create([
            'subject_type' => $data['type'] ?? null,
            'subject_id' => $subjectId,
            'category' => $category,
            'user_id' => $user->id,
            'title' => (string) $this->filter->clean(trim($data['title'])),
            'body' => isset($data['body']) ? $this->filter->clean(trim($data['body'])) : null,
            'spoiler' => (bool) ($data['spoiler'] ?? false),
            'embeds' => $this->subjects->cleanEmbeds($data['embeds'] ?? []) ?: null,
        ]);

        return response()->json(['ok' => true, 'message' => 'Тему створено.', 'discussion' => $this->card($discussion->load('user'), $user, [])], 201);
    }

    /** Тема з відповідями (по 50, найстаріші спершу; page — далі). */
    public function show(Request $request, Discussion $discussion): JsonResponse
    {
        $user = $this->user($request);
        $subject = $this->subjectOf($discussion);
        $discussion->increment('views_count');
        $replies = $discussion->replies()->with('user')->orderBy('id')->paginate(50);
        $liked = DB::table('discussion_likes')->where('user_id', $user->id)->where('discussion_id', $discussion->id)->pluck('reply_id')->all();
        $parents = DiscussionReply::query()->withTrashed()->with('user')->whereIn('id', $replies->getCollection()->pluck('parent_id')->filter()->unique()->all())->get()->keyBy('id');

        return response()->json([
            'discussion' => [
                ...$this->card($discussion->load('user'), $user, in_array(null, $liked, true) ? [$discussion->id] : []),
                'body' => $discussion->body,
                'embeds' => $this->subjects->embedCards($discussion->embeds),
            ],
            'subject' => $subject,
            'replies' => [
                'data' => $replies->getCollection()->map(fn (DiscussionReply $r) => [
                    'id' => $r->id,
                    'body' => $r->body,
                    'spoiler' => $r->spoiler,
                    'embeds' => $this->subjects->embedCards($r->embeds),
                    'likes_count' => $r->likes_count,
                    'liked' => in_array($r->id, $liked, true),
                    'user' => $r->user?->toCard(),
                    'parent' => $r->parent_id && isset($parents[$r->parent_id]) ? ['id' => $r->parent_id, 'author' => $parents[$r->parent_id]->user?->name, 'body' => $parents[$r->parent_id]->trashed() ? null : mb_substr($parents[$r->parent_id]->body, 0, 140)] : null,
                    'created_at' => $r->created_at->toIso8601String(),
                    'edited' => $r->updated_at !== null && $r->updated_at->gt($r->created_at->addMinute()),
                    'can_delete' => $r->user_id === $user->id || $user->isStaff(),
                ])->values(),
                'current_page' => $replies->currentPage(),
                'last_page' => $replies->lastPage(),
                'total' => $replies->total(),
            ],
        ]);
    }

    public function reply(Request $request, Discussion $discussion): JsonResponse
    {
        $this->subjectOf($discussion);
        $user = $this->user($request);
        abort_if($discussion->is_locked && ! $user->isStaff(), 403, 'Тему закрито — нові відповіді не приймаються.');
        $data = $request->validate([
            'body' => ['required', 'string', 'min:1', 'max:5000'],
            'parent_id' => ['nullable', 'integer'],
            'spoiler' => ['sometimes', 'boolean'],
            'embeds' => ['nullable', 'array', 'max:6'],
        ]);
        $parent = isset($data['parent_id']) ? DiscussionReply::query()->where('discussion_id', $discussion->id)->whereKey((int) $data['parent_id'])->first() : null;
        DB::transaction(function () use ($discussion, $user, $data, $parent) {
            DiscussionReply::query()->create([
                'discussion_id' => $discussion->id,
                'user_id' => $user->id,
                'parent_id' => $parent?->id,
                'body' => (string) $this->filter->clean(trim($data['body'])),
                'spoiler' => (bool) ($data['spoiler'] ?? false),
                'embeds' => $this->subjects->cleanEmbeds($data['embeds'] ?? []) ?: null,
            ]);
            $discussion->increment('replies_count', 1, ['last_reply_at' => now()]);
        });

        return response()->json(['ok' => true, 'message' => 'Відповідь додано.']);
    }

    /** Вподобати тему чи відповідь (повторно — зняти). */
    public function like(Request $request, Discussion $discussion, ?DiscussionReply $reply = null): JsonResponse
    {
        $this->subjectOf($discussion);
        abort_if($reply !== null && $reply->discussion_id !== $discussion->id, 404);
        $user = $this->user($request);
        $where = ['user_id' => $user->id, 'discussion_id' => $discussion->id, 'reply_id' => $reply?->id];
        $exists = DB::table('discussion_likes')->where($where)->exists();
        $target = $reply ?? $discussion;
        if ($exists) {
            DB::table('discussion_likes')->where($where)->delete();
            $target->decrement('likes_count');
        } else {
            DB::table('discussion_likes')->insert([...$where, 'created_at' => now(), 'updated_at' => now()]);
            $target->increment('likes_count');
        }

        return response()->json(['liked' => ! $exists, 'likes_count' => (int) $target->fresh()?->likes_count]);
    }

    public function update(Request $request, Discussion $discussion): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($discussion->user_id === $user->id || $user->isStaff(), 403);
        $data = $request->validate(['title' => ['required', 'string', 'min:4', 'max:160'], 'body' => ['nullable', 'string', 'max:10000'], 'spoiler' => ['sometimes', 'boolean']]);
        $discussion->update(['title' => $this->filter->clean(trim($data['title'])), 'body' => isset($data['body']) ? $this->filter->clean(trim($data['body'])) : null, 'spoiler' => (bool) ($data['spoiler'] ?? $discussion->spoiler)]);
        if ($discussion->user_id !== $user->id) {
            $this->audit($user, 'discussion.edit', ['discussion' => $discussion->id]);
        }

        return response()->json(['ok' => true, 'message' => 'Збережено.']);
    }

    /** Закріпити / закрити тему — лише персонал (у журнал). */
    public function moderate(Request $request, Discussion $discussion): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($user->isStaff(), 403);
        $data = $request->validate(['pinned' => ['sometimes', 'boolean'], 'locked' => ['sometimes', 'boolean']]);
        $discussion->update(array_filter(['is_pinned' => $data['pinned'] ?? null, 'is_locked' => $data['locked'] ?? null], fn ($v) => $v !== null));
        $this->audit($user, 'discussion.moderate', ['discussion' => $discussion->id, ...$data]);

        return response()->json(['ok' => true, 'message' => 'Збережено.']);
    }

    public function destroy(Request $request, Discussion $discussion): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($discussion->user_id === $user->id || $user->isStaff(), 403);
        if ($discussion->user_id !== $user->id) {
            $this->audit($user, 'discussion.delete', ['discussion' => $discussion->id, 'title' => $discussion->title, 'author' => $discussion->user_id]);
        }
        $discussion->delete();

        return response()->json(['ok' => true, 'message' => 'Тему видалено.']);
    }

    public function destroyReply(Request $request, Discussion $discussion, DiscussionReply $reply): JsonResponse
    {
        abort_if($reply->discussion_id !== $discussion->id, 404);
        $user = $this->user($request);
        abort_unless($reply->user_id === $user->id || $user->isStaff(), 403);
        if ($reply->user_id !== $user->id) {
            $this->audit($user, 'discussion.reply_delete', ['discussion' => $discussion->id, 'reply' => $reply->id, 'author' => $reply->user_id]);
        }
        $reply->delete();
        $discussion->decrement('replies_count');

        return response()->json(['ok' => true, 'message' => 'Відповідь видалено.']);
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }

    /**
     * Предмет теми (картка) — або 404, якщо розділ вимкнено чи предмет зник.
     *
     * @return array<string, mixed>|null
     */
    private function subjectOf(Discussion $discussion): ?array
    {
        if ($discussion->subject_type === null) {
            abort_unless(array_key_exists($discussion->category, $this->subjects->categories()), 404);

            return null;
        }
        $subject = $this->subjects->find($discussion->subject_type, (int) $discussion->subject_id);
        abort_if($subject === null, 404);

        return $this->subjects->card($discussion->subject_type, $subject);
    }

    /**
     * @param  list<int>  $ids
     * @return list<int>
     */
    private function likedTopics(User $user, array $ids): array
    {
        return array_values(DB::table('discussion_likes')->where('user_id', $user->id)->whereNull('reply_id')->whereIn('discussion_id', $ids)->pluck('discussion_id')->map(fn ($id) => (int) $id)->all());
    }

    /**
     * @param  list<int>  $liked
     * @return array<string, mixed>
     */
    private function card(Discussion $d, User $viewer, array $liked): array
    {
        return [
            'id' => $d->id,
            'title' => $d->title,
            'excerpt' => $d->body ? mb_substr($d->body, 0, 200) : null,
            'category' => $d->category,
            'category_label' => Discussion::CATEGORIES[$d->category] ?? $d->category,
            'subject_type' => $d->subject_type,
            'subject_id' => $d->subject_id,
            'spoiler' => $d->spoiler,
            'is_pinned' => $d->is_pinned,
            'is_locked' => $d->is_locked,
            'replies_count' => $d->replies_count,
            'likes_count' => $d->likes_count,
            'views_count' => $d->views_count,
            'liked' => in_array($d->id, $liked, true),
            'user' => $d->user?->toCard(),
            'created_at' => $d->created_at->toIso8601String(),
            'last_reply_at' => $d->last_reply_at?->toIso8601String(),
            'can_edit' => $d->user_id === $viewer->id || $viewer->isStaff(),
            'can_moderate' => $viewer->isStaff(),
        ];
    }

    /** @param array<string, mixed> $context */
    private function audit(User $user, string $action, array $context): void
    {
        Log::info('admin: '.$action, [...$context, 'by' => $user->id]);
    }
}
