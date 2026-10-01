<?php

namespace App\Services;

use App\Models\Community;
use App\Models\Like;
use App\Models\Photo;
use App\Models\PhotoAlbum;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PhotoService
{
    public function __construct(
        private readonly FriendshipService $friendships,
        private readonly CommunityService $communities,
        private readonly ImageStorage $images,
    ) {}

    /**
     * Альбоми власника, які може бачити глядач.
     *
     * @return Builder<PhotoAlbum>
     */
    public function visibleAlbums(User|Community $owner, User $viewer): Builder
    {
        return PhotoAlbum::query()
            ->whereMorphedTo('owner', $owner)
            ->whereIn('privacy', $this->allowedPrivacies($owner, $viewer));
    }

    /**
     * @return list<string>
     */
    public function allowedPrivacies(User|Community $owner, User $viewer): array
    {
        if ($owner instanceof Community) {
            if (! $this->communities->canView($owner, $viewer)) {
                return [];
            }

            return $this->managesCommunity($owner, $viewer)
                ? PhotoAlbum::PRIVACIES
                : [PhotoAlbum::PRIVACY_PUBLIC, PhotoAlbum::PRIVACY_FRIENDS];
        }

        if ($owner->is($viewer) || $viewer->isStaff()) {
            return PhotoAlbum::PRIVACIES;
        }

        return $this->friendships->status($viewer, $owner) === FriendshipService::FRIENDS
            ? [PhotoAlbum::PRIVACY_PUBLIC, PhotoAlbum::PRIVACY_FRIENDS]
            : [PhotoAlbum::PRIVACY_PUBLIC];
    }

    public function canView(PhotoAlbum $album, User $viewer): bool
    {
        $owner = $album->owner;

        return $owner !== null && in_array($album->privacy, $this->allowedPrivacies($owner, $viewer), true);
    }

    public function canManage(PhotoAlbum $album, User $user): bool
    {
        $owner = $album->owner;

        return match (true) {
            $owner instanceof Community => $this->managesCommunity($owner, $user),
            $owner instanceof User => $owner->is($user),
            default => false,
        } || $user->isStaff();
    }

    /**
     * Учасники груп з відкритою стіною можуть додавати фото до альбомів спільноти.
     */
    public function canUpload(PhotoAlbum $album, User $user): bool
    {
        if ($this->canManage($album, $user)) {
            return true;
        }

        $owner = $album->owner;

        return $owner instanceof Community
            && ! $owner->isPublic()
            && $owner->wall === Community::WALL_OPEN
            && (bool) $owner->membershipFor($user)?->isActive();
    }

    public function canCreateAlbum(User|Community $owner, User $user): bool
    {
        return $owner instanceof Community
            ? $this->managesCommunity($owner, $user)
            : $owner->is($user);
    }

    public function canDeletePhoto(Photo $photo, User $user): bool
    {
        return $photo->user_id === $user->id || $this->canManage($photo->album, $user);
    }

    /**
     * @param  array{title: string, description?: string|null, privacy?: string, comments_enabled?: bool}  $data
     */
    public function createAlbum(User|Community $owner, array $data): PhotoAlbum
    {
        if (PhotoAlbum::query()->whereMorphedTo('owner', $owner)->count() >= PhotoAlbum::MAX_PER_OWNER) {
            throw ValidationException::withMessages(['title' => 'Досягнуто ліміт альбомів ('.PhotoAlbum::MAX_PER_OWNER.').']);
        }

        $album = new PhotoAlbum($data);
        $album->owner()->associate($owner);
        $album->save();

        return $album;
    }

    /**
     * @param  list<UploadedFile>  $files
     * @return list<Photo>
     */
    public function upload(PhotoAlbum $album, User $user, array $files): array
    {
        $photos = DB::transaction(function () use ($album, $user, $files) {
            $created = [];
            foreach ($files as $file) {
                $stored = $this->images->store($file, 'photos');
                $created[] = $album->photos()->create([
                    'user_id' => $user->id,
                    'path' => $stored['path'],
                    'width' => $stored['width'],
                    'height' => $stored['height'],
                    'size' => $stored['size'],
                ]);
            }

            return $created;
        });

        $album->recount();

        return $photos;
    }

    public function delete(Photo $photo): void
    {
        $album = $photo->album;
        $photo->delete();
        $album->recount();
    }

    public function toggleLike(Photo $photo, User $user): bool
    {
        return DB::transaction(function () use ($photo, $user) {
            $deleted = Like::query()
                ->where('user_id', $user->id)
                ->where('likeable_type', $photo->getMorphClass())
                ->where('likeable_id', $photo->id)
                ->delete();

            if ($deleted) {
                $photo->decrement('likes_count');

                return false;
            }

            Like::query()->create(['user_id' => $user->id, 'likeable_type' => $photo->getMorphClass(), 'likeable_id' => $photo->id]);
            $photo->increment('likes_count');

            return true;
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function ownerCard(Model $owner): array
    {
        return $owner instanceof Community
            ? ['type' => 'community', 'name' => $owner->name, 'avatar_url' => $owner->avatar_url, 'href' => '/c/'.$owner->slug, 'photos_href' => '/c/'.$owner->slug.'/photos', 'community' => $owner->toCard()]
            : ['type' => 'user', 'name' => $owner->name, 'avatar_url' => $owner->avatar_url, 'href' => '/'.$owner->username, 'photos_href' => '/photos/u/'.$owner->username, 'user' => $owner->toCard()];
    }

    /**
     * @return array<string, mixed>
     */
    public function albumCard(PhotoAlbum $album): array
    {
        return [
            'id' => $album->id,
            'title' => $album->title,
            'description' => $album->description,
            'privacy' => $album->privacy,
            'comments_enabled' => $album->comments_enabled,
            'photos_count' => $album->photos_count,
            'cover_url' => $album->cover?->url,
            'updated_at' => $album->updated_at->toIso8601String(),
        ];
    }

    private function managesCommunity(Community $community, User $user): bool
    {
        $membership = $community->membershipFor($user);

        return ($membership?->isActive() && $membership->isManager()) || $user->isStaff();
    }
}
