<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\Like;
use App\Models\Photo;
use App\Models\PhotoAlbum;
use App\Models\User;
use App\Services\PhotoService;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PhotoAlbumController extends Controller
{
    public const PER_PAGE = 40;

    public const MAX_UPLOAD = 30;

    public function __construct(private readonly PhotoService $photos) {}

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'community' => ['nullable', 'string'],
            ...$this->rules(),
        ]);

        $owner = isset($data['community'])
            ? Community::query()->where('slug', $data['community'])->firstOrFail()
            : $user;
        abort_unless($this->photos->canCreateAlbum($owner, $user), 403);

        $album = $this->photos->createAlbum($owner, $this->clean($data, $owner));

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Альбом створено. Додайте фотографії.']);

        return to_route('albums.show', $album);
    }

    public function show(Request $request, PhotoAlbum $album): Response
    {
        $viewer = $request->user();
        $album->load(['owner', 'cover']);
        abort_unless($album->owner && $this->photos->canView($album, $viewer), 404);

        $photos = $album->photos()->latest('id')->paginate(self::PER_PAGE);
        $photos->setCollection($photos->getCollection()->map(fn (Photo $p) => $p->toThumb()));

        return Inertia::render('photos/album', [
            'album' => [
                ...$this->photos->albumCard($album),
                'owner' => $this->photos->ownerCard($album->owner),
                'created_at' => $album->created_at->toIso8601String(),
            ],
            'photos' => Inertia::scroll(fn () => $photos),
            'openPhoto' => $request->integer('photo') ?: null,
            'contributors' => $album->contributors()->get()->map->toCard()->values(),
            'can' => [
                'manage' => $this->photos->canManage($album, $viewer),
                'upload' => $this->photos->canUpload($album, $viewer),
            ],
            'privacyOptions' => $album->ownedByCommunity() ? [PhotoAlbum::PRIVACY_PUBLIC, PhotoAlbum::PRIVACY_PRIVATE] : PhotoAlbum::PRIVACIES,
            'limits' => ['upload' => self::MAX_UPLOAD],
        ]);
    }

    public function update(Request $request, PhotoAlbum $album): RedirectResponse
    {
        abort_unless($this->photos->canManage($album, $request->user()), 403);

        $album->update($this->clean($request->validate($this->rules()), $album->owner));

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Альбом оновлено.']);

        return back();
    }

    public function destroy(Request $request, PhotoAlbum $album): RedirectResponse
    {
        abort_unless($this->photos->canManage($album, $request->user()), 403);

        $owner = $album->owner;
        $photos = $album->photos()->withTrashed()->get(['id', 'path']);

        DB::transaction(function () use ($album, $photos) {
            Like::query()->where('likeable_type', (new Photo)->getMorphClass())->whereIn('likeable_id', $photos->modelKeys())->delete();
            $album->delete();
        });
        $paths = $photos->pluck('path');
        Storage::disk('public')->delete($paths->all());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Альбом видалено.']);

        return $owner instanceof Community
            ? to_route('communities.photos', $owner)
            : to_route('photos.user', $owner);
    }

    public function storeContributor(Request $request, PhotoAlbum $album): RedirectResponse
    {
        $data = $request->validate(['username' => ['required', 'string']]);
        $friend = User::query()->where('username', $data['username'])->first();
        abort_unless($friend instanceof User, 422, 'Людину не знайдено.');
        $this->photos->addContributor($album, $request->user(), $friend);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Людину додано до альбому.']);

        return back();
    }

    public function destroyContributor(Request $request, PhotoAlbum $album, User $user): RedirectResponse
    {
        $this->photos->removeContributor($album, $request->user(), $user);

        return back();
    }

    public function upload(Request $request, PhotoAlbum $album, SiteSettings $settings): RedirectResponse
    {
        abort_unless($this->photos->canUpload($album, $request->user()), 403);

        $request->validate([
            'photos' => ['required', 'array', 'max:'.self::MAX_UPLOAD],
            'photos.*' => ['image', 'mimes:jpg,jpeg,png,webp,gif', 'max:'.(int) $settings->get('max_upload_mb') * 1024],
        ], [
            'photos.max' => 'За раз можна завантажити до '.self::MAX_UPLOAD.' фото.',
        ]);

        $created = $this->photos->upload($album, $request->user(), array_values($request->file('photos', [])));

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Завантажено фото: '.count($created).'.']);

        return back();
    }

    /**
     * @return array<string, list<mixed>>
     */
    private function rules(): array
    {
        return [
            'title' => ['required', 'string', 'min:1', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
            'privacy' => ['required', Rule::in(PhotoAlbum::PRIVACIES)],
            'comments_enabled' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{title: string, description: string|null, privacy: string, comments_enabled: bool}
     */
    private function clean(array $data, mixed $owner): array
    {
        $privacy = $data['privacy'];
        if ($owner instanceof Community && $privacy === PhotoAlbum::PRIVACY_FRIENDS) {
            $privacy = PhotoAlbum::PRIVACY_PUBLIC;
        }

        return [
            'title' => trim($data['title']),
            'description' => isset($data['description']) ? trim($data['description']) ?: null : null,
            'privacy' => $privacy,
            'comments_enabled' => (bool) ($data['comments_enabled'] ?? true),
        ];
    }
}
