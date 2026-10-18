<?php

namespace Tests\Feature;

use App\Models\Clan;
use App\Models\ClanEvent;
use App\Models\ClanMember;
use App\Models\Community;
use App\Models\Feedback;
use App\Models\Game;
use App\Models\Post;
use App\Models\User;
use App\Services\CommunityService;
use App\Services\Games\GameCatalog;
use App\Support\I18n\LanguageGuess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class GeneralExtrasTest extends TestCase
{
    use RefreshDatabase;

    public function test_language_is_guessed_from_text(): void
    {
        $this->assertSame('uk', LanguageGuess::guess('Привіт, сьогодні граємо рейд о дев’ятій'));
        $this->assertSame('ru', LanguageGuess::guess('Привет, сегодня играем рейд вечером, кто будет?'));
        $this->assertSame('en', LanguageGuess::guess('Hello everyone, the raid starts at nine tonight'));
        $this->assertSame('de', LanguageGuess::guess('Heute spielen wir zusammen und das ist nicht schwer'));
        $this->assertSame('ja', LanguageGuess::guess('今日は一緒にゲームをしましょう、楽しいです'));
        $this->assertSame('kk', LanguageGuess::guess('Сәлем, бүгін кешке ойнаймыз достар'));
        $this->assertNull(LanguageGuess::guess('ок 👍'));
    }

    public function test_feed_filters_posts_by_language_and_posts_show_their_language(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->post(route('posts.store'), ['body' => 'Привіт усім, сьогодні ввечері граємо разом', 'visibility' => 'public']);
        $this->actingAs($user)->post(route('posts.store'), ['body' => 'Hello everyone, we are playing together tonight', 'visibility' => 'public']);
        $this->assertSame(['uk', 'en'], Post::query()->orderBy('id')->pluck('lang')->all());

        $this->actingAs($user)->get('/feed?tab=discover&lang=en')
            ->assertInertia(fn (Assert $page) => $page->where('lang', 'en')->has('posts.data', 1)->where('posts.data.0.lang', 'en'));
        $this->actingAs($user)->get('/feed?tab=discover&lang=xx')
            ->assertInertia(fn (Assert $page) => $page->where('lang', null)->has('posts.data', 2));
    }

    public function test_feed_card_shows_tomorrows_clan_event(): void
    {
        app(GameCatalog::class)->seed();
        $user = User::factory()->create(['last_seen_at' => now()]);
        $clan = Clan::query()->create(['game_id' => Game::query()->where('slug', 'counter-strike-2')->value('id'), 'slug' => 'navi', 'type' => 'clan', 'name' => 'NaVi', 'tag' => 'NAVI', 'owner_id' => $user->id, 'features' => ['events'], 'join_mode' => 'open']);
        ClanMember::query()->create(['clan_id' => $clan->id, 'user_id' => $user->id, 'rank' => Clan::LEADER_RANK, 'status' => ClanMember::STATUS_ACTIVE, 'joined_at' => now()]);
        $tomorrow = now('Europe/Kyiv')->addDay()->setTime(20, 0);
        ClanEvent::query()->create(['clan_id' => $clan->id, 'title' => 'Рейд завтра', 'starts_at' => $tomorrow->utc()]);
        ClanEvent::query()->create(['clan_id' => $clan->id, 'title' => 'Рейд за тиждень', 'starts_at' => now()->addDays(6)]);

        $this->actingAs($user)->get('/feed')
            ->assertInertia(fn (Assert $page) => $page->loadDeferredProps('events', fn (Assert $reload) => $reload
                ->has('tomorrow', 1)
                ->where('tomorrow.0.title', 'Рейд завтра')));
    }

    public function test_shared_community_post_says_where_it_came_from(): void
    {
        [$owner, $reader] = User::factory()->count(2)->create();
        $community = app(CommunityService::class)->create($owner, ['name' => 'Новини GTA', 'type' => Community::TYPE_PUBLIC, 'privacy' => Community::PRIVACY_OPEN, 'wall' => Community::WALL_CLOSED, 'category' => 'games']);
        $this->actingAs($owner)->post(route('posts.store'), ['body' => 'Вийшло оновлення сервера', 'visibility' => 'public', 'community' => $community->slug]);
        $post = Post::query()->sole();

        $this->actingAs($reader)->post(route('posts.share', $post))->assertRedirect();
        $copy = Post::query()->where('author_id', $reader->id)->sole();

        $this->actingAs($reader)->get(route('posts.show', $copy))
            ->assertInertia(fn (Assert $page) => $page
                ->where('post.shared.name', 'Новини GTA')
                ->where('post.shared.community.href', '/c/'.$community->slug)
                ->where('post.shared.post_href', '/posts/'.$post->id));
    }

    public function test_feedback_reaches_admins(): void
    {
        $user = User::factory()->create();
        $admin = User::factory()->admin()->create();

        $this->actingAs($user)->post(route('feedback.store'), ['kind' => 'idea', 'body' => 'Додайте темну тему для чату', 'url' => '/messages'])->assertRedirect();
        $this->actingAs($user)->post(route('feedback.store'), ['kind' => 'bug', 'body' => 'Зламана кнопка', 'url' => 'https://evil.example/'])->assertRedirect();
        $this->assertSame(['/messages', null], Feedback::query()->orderBy('id')->pluck('url')->all());

        $this->actingAs($user)->get(route('admin.moderation.index'))->assertForbidden();
        $this->actingAs($admin)->get(route('admin.moderation.index'))
            ->assertInertia(fn (Assert $page) => $page->has('feedback', 2)->where('stats.feedback', 2));

        $first = Feedback::query()->orderBy('id')->firstOrFail();
        $this->actingAs($admin)->post(route('admin.moderation.feedback.read', $first))->assertRedirect();
        $this->assertSame(Feedback::READ, $first->fresh()?->status);
    }
}
