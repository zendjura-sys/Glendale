<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\Photo;
use App\Models\PhotoAlbum;
use App\Models\User;
use App\Notifications\PhotoInteraction;
use App\Services\CommunityService;
use App\Services\FriendshipService;
use App\Services\PhotoService;
use App\Support\Modules\ModuleManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PhotosTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function album(User|Community $owner, string $privacy = PhotoAlbum::PRIVACY_PUBLIC, int $photos = 0): PhotoAlbum
    {
        $album = app(PhotoService::class)->createAlbum($owner, ['title' => 'Турнір', 'privacy' => $privacy]);
        $author = $owner instanceof User ? $owner : User::factory()->create();

        for ($i = 0; $i < $photos; $i++) {
            $album->photos()->create(['user_id' => $author->id, 'path' => "photos/{$i}.jpg", 'width' => 10, 'height' => 10]);
        }
        $album->recount();

        return $album->fresh();
    }

    private function befriend(User $a, User $b): void
    {
        $friendships = app(FriendshipService::class);
        $friendships->request($a, $b);
        $friendships->accept($b, $a);
    }

    public function test_user_creates_album_and_uploads_photos(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('albums.store'), [
            'title' => 'Мій сетап',
            'privacy' => PhotoAlbum::PRIVACY_FRIENDS,
        ])->assertRedirect();

        $album = PhotoAlbum::query()->sole();
        $this->assertTrue($album->owner->is($user));

        $this->actingAs($user)->post(route('albums.upload', $album), [
            'photos' => [UploadedFile::fake()->image('a.jpg', 800, 600), UploadedFile::fake()->image('b.png', 400, 400)],
        ])->assertRedirect();

        $album->refresh();
        $this->assertSame(2, $album->photos_count);
        $this->assertNotNull($album->cover_photo_id);
        Storage::disk('public')->assertExists(Photo::query()->pluck('path')->all());

        $this->actingAs($user)->get(route('albums.show', $album))
            ->assertInertia(fn (Assert $page) => $page
                ->component('photos/album')
                ->where('album.photos_count', 2)
                ->where('can.manage', true)
                ->has('photos.data', 2));
    }

    public function test_album_privacy_is_respected(): void
    {
        [$owner, $friend, $stranger] = User::factory()->count(3)->create();
        $this->befriend($owner, $friend);

        $public = $this->album($owner, PhotoAlbum::PRIVACY_PUBLIC, 1);
        $friends = $this->album($owner, PhotoAlbum::PRIVACY_FRIENDS, 1);
        $private = $this->album($owner, PhotoAlbum::PRIVACY_PRIVATE, 1);

        $this->actingAs($stranger)->get(route('albums.show', $public))->assertOk();
        $this->actingAs($stranger)->get(route('albums.show', $friends))->assertNotFound();
        $this->actingAs($friend)->get(route('albums.show', $friends))->assertOk();
        $this->actingAs($friend)->get(route('albums.show', $private))->assertNotFound();
        $this->actingAs($friend)->getJson(route('photos.show', $private->photos()->first()))->assertNotFound();

        $this->actingAs($stranger)->get(route('photos.user', $owner))
            ->assertInertia(fn (Assert $page) => $page
                ->component('photos/index')
                ->has('albums', 1)
                ->where('total', 1)
                ->where('can.create', false));

        $this->actingAs($owner)->get(route('photos.user', $owner))
            ->assertInertia(fn (Assert $page) => $page->has('albums', 3)->where('can.create', true));
    }

    public function test_only_owner_manages_album(): void
    {
        [$owner, $other] = User::factory()->count(2)->create();
        $album = $this->album($owner, photos: 1);

        $this->actingAs($other)->post(route('albums.upload', $album), ['photos' => [UploadedFile::fake()->image('x.jpg')]])->assertForbidden();
        $this->actingAs($other)->patch(route('albums.update', $album), ['title' => 'X', 'privacy' => 'public'])->assertForbidden();
        $this->actingAs($other)->deleteJson(route('photos.destroy', $album->photos()->first()))->assertForbidden();

        $this->actingAs($owner)->delete(route('albums.destroy', $album))->assertRedirect(route('photos.user', $owner));
        $this->assertSame(0, PhotoAlbum::query()->count());
        $this->assertSame(0, Photo::withTrashed()->count());
    }

    public function test_viewer_details_like_and_comment_notify_author(): void
    {
        Notification::fake();
        [$owner, $fan] = User::factory()->count(2)->create();
        $album = $this->album($owner, photos: 3);
        [$newest, $middle, $oldest] = $album->photos()->latest('id')->get();

        $this->actingAs($fan)->getJson(route('photos.show', $middle))
            ->assertOk()
            ->assertJsonPath('photo.prev_id', $newest->id)
            ->assertJsonPath('photo.next_id', $oldest->id)
            ->assertJsonPath('photo.position', 2)
            ->assertJsonPath('photo.can.delete', false)
            ->assertJsonPath('photo.album.owner.type', 'user');

        $this->actingAs($fan)->postJson(route('photos.like', $middle))->assertJson(['liked' => true, 'likes_count' => 1]);
        $this->actingAs($fan)->postJson(route('photos.comments.store', $middle), ['body' => 'Круто!'])
            ->assertCreated()
            ->assertJsonPath('comments_count', 1);

        Notification::assertSentTo($owner, PhotoInteraction::class, fn (PhotoInteraction $n) => $n->kind === PhotoInteraction::LIKE);
        Notification::assertSentTo($owner, PhotoInteraction::class, fn (PhotoInteraction $n) => $n->kind === PhotoInteraction::COMMENT);

        $comment = $middle->comments()->sole();
        $this->actingAs($owner)->deleteJson(route('comments.destroy', $comment))->assertJsonPath('comments_count', 0);
        $this->actingAs($fan)->postJson(route('photos.like', $middle))->assertJson(['liked' => false, 'likes_count' => 0]);
    }

    public function test_comments_can_be_disabled_per_album(): void
    {
        [$owner, $fan] = User::factory()->count(2)->create();
        $album = $this->album($owner, photos: 1);
        $album->update(['comments_enabled' => false]);

        $this->actingAs($fan)->postJson(route('photos.comments.store', $album->photos()->first()), ['body' => 'Привіт'])->assertForbidden();
    }

    public function test_caption_and_cover(): void
    {
        $owner = User::factory()->create();
        $album = $this->album($owner, photos: 2);
        $oldest = $album->photos()->oldest('id')->first();

        $this->actingAs($owner)->patchJson(route('photos.update', $oldest), ['caption' => '  Фінал  '])->assertJson(['caption' => 'Фінал']);
        $this->actingAs($owner)->postJson(route('photos.cover', $oldest))->assertOk();
        $this->assertSame($oldest->id, $album->fresh()->cover_photo_id);

        $this->actingAs($owner)->deleteJson(route('photos.destroy', $oldest))->assertOk();
        $album->refresh();
        $this->assertSame(1, $album->photos_count);
        $this->assertNotSame($oldest->id, $album->cover_photo_id);
    }

    public function test_community_albums(): void
    {
        [$owner, $member, $outsider] = User::factory()->count(3)->create();
        $community = app(CommunityService::class)->create($owner, [
            'name' => 'CS2 Україна',
            'type' => Community::TYPE_GROUP,
            'privacy' => Community::PRIVACY_OPEN,
            'wall' => Community::WALL_OPEN,
            'category' => 'esports',
        ]);
        $this->actingAs($member)->post(route('communities.join', $community));

        $this->actingAs($member)->post(route('albums.store'), ['community' => $community->slug, 'title' => 'X', 'privacy' => 'public'])->assertForbidden();
        $this->actingAs($owner)->post(route('albums.store'), ['community' => $community->slug, 'title' => 'Хайлайти', 'privacy' => 'friends'])->assertRedirect();

        $album = PhotoAlbum::query()->sole();
        $this->assertTrue($album->ownedByCommunity());
        $this->assertSame(PhotoAlbum::PRIVACY_PUBLIC, $album->privacy, 'Для спільнот немає приватності «друзі»');

        $this->actingAs($member)->post(route('albums.upload', $album), ['photos' => [UploadedFile::fake()->image('m.jpg')]])->assertRedirect();
        $this->actingAs($outsider)->post(route('albums.upload', $album), ['photos' => [UploadedFile::fake()->image('o.jpg')]])->assertForbidden();

        $this->actingAs($outsider)->get(route('communities.photos', $community))
            ->assertInertia(fn (Assert $page) => $page->component('photos/index')->where('owner.type', 'community')->where('total', 1));

        $this->actingAs($outsider)->get(route('communities.show', $community))
            ->assertInertia(fn (Assert $page) => $page->where('photos.count', 1)->has('photos.items', 1));
    }

    public function test_profile_shows_latest_visible_photos(): void
    {
        [$owner, $stranger] = User::factory()->count(2)->create();
        $this->album($owner, PhotoAlbum::PRIVACY_PUBLIC, 2);
        $this->album($owner, PhotoAlbum::PRIVACY_PRIVATE, 5);

        $this->actingAs($stranger)->get(route('profile.show', $owner))
            ->assertInertia(fn (Assert $page) => $page
                ->where('stats.photos', 2)
                ->has('photos', 2)
                ->where('photosHref', '/photos/u/'.$owner->username)
                ->has('counters.notifications'));
    }

    public function test_admin_moderates_photos(): void
    {
        $admin = User::factory()->admin()->create();
        $album = $this->album(User::factory()->create(), photos: 1);
        $photo = $album->photos()->first();
        Storage::disk('public')->put($photo->path, 'x');

        $this->actingAs($admin)->get(route('admin.photos.index'))
            ->assertInertia(fn (Assert $page) => $page->component('admin/photos')->where('stats.photos', 1));

        $this->actingAs($admin)->delete(route('admin.photos.destroy', $photo->id))->assertRedirect();
        $this->assertSoftDeleted($photo);
        $this->assertSame(0, $album->fresh()->photos_count);

        $this->actingAs($admin)->post(route('admin.photos.restore', $photo->id))->assertRedirect();
        $this->assertSame(1, $album->fresh()->photos_count);

        $this->actingAs($admin)->delete(route('admin.photos.destroy', $photo->id));
        $this->actingAs($admin)->delete(route('admin.photos.destroy', $photo->id));
        $this->assertSame(0, Photo::withTrashed()->count());
        Storage::disk('public')->assertMissing($photo->path);
    }

    public function test_module_can_be_disabled(): void
    {
        $user = User::factory()->create();
        app(ModuleManager::class)->set('photos', false);

        $this->actingAs($user)->get(route('photos.user', $user))->assertNotFound();
        $this->actingAs($user)->get(route('profile.show', $user))
            ->assertInertia(fn (Assert $page) => $page->where('photosHref', null));
    }
}
