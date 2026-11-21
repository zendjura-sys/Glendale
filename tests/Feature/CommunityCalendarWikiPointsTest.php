<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\CommunityEvent;
use App\Models\CommunityWikiPage;
use App\Models\Post;
use App\Models\User;
use App\Services\CommunityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CommunityCalendarWikiPointsTest extends TestCase
{
    use RefreshDatabase;

    private function community(User $owner): Community
    {
        return app(CommunityService::class)->create($owner, [
            'name' => 'Кіберспорт UA', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN,
            'wall' => Community::WALL_OPEN, 'category' => 'esports',
        ]);
    }

    private function points(Community $community, User $user): int
    {
        return (int) $community->memberships()->where('user_id', $user->id)->value('points');
    }

    public function test_calendar_events_rsvp_and_points(): void
    {
        $owner = User::factory()->create();
        $community = $this->community($owner);
        $member = User::factory()->create();
        app(CommunityService::class)->join($community, $member);

        $this->actingAs($member)->post("/c/{$community->slug}/events", ['title' => 'Турнір', 'starts_at' => now()->addDay()->toIso8601String()])->assertForbidden();
        $this->actingAs($owner)->post("/c/{$community->slug}/events", ['title' => 'Турнір 5×5', 'starts_at' => now()->addDay()->toIso8601String(), 'place' => 'Голосовий «Лобі»'])->assertSessionHasNoErrors();
        $event = CommunityEvent::query()->firstOrFail();

        $this->actingAs($member)->post("/c/{$community->slug}/events/{$event->id}/rsvp", ['status' => 'going'])->assertRedirect();
        $this->actingAs($member)->post("/c/{$community->slug}/events/{$event->id}/rsvp", ['status' => 'maybe']);
        $this->actingAs($member)->post("/c/{$community->slug}/events/{$event->id}/rsvp", ['status' => 'going']);
        $this->assertSame(1, $event->fresh()->going_count);
        $this->assertSame(3, $this->points($community, $member)); // бали лише за першу відмітку

        $outsider = User::factory()->create();
        $this->actingAs($outsider)->post("/c/{$community->slug}/events/{$event->id}/rsvp", ['status' => 'going'])->assertForbidden();

        $this->actingAs($member)->get("/c/{$community->slug}/calendar?month=".$event->starts_at->format('Y-m'))->assertInertia(fn (Assert $page) => $page
            ->component('communities/calendar')
            ->where('events.0.title', 'Турнір 5×5')
            ->where('events.0.my', 'going')
            ->where('can.manage', false));

        // Запис і коментар у спільноті теж дають бали.
        $this->actingAs($member)->post('/posts', ['body' => 'Хто на турнір?', 'visibility' => 'public', 'community' => $community->slug])->assertSessionHasNoErrors();
        $post = Post::query()->where('wall_type', 'community')->firstOrFail();
        $this->assertSame(3 + 5, $this->points($community, $member));
        $this->actingAs($owner)->postJson("/posts/{$post->id}/comments", ['body' => 'Я!']);
        $this->actingAs($member)->postJson("/posts/{$post->id}/comments", ['body' => 'І я']);
        $this->assertSame(3 + 5 + 1, $this->points($community, $member));

        $this->actingAs($owner)->post("/c/{$community->slug}/points/{$member->id}", ['points' => 10])->assertRedirect();
        $this->actingAs($member)->getJson("/c/{$community->slug}/hub")->assertOk()->assertJsonPath('top.0.id', $member->id)->assertJsonPath('top.0.points', 19)->assertJsonPath('events.0.going', 1);
    }

    public function test_shared_event_stories_from_members(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create();
        $community = $this->community($owner);
        $event = CommunityEvent::query()->create(['community_id' => $community->id, 'user_id' => $owner->id, 'title' => 'Сходка', 'starts_at' => now()->subHour()]);
        $future = CommunityEvent::query()->create(['community_id' => $community->id, 'user_id' => $owner->id, 'title' => 'Потім', 'starts_at' => now()->addDays(3)]);

        $this->actingAs(User::factory()->create())->post("/c/{$community->slug}/events/{$event->id}/stories", ['media' => UploadedFile::fake()->image('a.jpg')])->assertForbidden();
        $this->actingAs($owner)->post("/c/{$community->slug}/events/{$future->id}/stories", ['media' => UploadedFile::fake()->image('a.jpg')])->assertStatus(422);
        $this->actingAs($owner)->post("/c/{$community->slug}/events/{$event->id}/stories", ['media' => UploadedFile::fake()->image('a.jpg', 1080, 1920), 'caption' => 'Всі тут!'])
            ->assertOk()->assertJsonPath('stories.0.caption', 'Всі тут!')->assertJsonPath('stories.0.author.id', $owner->id);
    }

    public function test_wiki_pages_history_and_revert(): void
    {
        $owner = User::factory()->create();
        $community = $this->community($owner);
        $member = User::factory()->create();
        app(CommunityService::class)->join($community, $member);

        $this->actingAs($member)->post("/c/{$community->slug}/wiki", ['title' => 'Гайд', 'body' => 'Текст'])->assertForbidden();
        $this->actingAs($owner)->post("/c/{$community->slug}/wiki", ['title' => 'Гайд для новачків', 'body' => "# Старт\nПерша версія"])->assertRedirect();
        $page = CommunityWikiPage::query()->firstOrFail();

        // Відкрита вікі — правити може й учасник.
        $community->update(['wiki_open' => true]);
        $this->actingAs($member)->post("/c/{$community->slug}/wiki", ['slug' => $page->slug, 'title' => 'Гайд для новачків', 'body' => 'Друга версія'])->assertRedirect();
        $this->assertSame('Друга версія', $page->fresh()->body);

        $show = $this->actingAs($owner)->get("/c/{$community->slug}/wiki/{$page->slug}");
        $show->assertInertia(fn (Assert $p) => $p->where('page.body', 'Друга версія')->has('page.revisions', 1));
        $revision = $show->viewData('page')['props']['page']['revisions'][0]['id'];

        $this->actingAs($owner)->post("/c/{$community->slug}/wiki/{$page->slug}/revert/{$revision}")->assertRedirect();
        $this->assertSame("# Старт\nПерша версія", $page->fresh()->body);
    }
}
