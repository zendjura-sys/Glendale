<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\Post;
use App\Models\User;
use App\Notifications\AccountNotice;
use App\Services\CommunityService;
use App\Services\Feed\KeywordAlerts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PollsAlertsLaterWelcomeTest extends TestCase
{
    use RefreshDatabase;

    public function test_open_poll_shows_voters_anonymous_does_not(): void
    {
        $author = User::factory()->create();
        $voter = User::factory()->create();
        $this->actingAs($author)->post('/posts', ['visibility' => 'public', 'poll' => ['question' => 'Яка гра?', 'options' => ['CS2', 'Dota'], 'anonymous' => 0]])->assertSessionHasNoErrors();
        $this->actingAs($author)->post('/posts', ['visibility' => 'public', 'poll' => ['question' => 'Таємно?', 'options' => ['Так', 'Ні']]])->assertSessionHasNoErrors();
        [$open, $secret] = Post::query()->orderBy('id')->with('poll.options')->get()->all();

        $this->actingAs($voter)->postJson("/posts/{$open->id}/poll", ['option_id' => $open->poll->options[0]->id])->assertOk()
            ->assertJsonPath('anonymous', false)
            ->assertJsonPath('options.0.voters.0.id', $voter->id);
        $this->actingAs($voter)->postJson("/posts/{$secret->id}/poll", ['option_id' => $secret->poll->options[0]->id])->assertOk()
            ->assertJsonPath('anonymous', true)
            ->assertJsonPath('options.0.voters', []);
    }

    public function test_keyword_alert_notifies_once_per_hour(): void
    {
        Notification::fake();
        $fan = User::factory()->create();
        $author = User::factory()->create();
        $this->actingAs($fan)->postJson('/settings/keyword-alerts', ['keyword' => 'Турнір'])->assertOk()->assertJsonPath('keywords', ['турнір']);
        $this->actingAs($fan)->postJson('/settings/keyword-alerts', ['keyword' => 'ab'])->assertUnprocessable();

        $this->actingAs($author)->post('/posts', ['visibility' => 'public', 'body' => 'У суботу турнір з CS2!']);
        $this->actingAs($author)->post('/posts', ['visibility' => 'public', 'body' => 'Ще один турнір']);
        $this->actingAs($author)->post('/posts', ['visibility' => 'friends', 'body' => 'Приватний турнір']);
        $this->actingAs($author)->post('/posts', ['visibility' => 'public', 'body' => 'Турнірна таблиця']);
        Notification::assertSentToTimes($fan, AccountNotice::class, 1);

        // Автор не отримує сповіщення про власний запис.
        app(KeywordAlerts::class)->add($author, 'суботу');
        $this->actingAs($author)->post('/posts', ['visibility' => 'public', 'body' => 'Знову в суботу']);
        Notification::assertNotSentTo($author, AccountNotice::class);

        $this->actingAs($fan)->deleteJson('/settings/keyword-alerts', ['keyword' => 'турнір'])->assertOk()->assertJsonPath('keywords', []);
    }

    public function test_read_later_queue(): void
    {
        $user = User::factory()->create();
        $post = Post::factory()->create(['visibility' => 'public']);
        $private = Post::factory()->create(['visibility' => 'private']);

        $this->actingAs($user)->postJson("/posts/{$post->id}/later")->assertOk()->assertJsonPath('later', true);
        $this->actingAs($user)->postJson("/posts/{$private->id}/later")->assertNotFound();
        $this->actingAs($user)->get('/later')->assertInertia(fn (Assert $page) => $page->component('later/index')->has('posts', 1)->where('posts.0.id', $post->id));
        $this->actingAs($user)->postJson("/posts/{$post->id}/later")->assertJsonPath('later', false);
        $this->actingAs($user)->getJson('/later')->assertJsonPath('posts', []);
    }

    public function test_welcome_card_for_newcomer_and_admin(): void
    {
        $owner = User::factory()->create();
        $community = app(CommunityService::class)->create($owner, ['name' => 'Клан', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN, 'wall' => Community::WALL_OPEN, 'category' => 'esports']);
        $community->forceFill(['welcome' => 'Привіт! Тут грають у CS2.'])->save();
        $newbie = User::factory()->create();
        app(CommunityService::class)->join($community, $newbie);

        $this->actingAs($newbie)->get("/c/{$community->slug}")->assertInertia(fn (Assert $page) => $page
            ->where('welcome_card.kind', 'member')->where('welcome_card.text', 'Привіт! Тут грають у CS2.'));
        $this->actingAs($owner)->get("/c/{$community->slug}")->assertInertia(fn (Assert $page) => $page
            ->where('welcome_card.kind', 'admin')->where('welcome_card.count', 1));

        $this->actingAs($newbie)->postJson("/c/{$community->slug}/welcome-seen")->assertOk();
        $this->actingAs($newbie)->get("/c/{$community->slug}")->assertInertia(fn (Assert $page) => $page->where('welcome_card', null));
    }
}
