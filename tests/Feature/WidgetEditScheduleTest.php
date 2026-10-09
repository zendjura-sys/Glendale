<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\Post;
use App\Models\User;
use App\Services\CommunityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class WidgetEditScheduleTest extends TestCase
{
    use RefreshDatabase;

    public function test_widget_edit_window_and_scheduled_post(): void
    {
        $owner = User::factory()->create();
        $friend = User::factory()->create(['username' => 'nova']);
        $open = app(CommunityService::class)->create($owner, [
            'name' => 'Кіберспорт UA',
            'type' => Community::TYPE_PUBLIC,
            'privacy' => Community::PRIVACY_OPEN,
            'wall' => Community::WALL_CLOSED,
            'category' => 'esports',
        ]);
        $this->actingAs($owner)->post(route('posts.store'), [
            'body' => 'Турнір у суботу',
            'visibility' => 'public',
            'community' => $open->slug,
        ])->assertRedirect();

        $this->getJson(route('communities.widget', $open))
            ->assertOk()
            ->assertHeader('Access-Control-Allow-Origin', '*')
            ->assertJsonPath('name', 'Кіберспорт UA')
            ->assertJsonPath('posts.0.text', 'Турнір у суботу');
        $this->get(route('communities.widget.script', $open))
            ->assertOk()
            ->assertHeader('Access-Control-Allow-Origin', '*')
            ->assertSee('/widget/'.$open->slug, false);

        $closed = app(CommunityService::class)->create($owner, [
            'name' => 'Закрита кімната',
            'type' => Community::TYPE_GROUP,
            'privacy' => Community::PRIVACY_CLOSED,
            'wall' => Community::WALL_CLOSED,
            'category' => 'games',
        ]);
        $this->getJson(route('communities.widget', $closed))->assertNotFound();
        $this->withoutVite()->actingAs($owner)->get(route('communities.edit', $open))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('widget', fn ($url) => is_string($url) && str_contains($url, '/card.js')));
        $this->withoutVite()->actingAs($owner)->get(route('communities.edit', $closed))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('widget', null));

        $post = Post::query()->where('body', 'Турнір у суботу')->sole();
        $this->actingAs($friend)->patch(route('posts.update', $post), ['body' => 'Чужий текст'])->assertForbidden();
        $this->actingAs($owner)->patch(route('posts.update', $post), ['body' => 'Турнір у неділю'])->assertRedirect();
        $this->assertSame('Турнір у неділю', $post->fresh()->body);
        $this->assertNotNull($post->fresh()->edited_at);
        $this->travel(Post::EDIT_MINUTES + 1)->minutes();
        $this->actingAs($owner)->patch(route('posts.update', $post), ['body' => 'Пізно'])->assertForbidden();

        $when = now()->addHour()->timezone('Europe/Kyiv')->format('Y-m-d H:i');
        $this->actingAs($owner)->post(route('posts.store'), [
            'body' => 'Скоро @nova',
            'visibility' => 'public',
            'publish_at' => $when,
        ])->assertRedirect(route('posts.drafts'));
        $scheduled = Post::query()->where('body', 'Скоро @nova')->sole();
        $this->assertTrue($scheduled->publish_at?->isFuture());
        $this->assertCount(0, $friend->fresh()->notifications);
        $this->assertNull(Post::query()->visibleTo($friend, [])->whereKey($scheduled->id)->first());

        $this->artisan('posts:publish')->assertSuccessful();
        $this->assertNotNull($scheduled->fresh()->publish_at);
        $this->travelTo($scheduled->publish_at->copy()->addMinute());
        $this->artisan('posts:publish')->assertSuccessful();
        $this->assertNull($scheduled->fresh()->publish_at);
        $this->assertNotNull(Post::query()->visibleTo($friend, [])->whereKey($scheduled->id)->first());
        $this->assertCount(1, $friend->fresh()->notifications);
    }
}
