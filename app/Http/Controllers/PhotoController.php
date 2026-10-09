<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\Community;
use App\Models\Like;
use App\Models\Photo;
use App\Models\PhotoAlbum;
use App\Models\User;
use App\Notifications\PhotoInteraction;
use App\Services\PhotoService;
use App\Services\PostPresenter;
use App\Support\CommentOrder;
use App\Support\Stickers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PhotoController extends Controller
{
    public const PER_PAGE = 30;

    public const PREVIEW_COMMENTS = 30;

    public function __construct(
        private readonly PhotoService $photos,
        private readonly PostPresenter $presenter,
    ) {}

    public function index(Request $request): RedirectResponse
    {
        return to_route('photos.user', $request->user());
    }

    public function user(Request $request, User $user): Response
    {
        abort_if($user->isBanned() && ! $request->user()->isStaff(), 404);

        return $this->overview($request, $user);
    }

    public function community(Request $request, Community $community): Response
    {
        return $this->overview($request, $community);
    }

    public function show(Request $request, Photo $photo): JsonResponse
    {
        $viewer = $request->user();
        $photo->load(['album.owner', 'album.cover', 'user']);
        $album = $photo->album;
        abort_unless($this->photos->canView($album, $viewer), 404);

        $photo->increment('views_count');

        $comments = $photo->comments()->with('user')->orderBy('id')->limit(self::PREVIEW_COMMENTS)->get();
        $likedComments = Like::query()
            ->where('user_id', $viewer->id)
            ->where('likeable_type', (new Comment)->getMorphClass())
            ->whereIn('likeable_id', $comments->modelKeys())
            ->pluck('likeable_id')
            ->flip();

        $position = $album->photos()->where('id', '>', $photo->id)->count();

        return response()->json([
            'photo' => [
                ...$photo->toThumb(),
                'caption' => $photo->caption,
                'views_count' => $photo->views_count,
                'created_at' => $photo->created_at->toIso8601String(),
                'user' => $photo->user?->toCard(),
                'liked' => $photo->likes()->where('user_id', $viewer->id)->exists(),
                'is_cover' => $album->cover_photo_id === $photo->id,
                'position' => $position + 1,
                'album' => [
                    ...$this->photos->albumCard($album),
                    'owner' => $this->photos->ownerCard($album->owner),
                ],
                'prev_id' => $album->photos()->where('id', '>', $photo->id)->orderBy('id')->value('id'),
                'next_id' => $album->photos()->where('id', '<', $photo->id)->orderByDesc('id')->value('id'),
                'can' => [
                    'edit' => $this->photos->canManage($album, $viewer) || $photo->user_id === $viewer->id,
                    'delete' => $this->photos->canDeletePhoto($photo, $viewer),
                    'cover' => $this->photos->canManage($album, $viewer),
                    'comment' => $album->comments_enabled,
                ],
            ],
            'comments' => $comments->map(fn (Comment $c) => $this->presenter->comment($c, $viewer, $likedComments->has($c->id)))->values(),
        ]);
    }

    public function update(Request $request, Photo $photo): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->photos->canManage($photo->album, $user) || $photo->user_id === $user->id, 403);

        $data = $request->validate(['caption' => ['nullable', 'string', 'max:500']]);
        $photo->update(['caption' => isset($data['caption']) ? trim($data['caption']) ?: null : null]);

        return response()->json(['caption' => $photo->caption]);
    }

    public function cover(Request $request, Photo $photo): JsonResponse
    {
        $album = $photo->album;
        abort_unless($this->photos->canManage($album, $request->user()), 403);

        $album->forceFill(['cover_photo_id' => $photo->id])->save();

        return response()->json(['cover_photo_id' => $photo->id]);
    }

    public function destroy(Request $request, Photo $photo): JsonResponse
    {
        abort_unless($this->photos->canDeletePhoto($photo, $request->user()), 403);

        $this->photos->delete($photo);

        return response()->json(['deleted' => true]);
    }

    public function like(Request $request, Photo $photo): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->photos->canView($photo->album, $user), 404);

        $liked = $this->photos->toggleLike($photo, $user);

        if ($liked && $photo->user && $photo->user_id !== $user->id) {
            $photo->user->notify(new PhotoInteraction(PhotoInteraction::LIKE, $user, $photo));
        }

        return response()->json(['liked' => $liked, 'likes_count' => $photo->fresh()->likes_count]);
    }

    public function comments(Request $request, Photo $photo): JsonResponse
    {
        $viewer = $request->user();
        abort_unless($this->photos->canView($photo->album, $viewer), 404);

        $comments = $photo->comments()->with('user');
        CommentOrder::apply($comments, $request->query('sort'));
        $comments = $comments->limit(500)->get();
        $liked = Like::query()
            ->where('user_id', $viewer->id)
            ->where('likeable_type', (new Comment)->getMorphClass())
            ->whereIn('likeable_id', $comments->modelKeys())
            ->pluck('likeable_id')
            ->flip();

        return response()->json([
            'comments' => $comments->map(fn (Comment $c) => $this->presenter->comment($c, $viewer, $liked->has($c->id)))->values(),
        ]);
    }

    public function comment(Request $request, Photo $photo): JsonResponse
    {
        $user = $request->user();
        $album = $photo->album;
        abort_unless($this->photos->canView($album, $user), 404);
        abort_unless($album->comments_enabled, 403, 'Коментарі до цього альбому вимкнено.');

        $data = $request->validate([
            'body' => ['nullable', 'string', 'max:2000', 'required_without:sticker'],
            'parent_id' => ['nullable', 'integer'],
            'sticker' => ['nullable', 'string', Rule::in(array_keys(Stickers::ITEMS))],
        ]);

        $comment = $photo->comments()->create([
            'user_id' => $user->id,
            'parent_id' => isset($data['parent_id']) ? $photo->comments()->whereKey($data['parent_id'])->value('id') : null,
            'body' => trim((string) ($data['body'] ?? '')),
            'sticker' => $data['sticker'] ?? null,
        ]);
        $photo->increment('comments_count');

        if ($photo->user && $photo->user_id !== $user->id) {
            $excerpt = $comment->body !== '' ? Str::limit($comment->body, 80) : Stickers::emoji($comment->sticker);
            $photo->user->notify(new PhotoInteraction(PhotoInteraction::COMMENT, $user, $photo, $excerpt));
        }

        return response()->json([
            'comment' => $this->presenter->comment($comment->load('user'), $user),
            'comments_count' => $photo->fresh()->comments_count,
        ], 201);
    }

    private function overview(Request $request, User|Community $owner): Response
    {
        $viewer = $request->user();
        $privacies = $this->photos->allowedPrivacies($owner, $viewer);
        abort_if($owner instanceof Community && $privacies === [], 404);

        $albums = $this->photos->visibleAlbums($owner, $viewer)
            ->with('cover')
            ->latest('updated_at')
            ->get();

        $photos = Photo::query()
            ->whereIn('album_id', $albums->modelKeys())
            ->latest('id')
            ->paginate(self::PER_PAGE);
        $photos->setCollection($photos->getCollection()->map(fn (Photo $p) => [...$p->toThumb(), 'album_id' => $p->album_id]));

        return Inertia::render('photos/index', [
            'owner' => $this->photos->ownerCard($owner),
            'albums' => $albums->map(fn (PhotoAlbum $a) => $this->photos->albumCard($a))->values(),
            'photos' => Inertia::scroll(fn () => $photos),
            'total' => (int) $albums->sum('photos_count'),
            'can' => ['create' => $this->photos->canCreateAlbum($owner, $viewer)],
            'privacyOptions' => $owner instanceof Community ? [PhotoAlbum::PRIVACY_PUBLIC, PhotoAlbum::PRIVACY_PRIVATE] : PhotoAlbum::PRIVACIES,
        ]);
    }
}
