<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\Story;
use App\Models\User;
use App\Services\FriendshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StoriesTest extends TestCase
{
    use RefreshDatabase;

    private User $author;

    private User $friend;

    private User $stranger;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->author = User::factory()->create();
        $this->friend = User::factory()->create();
        $this->stranger = User::factory()->create();
        $friendships = app(FriendshipService::class);
        $friendships->request($this->author, $this->friend);
        $friendships->accept($this->friend, $this->author);
    }

    private function publish(string $privacy = Story::PRIVACY_FRIENDS): Story
    {
        $this->actingAs($this->author)->post(route('stories.store'), [
            'media' => UploadedFile::fake()->image('sunset.jpg', 1080, 1920),
            'caption' => 'Захід сонця',
            'privacy' => $privacy,
        ], ['Accept' => 'application/json'])->assertCreated();

        return Story::query()->latest('id')->firstOrFail();
    }

    public function test_friends_see_stories_and_strangers_do_not(): void
    {
        $story = $this->publish();
        Storage::disk('public')->assertExists($story->path);

        $this->actingAs($this->friend)->getJson(route('stories.index'))
            ->assertOk()
            ->assertJsonPath('groups.0.user.id', $this->author->id)
            ->assertJsonPath('groups.0.all_seen', false)
            ->assertJsonPath('groups.0.stories.0.caption', 'Захід сонця')
            ->assertJsonPath('groups.0.stories.0.views_count', null);

        $this->actingAs($this->author)->getJson(route('stories.index'))->assertJsonPath('groups.0.own', true);
        $this->actingAs($this->stranger)->getJson(route('stories.index'))->assertJsonCount(0, 'groups');
        $this->actingAs($this->stranger)->postJson(route('stories.view', $story))->assertNotFound();
    }

    public function test_public_story_is_open_from_profile(): void
    {
        $this->publish(Story::PRIVACY_EVERYONE);

        $this->actingAs($this->stranger)->getJson(route('stories.user', $this->author))
            ->assertOk()
            ->assertJsonPath('group.user.id', $this->author->id);
    }

    public function test_views_reactions_and_replies(): void
    {
        $story = $this->publish();

        $this->actingAs($this->friend)->postJson(route('stories.view', $story))->assertOk();
        $this->actingAs($this->friend)->postJson(route('stories.view', $story))->assertOk();
        $this->assertSame(1, $story->fresh()->views_count);
        $this->actingAs($this->friend)->getJson(route('stories.index'))->assertJsonPath('groups.0.all_seen', true);

        $this->actingAs($this->friend)->postJson(route('stories.react', $story), ['reaction' => '🔥'])->assertOk();
        $this->assertSame('🔥 на вашу історію', Message::query()->latest('id')->value('body'));
        $this->actingAs($this->friend)->postJson(route('stories.reply', $story), ['body' => 'Красиво!'])->assertOk();
        $this->assertSame('Відповідь на вашу історію: Красиво!', Message::query()->latest('id')->value('body'));

        $this->actingAs($this->friend)->getJson(route('stories.viewers', $story))->assertForbidden();
        $this->actingAs($this->author)->getJson(route('stories.viewers', $story))
            ->assertOk()
            ->assertJsonPath('viewers.0.id', $this->friend->id)
            ->assertJsonPath('viewers.0.reaction', '🔥');
    }

    public function test_video_story_and_expiry(): void
    {
        $this->actingAs($this->author)->post(route('stories.store'), [
            'media' => UploadedFile::fake()->create('clip.mp4', 2048, 'video/mp4'),
            'duration' => 12,
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('story.media_type', Story::TYPE_VIDEO)
            ->assertJsonPath('story.duration', 12);

        $story = Story::query()->sole();
        $story->forceFill(['expires_at' => now()->subMinute()])->save();
        $this->actingAs($this->friend)->getJson(route('stories.index'))->assertJsonCount(0, 'groups');

        $this->artisan('stories:prune')->assertSuccessful();
        $this->assertSame(0, Story::query()->count());
        Storage::disk('public')->assertMissing($story->path);
    }

    public function test_only_author_deletes(): void
    {
        $story = $this->publish();
        $this->actingAs($this->friend)->deleteJson(route('stories.destroy', $story))->assertForbidden();
        $this->actingAs($this->author)->deleteJson(route('stories.destroy', $story))->assertOk();
        $this->assertSame(0, Story::query()->count());
    }
}
