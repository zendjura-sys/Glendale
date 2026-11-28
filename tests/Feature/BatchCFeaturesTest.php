<?php

namespace Tests\Feature;

use App\Models\Comment;
use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\Friendship;
use App\Models\GtaServer;
use App\Models\Post;
use App\Models\User;
use App\Services\CommunityDigest;
use App\Services\CommunityService;
use App\Services\Messenger;
use App\Services\PostPresenter;
use App\Services\Servers\ServerAnalytics;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Джерела переходів на сервер, тижневий дайджест спільноти, звання в коментарях, автомодерація груп. */
class BatchCFeaturesTest extends TestCase
{
    use RefreshDatabase;

    public function test_server_view_sources_are_counted(): void
    {
        $this->withoutVite();
        $owner = User::factory()->create();
        $server = GtaServer::query()->create(['slug' => 'quant', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp', 'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed']);
        $server->forceFill(['owner_id' => $owner->id])->save();

        $this->actingAs(User::factory()->create())->get(route('servers.show', $server), ['Referer' => url('/servers')]);
        $this->actingAs(User::factory()->create())->get(route('servers.show', $server), ['Referer' => 'https://www.google.com/search?q=quant']);
        $this->actingAs(User::factory()->create())->get(route('servers.show', $server));

        $sources = app(ServerAnalytics::class)->summary($server)['sources'];
        $this->assertSame(1, $sources['catalog']);
        $this->assertSame(1, $sources['search']);
        $this->assertSame(1, $sources['direct']);
        $this->assertSame('feed', ServerAnalytics::source(url('/feed')));
        $this->assertSame('external', ServerAnalytics::source('https://example.org/x'));
    }

    public function test_weekly_digest_posts_top_entries_when_enabled(): void
    {
        $owner = User::factory()->create();
        $community = app(CommunityService::class)->create($owner, ['name' => 'Кіберспорт', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN, 'wall' => Community::WALL_OPEN, 'category' => 'esports']);
        foreach ([5, 1, 9, 0] as $i => $likes) {
            Post::query()->create(['author_id' => $owner->id, 'wall_type' => 'community', 'wall_id' => $community->id, 'body' => "Запис $i", 'visibility' => 'public'])
                ->forceFill(['likes_count' => $likes])->save();
        }
        $this->assertNull(app(CommunityDigest::class)->publish($community));

        $community->update(['weekly_digest' => true]);
        $digest = app(CommunityDigest::class)->publish($community->fresh());
        $this->assertNotNull($digest);
        $this->assertTrue($digest->as_community);
        $this->assertStringStartsWith('Найкраще в спільноті за тиждень', (string) $digest->body);
        $this->assertStringContainsString('1. '.$owner->name.': «Запис 2»', (string) $digest->body);
    }

    public function test_comment_shows_community_title(): void
    {
        [$owner, $member] = User::factory()->count(2)->create();
        $community = app(CommunityService::class)->create($owner, ['name' => 'Клуб', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN, 'wall' => Community::WALL_OPEN, 'category' => 'esports']);
        app(CommunityService::class)->join($community, $member);
        CommunityMember::query()->where('community_id', $community->id)->where('user_id', $member->id)->update(['title' => 'Ветеран', 'color' => '#f59e0b']);
        $post = Post::query()->create(['author_id' => $owner->id, 'wall_type' => 'community', 'wall_id' => $community->id, 'body' => 'Привіт', 'visibility' => 'public']);
        $comment = Comment::query()->create(['post_id' => $post->id, 'user_id' => $member->id, 'body' => 'Вітаю']);

        $payload = app(PostPresenter::class)->comment($comment, $owner);
        $this->assertSame(['title' => 'Ветеран', 'color' => '#f59e0b'], $payload['badge']);
    }

    public function test_group_automod_blocks_links_caps_and_words_for_members(): void
    {
        // Акаунти старші за добу — щоб посилання не різало загальне правило для новачків.
        [$owner, $member] = User::factory()->count(2)->create(['created_at' => now()->subDays(3)]);
        Friendship::query()->create(['requester_id' => $owner->id, 'addressee_id' => $member->id, 'status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
        $group = app(Messenger::class)->createGroup($owner, 'Рейд', [$member->id]);

        $this->actingAs($member)->post("/messages/{$group->id}/automod", ['links' => true, 'caps' => true, 'flood' => false, 'words' => ''])->assertForbidden();
        $this->actingAs($owner)->post("/messages/{$group->id}/automod", ['links' => true, 'caps' => true, 'flood' => true, 'words' => 'чіт, бот'])->assertRedirect();
        $this->assertSame(['чіт', 'бот'], $group->fresh()->automod['words']);

        $send = fn (User $u, string $body) => $this->actingAs($u)->postJson("/messages/{$group->id}", ['body' => $body]);
        $send($member, 'дивись https://example.org')->assertUnprocessable()->assertJsonPath('errors.body.0', 'У цій групі посилання надсилають лише адміни.');
        $send($member, 'ГО ВСІ В РЕЙД ЗАРАЗ')->assertUnprocessable();
        $send($member, 'продаю ЧІТ недорого')->assertUnprocessable();
        $send($member, 'Привіт усім')->assertCreated();
        // Адміна правила не обмежують.
        $send($owner, 'ОСЬ ПОСИЛАННЯ https://example.org')->assertCreated();
    }
}
