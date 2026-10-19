<?php

namespace Tests\Feature;

use App\Models\Movie;
use App\Models\MovieSource;
use App\Models\Post;
use App\Models\Track;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\FriendshipService;
use App\Services\Phones\PhoneNumbers;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Розділи сайту, які застосунок відкриває через міст /api/v1/site: ті самі контролери, відповіді — JSON. */
class AppSiteParityTest extends TestCase
{
    use RefreshDatabase;

    private function app_token(User $user): string
    {
        return app(ApiTokens::class)->issue($user, 'android');
    }

    public function test_app_player_reaches_episodes_progress_and_streams(): void
    {
        $user = User::factory()->create();
        $movie = Movie::query()->create(['slug' => 'bleach', 'type' => 'anime', 'title' => 'Бліч', 'is_published' => true, 'episodes_count' => 12]);
        $source = new MovieSource(['provider' => 'kodik', 'external_id' => 'serial-1', 'translation' => 'AniLibria', 'link' => 'https://kodik.info/serial/1/hash/720p']);
        $source->movie()->associate($movie)->save();
        $token = $this->app_token($user);

        $this->withToken($token)->getJson('/api/v1/site/cinema/bleach/episodes')->assertOk()->assertJsonStructure(['players']);
        $this->withToken($token)->putJson('/api/v1/site/cinema/bleach/progress', ['season' => 1, 'episode' => 3, 'position' => 125, 'player_key' => 'kodik:serial-1'])
            ->assertOk();
        $this->assertDatabaseHas('movie_user', ['user_id' => $user->id, 'movie_id' => $movie->id, 'position' => 125]);
        $this->withToken($token)->postJson('/api/v1/site/cinema/bleach/episodes', ['season' => 1, 'episode' => 3])->assertOk();
        $this->withToken($token)->getJson("/api/v1/site/cinema/bleach/stream?source={$source->id}&season=1&episode=3")
            ->assertOk()->assertJsonPath('available', false);
    }

    public function test_app_opens_saved_drafts_saved_messages_releases_top_ten_and_compare(): void
    {
        $user = User::factory()->create(['username' => 'neo']);
        $token = $this->app_token($user);
        $movie = Movie::query()->create(['slug' => 'matrix', 'type' => 'movie', 'title' => 'Матриця', 'is_published' => true]);

        $this->withToken($token)->postJson('/api/v1/site/saved', ['kind' => 'movie', 'id' => $movie->id])->assertOk()->assertJsonPath('saved', true);
        $this->withToken($token)->getJson('/api/v1/site/saved')->assertOk()->assertJsonPath('items.0.kind', 'movie');

        $draft = Post::query()->create(['author_id' => $user->id, 'wall_type' => $user->getMorphClass(), 'wall_id' => $user->id, 'body' => 'Чернетка', 'visibility' => 'public', 'is_draft' => true]);
        $this->withToken($token)->getJson('/api/v1/site/posts/drafts')->assertOk()->assertJsonPath('drafts.0.id', $draft->id);
        $this->withToken($token)->postJson("/api/v1/site/posts/{$draft->id}/publish")->assertOk()->assertJsonPath('ok', true);
        $this->assertFalse((bool) $draft->fresh()->is_draft);

        $this->withToken($token)->getJson('/api/v1/site/messages/saved')->assertOk()->assertJsonStructure(['items']);
        $this->withToken($token)->getJson('/api/v1/site/events/releases')->assertOk()->assertJsonStructure(['events']);

        $this->withToken($token)->postJson('/api/v1/site/cinema/ten', ['movie_id' => $movie->id])->assertOk();
        $this->withToken($token)->getJson('/api/v1/site/cinema/ten/neo')->assertOk()
            ->assertJsonPath('mine', true)->assertJsonPath('movies.0.slug', 'matrix');

        $this->withToken($token)->getJson('/api/v1/site/servers/compare')->assertOk()->assertJsonStructure(['servers']);

        $this->withToken($token)->postJson('/api/v1/site/me/pin', ['kind' => 'movie', 'id' => $movie->id])->assertOk()->assertJsonPath('pinned', true);
        $this->withToken($token)->getJson('/api/v1/site/invite')->assertOk()->assertJsonStructure(['link', 'ladder', 'people']);

        $this->withToken($token)->putJson('/api/v1/site/settings/stream', ['platform' => 'twitch', 'channel' => 'neo_live'])->assertOk()->assertJsonPath('ok', true);
        $this->withToken($token)->getJson('/api/v1/site/u/neo')->assertOk()->assertJsonPath('stream.channel', 'neo_live');
        $this->withToken($token)->deleteJson('/api/v1/site/settings/stream')->assertOk();
    }

    public function test_app_post_menu_matches_the_site(): void
    {
        $author = User::factory()->create();
        $reader = User::factory()->create();
        $post = Post::query()->create(['author_id' => $author->id, 'wall_type' => $author->getMorphClass(), 'wall_id' => $author->id, 'body' => 'Привіт', 'visibility' => 'public']);
        $authorToken = $this->app_token($author);
        $readerToken = $this->app_token($reader);

        $this->withToken($authorToken)->patchJson("/api/v1/site/posts/{$post->id}", ['body' => 'Привіт, світе'])->assertOk();
        $this->assertSame('Привіт, світе', $post->fresh()->body);

        $this->withToken($readerToken)->postJson('/api/v1/site/saved', ['kind' => 'post', 'id' => $post->id])->assertOk()->assertJsonPath('saved', true);
        $this->withToken($readerToken)->postJson("/api/v1/site/posts/{$post->id}/quote", ['body' => 'Класно'])->assertOk();
        $this->withToken($readerToken)->postJson("/api/v1/site/posts/{$post->id}/mute")->assertOk();
        $this->withToken($readerToken)->postJson("/api/v1/site/posts/{$post->id}/hide")->assertOk();
        $this->assertDatabaseHas('post_hides', ['user_id' => $reader->id, 'post_id' => $post->id]);
    }

    public function test_app_reads_and_switches_the_site_theme(): void
    {
        $user = User::factory()->create();
        $token = $this->app_token($user);

        $this->withToken($token)->getJson('/api/v1/me')->assertOk()->assertJsonPath('user.theme', 'system');
        $this->withToken($token)->putJson('/api/v1/site/settings/theme', ['theme' => 'light'])->assertOk()->assertJsonPath('ok', true);
        $this->assertSame('light', $user->fresh()->pref('theme'));
        $this->withToken($token)->getJson('/api/v1/me')->assertJsonPath('user.theme', 'light');
        $this->withToken($token)->putJson('/api/v1/site/settings/theme', ['theme' => 'neon'])->assertStatus(422);
    }

    public function test_app_player_reads_lyrics_like_the_site(): void
    {
        $user = User::factory()->create();
        $track = Track::query()->create([
            'user_id' => $user->id,
            'title' => 'Neon Skyline',
            'artist' => 'Nightdrive Kyiv',
            'duration' => 180,
            'path' => 'music/test.mp3',
            'mime' => 'audio/mpeg',
            'size' => 1000,
            'lyrics' => "[00:01.00]перший\n[00:05.00]другий\n[00:09.00]третій",
        ]);

        $this->withToken($this->app_token($user))->getJson("/api/v1/site/music/tracks/{$track->id}/lyrics")
            ->assertOk()->assertJsonPath('lyrics', "[00:01.00]перший\n[00:05.00]другий\n[00:09.00]третій");
    }

    public function test_app_phone_section_matches_the_site(): void
    {
        $user = User::factory()->create(['first_name' => 'Тоні']);
        $friend = User::factory()->create(['first_name' => 'Пеппер']);
        app(FriendshipService::class)->request($user, $friend);
        app(FriendshipService::class)->accept($friend, $user);
        $token = $this->app_token($user);

        $this->withToken($token)->getJson('/api/v1/site/phone')->assertOk()
            ->assertJsonStructure(['phone', 'codes', 'privacy', 'visible', 'history', 'incoming', 'outgoing', 'gifts', 'friends', 'nextRandomAt', 'cooldownDays']);

        $mine = $this->withToken($token)->postJson('/api/v1/site/phone/random')->assertOk()->json('phone.number');
        $theirs = app(PhoneNumbers::class)->random($friend)->formatted();

        $this->withToken($token)->getJson('/api/v1/site/phone/lookup?number='.urlencode($theirs))->assertOk()
            ->assertJsonPath('found', true)->assertJsonPath('user.id', $friend->id);
        $this->withToken($token)->getJson('/api/v1/site/phone/lookup?number='.urlencode($mine))->assertJsonPath('found', false);
        $this->withToken($token)->postJson('/api/v1/site/phone/dial', ['number' => $theirs])->assertOk()->assertJsonStructure(['conversation' => ['id'], 'can_call']);
        $this->withToken($token)->putJson('/api/v1/site/phone/settings', ['privacy' => 'friends', 'visible' => false])->assertOk()->assertJsonPath('ok', true);
        $this->assertSame('friends', $user->fresh()->pref('phone_privacy'));

        // Номер у профілі застосунку — як на сайті.
        $this->withToken($token)->getJson("/api/v1/users/{$friend->username}")->assertOk()->assertJsonPath('user.phone.number', $theirs);
        $this->withToken($this->app_token($friend))->getJson("/api/v1/users/{$user->username}")->assertJsonPath('user.phone', null);
    }

    public function test_app_follows_the_network_mode_like_the_site(): void
    {
        $user = User::factory()->create();
        $token = $this->app_token($user);

        $me = $this->withToken($token)->getJson('/api/v1/me')->assertOk()->json('user');
        $this->assertContains('cinema', $me['modules']);
        $this->assertNotEmpty($me['modes']);

        // «Мінімал» ховає кіно й ігрові розділи — і з меню застосунку теж.
        $this->withToken($token)->putJson('/api/v1/site/settings/mode', ['mode' => 'minimal'])->assertOk()->assertJsonPath('ok', true);
        $me = $this->withToken($token)->getJson('/api/v1/me')->json('user');
        $this->assertSame('minimal', $me['network_mode']);
        $this->assertNotContains('cinema', $me['modules']);
        $this->assertNotContains('servers', $me['modules']);
        $this->withToken($token)->putJson('/api/v1/site/settings/mode', ['mode' => 'nope'])->assertStatus(422);
    }
}
