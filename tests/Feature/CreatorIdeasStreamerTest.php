<?php

namespace Tests\Feature;

use App\Models\Idea;
use App\Models\Like;
use App\Models\Post;
use App\Models\User;
use App\Services\Achievements;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CreatorIdeasStreamerTest extends TestCase
{
    use RefreshDatabase;

    public function test_secret_achievement_is_hidden_until_found(): void
    {
        $user = User::factory()->create();
        $badge = fn () => collect(app(Achievements::class)->for($user->fresh())['badges'])->firstWhere('key', 'konami');

        $this->assertSame('Секретне досягнення', $badge()['title']);
        $this->assertFalse($badge()['earned']);

        $this->actingAs($user)->postJson('/secrets/night_owl')->assertNotFound();
        $this->actingAs($user)->postJson('/secrets/konami')->assertOk()->assertJsonPath('unlocked', true);
        $this->actingAs($user)->postJson('/secrets/konami')->assertOk()->assertJsonPath('unlocked', false);

        $this->assertSame('Старий код', $badge()['title']);
        $this->assertTrue($badge()['earned']);
    }

    public function test_night_post_unlocks_night_owl(): void
    {
        Carbon::setTestNow(CarbonImmutable::parse('2026-11-03 03:30', 'Europe/Kyiv'));
        $user = User::factory()->create();
        $this->actingAs($user)->post('/posts', ['body' => 'Не сплю', 'visibility' => 'public'])->assertSessionHasNoErrors();
        $this->assertContains('night_owl', $user->fresh()->pref('secrets'));
        Carbon::setTestNow();
    }

    public function test_author_stats_are_counted_for_last_30_days(): void
    {
        $author = User::factory()->create();
        $fan = User::factory()->create();
        $post = Post::query()->create(['author_id' => $author->id, 'wall_type' => $author->getMorphClass(), 'wall_id' => $author->id, 'body' => 'Мій найкращий запис', 'visibility' => 'public']);
        $post->forceFill(['views_count' => 42])->save();
        Like::query()->create(['user_id' => $fan->id, 'likeable_type' => 'post', 'likeable_id' => $post->id]);

        $this->actingAs($author)->getJson('/me/author-stats')->assertOk()
            ->assertJsonPath('totals.posts', 1)
            ->assertJsonPath('totals.views', 42)
            ->assertJsonPath('totals.likes', 1)
            ->assertJsonPath('top.0.excerpt', 'Мій найкращий запис')
            ->assertJsonCount(30, 'days');
    }

    public function test_ideas_board_votes_and_staff_status(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $this->actingAs($user)->post('/ideas', ['title' => 'Темна тема для віджетів'])->assertSessionHasNoErrors();
        $idea = Idea::query()->firstOrFail();
        $this->assertSame(1, $idea->votes_count);

        $this->actingAs($other)->post("/ideas/{$idea->id}/vote")->assertRedirect();
        $this->assertSame(2, $idea->fresh()->votes_count);
        $this->actingAs($other)->post("/ideas/{$idea->id}/vote");
        $this->assertSame(1, $idea->fresh()->votes_count);

        $this->actingAs($other)->patch("/ideas/{$idea->id}", ['status' => 'planned'])->assertForbidden();
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->patch("/ideas/{$idea->id}", ['status' => 'planned', 'answer' => 'Беремо в листопаді'])->assertRedirect();
        $this->assertSame('planned', $idea->fresh()->status);

        $this->actingAs($user)->get('/ideas')->assertInertia(fn (Assert $page) => $page
            ->component('ideas/index')
            ->where('ideas.data.0.voted', true)
            ->where('ideas.data.0.answer', 'Беремо в листопаді'));
    }

    public function test_streamer_mode_is_shared_with_the_page(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->patch('/settings/streamer-mode', ['streamer_mode' => true])->assertRedirect();
        $this->actingAs($user)->get('/settings/appearance')->assertInertia(fn (Assert $page) => $page->where('auth.user.streamer_mode', true));
        $this->actingAs($user)->get('/settings/pixel-avatar')->assertInertia(fn (Assert $page) => $page->component('settings/pixel-avatar'));
    }
}
