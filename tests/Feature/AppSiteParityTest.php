<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\Game;
use App\Models\GtaServer;
use App\Models\Movie;
use App\Models\MovieSource;
use App\Models\PartyPost;
use App\Models\PartyTimeSlot;
use App\Models\Post;
use App\Models\QuestClaim;
use App\Models\Season;
use App\Models\TierList;
use App\Models\Tournament;
use App\Models\Track;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\CommunityService;
use App\Services\FriendshipService;
use App\Services\Messenger;
use App\Services\Phones\PhoneNumbers;
use App\Services\Quests\SeasonPass;
use App\Support\Net\PublicUrl;
use App\Support\Seasons;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Розділи сайту, які застосунок відкриває через міст /api/v1/site: ті самі контролери, відповіді — JSON. */
class AppSiteParityTest extends TestCase
{
    use RefreshDatabase;

    private function app_token(User $user): string
    {
        return app(ApiTokens::class)->issue($user, 'android');
    }

    public function test_app_music_picker_finds_my_and_all_tracks(): void
    {
        $user = User::factory()->create();
        $token = $this->app_token($user);
        $mine = Track::query()->create(['user_id' => $user->id, 'title' => 'Paparazzi', 'artist' => 'Xzibit', 'duration' => 180, 'path' => 'music/a.mp3', 'mime' => 'audio/mpeg', 'size' => 1]);
        $user->library()->attach($mine->id);
        Track::query()->create(['user_id' => null, 'title' => 'X', 'artist' => 'Xzibit', 'duration' => 180, 'path' => 'music/b.mp3', 'mime' => 'audio/mpeg', 'size' => 1]);

        // «Прикріпити музику» в застосунку: вкладки «Мої» й «Усі на GameCon» — списки треків, а не сторінка пошуку.
        $this->withToken($token)->getJson('/api/v1/site/music/search?q=xzibit&scope=mine')->assertOk()->assertJsonCount(1, 'tracks')->assertJsonPath('tracks.0.title', 'Paparazzi');
        $this->withToken($token)->getJson('/api/v1/site/music/search?q=xzibit&scope=all')->assertOk()->assertJsonCount(2, 'tracks');
    }

    public function test_app_reaches_game_backlog(): void
    {
        $user = User::factory()->create(['username' => 'neo']);
        $token = $this->app_token($user);
        Game::query()->create(['slug' => 'dota', 'name' => 'Dota 2', 'letter' => 'D', 'category' => 'pc', 'is_published' => true]);

        $this->withToken($token)->putJson('/api/v1/site/games/dota/backlog', ['status' => 'playing'])->assertOk()->assertJsonPath('status', 'playing');
        $this->withToken($token)->getJson('/api/v1/site/games/backlog')->assertOk()->assertJsonStructure(['owner', 'mine', 'board' => ['want', 'playing', 'done', 'dropped'], 'friends']);
        $this->withToken($token)->getJson('/api/v1/site/games/backlog/neo')->assertOk()->assertJsonPath('board.playing.0.game.slug', 'dota');
        // Новини й патчі гри (у гри без Steam — порожньо).
        $this->withToken($token)->getJson('/api/v1/site/games/dota/news')->assertOk()->assertJsonPath('items', [])->assertJsonPath('steam', false);
    }

    public function test_app_votes_for_party_time(): void
    {
        $user = User::factory()->create();
        $party = PartyPost::query()->create(['user_id' => $user->id, 'title' => 'Рейд', 'slots' => 4, 'expires_at' => now()->addDays(2)]);
        $slot = PartyTimeSlot::query()->create(['party_post_id' => $party->id, 'starts_at' => now()->addDay()]);

        $this->withToken($this->app_token($user))->postJson("/api/v1/site/party/{$party->id}/time", ['slots' => [$slot->id]])->assertSuccessful();
        $this->assertDatabaseHas('party_time_votes', ['party_time_slot_id' => $slot->id, 'user_id' => $user->id]);
    }

    public function test_app_opens_community_channels(): void
    {
        $user = User::factory()->create();
        $community = app(CommunityService::class)->create($user, [
            'name' => 'Клан', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN,
            'wall' => Community::WALL_OPEN, 'category' => 'esports',
        ]);
        $token = $this->app_token($user);

        $this->withToken($token)->postJson("/api/v1/site/c/{$community->slug}/channels", ['name' => 'стратегії', 'type' => 'text'])->assertSuccessful();
        $channel = $community->channels()->where('name', 'стратегії')->firstOrFail();
        $this->withToken($token)->getJson("/api/v1/site/c/{$community->slug}/channels/{$channel->id}")->assertOk();
    }

    public function test_app_changes_community_access(): void
    {
        $user = User::factory()->create();
        $community = app(CommunityService::class)->create($user, [
            'name' => 'Клан', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN,
            'wall' => Community::WALL_OPEN, 'category' => 'esports',
        ]);

        $this->withToken($this->app_token($user))->putJson("/api/v1/site/c/{$community->slug}/settings/access", [
            'is_listed' => false, 'guest_view' => true, 'password' => 'clan-2026',
        ])->assertSuccessful();
        $community->refresh();
        $this->assertFalse($community->is_listed);
        $this->assertTrue($community->guest_view);
        $this->assertNotNull($community->join_password);
    }

    public function test_app_uses_chat_tools(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        app(FriendshipService::class)->request($owner, $member);
        app(FriendshipService::class)->accept($member, $owner);
        $chat = app(Messenger::class)->createGroup($owner, 'Рейд', [$member->id]);
        $token = $this->app_token($owner);

        $this->withToken($token)->getJson("/api/v1/site/messages/{$chat->id}/shared?kind=links")->assertOk()->assertJsonStructure(['items', 'counts']);
        $this->withToken($token)->postJson("/api/v1/site/messages/{$chat->id}/members/{$member->username}/restrict", ['kind' => 'timeout', 'minutes' => 5])->assertSuccessful();
        $this->assertNotNull($chat->participants()->where('user_id', $member->id)->value('timeout_until'));
        $this->withToken($token)->postJson("/api/v1/site/messages/{$chat->id}/background", ['preset' => 'dots'])->assertSuccessful();
        $this->withToken($token)->putJson("/api/v1/site/messages/{$chat->id}/bots/welcome", ['enabled' => true, 'body' => 'Привіт, {name}!'])->assertOk();
        $this->withToken($token)->getJson("/api/v1/site/messages/{$chat->id}/bots")->assertOk()->assertJsonPath('welcome.body', 'Привіт, {name}!');

        // ШІ з ключем сайту: переписати, підсумок, ШІ-бот.
        app(SiteSettings::class)->putSecret('ai_key', 'sk-ant-test-key');
        Http::fake(['api.anthropic.com/*' => Http::response(['content' => [['type' => 'text', 'text' => 'Гаразд']], 'stop_reason' => 'end_turn'])]);
        $this->withToken($token)->postJson('/api/v1/site/ai/rewrite', ['text' => 'гаразд', 'mode' => 'fix'])->assertOk()->assertJsonPath('text', 'Гаразд');
        $this->withToken($token)->postJson("/api/v1/site/messages/{$chat->id}/ai/summary")->assertOk();
        $this->withToken($token)->putJson("/api/v1/site/messages/{$chat->id}/bots/ai", ['enabled' => true, 'bot_name' => 'ШІ'])->assertOk()->assertJsonPath('ai.enabled', true);

        // Бан гостя доступний і з застосунку (у звичайній групі гостей немає — 422).
        $plain = app(Messenger::class)->send($chat, $member, 'Привіт');
        $this->withToken($token)->postJson("/api/v1/site/messages/{$chat->id}/messages/{$plain->id}/ban-guest", ['days' => 1])->assertUnprocessable();
    }

    public function test_app_reaches_group_catch_up(): void
    {
        $owner = User::factory()->create();
        $me = User::factory()->create();
        app(FriendshipService::class)->request($owner, $me);
        app(FriendshipService::class)->accept($me, $owner);
        $chat = app(Messenger::class)->createGroup($owner, 'Рейд', [$me->id]);

        $this->withToken($this->app_token($me))->getJson("/api/v1/site/messages/{$chat->id}/catch-up")->assertOk()->assertJsonPath('catch_up', null);
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
        $this->withToken($token)->patchJson('/api/v1/site/settings/listening', ['show_listening' => false])->assertOk()->assertJsonPath('ok', true);
        $this->assertFalse($user->fresh()->showsListening());
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

    public function test_app_downloads_original_track_for_offline_music(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('music/offline.flac', 'flac-bytes');
        $user = User::factory()->create();
        $track = Track::query()->create([
            'user_id' => $user->id,
            'title' => 'Neon',
            'artist' => 'Nightdrive',
            'duration' => 100,
            'path' => 'music/offline.flac',
            'mime' => 'audio/flac',
            'size' => 10,
        ]);

        $response = $this->withToken($this->app_token($user))->get("/api/v1/site/music/tracks/{$track->id}/download");
        $response->assertOk();
        $this->assertSame('flac-bytes', $response->streamedContent());
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
        // Кнопки ШІ в чаті застосунку показуються за тими самими плагінами, що й на сайті.
        $this->assertSame(['ai_writer', 'ai_summary'], array_keys($me['ai']));
        $this->assertArrayHasKey('gif_search', $me['plugins']);
        // GIF із пошуку в новому записі — тим самим маршрутом застосунку, що й фото.
        $this->withToken($token)->post('/api/v1/posts', ['visibility' => 'public', 'gif' => ['url' => 'https://media2.giphy.com/media/abc/giphy.gif', 'title' => 'GG']], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('post.card.kind', 'gif');
        $this->withToken($token)->getJson('/api/v1/site/gifs?q=gg')->assertOk()->assertJsonStructure(['configured', 'gifs']);
        // Сезонні прикраси: застосунок отримує той самий сезон, що й сайт.
        app(SiteSettings::class)->put([Seasons::SETTING => 'halloween']);
        $this->assertSame('halloween', $this->withToken($token)->getJson('/api/v1/me')->json('user.season'));
        app(SiteSettings::class)->put([Seasons::SETTING => 'off']);
        $this->assertNull($this->withToken($token)->getJson('/api/v1/me')->json('user.season'));

        // «Мінімал» ховає кіно й ігрові розділи — і з меню застосунку теж.
        $this->withToken($token)->putJson('/api/v1/site/settings/mode', ['mode' => 'minimal'])->assertOk()->assertJsonPath('ok', true);
        $me = $this->withToken($token)->getJson('/api/v1/me')->json('user');
        $this->assertSame('minimal', $me['network_mode']);
        $this->assertNotContains('cinema', $me['modules']);
        $this->assertNotContains('servers', $me['modules']);
        $this->withToken($token)->putJson('/api/v1/site/settings/mode', ['mode' => 'nope'])->assertStatus(422);
    }

    public function test_app_opens_wrapped_through_site_bridge(): void
    {
        $this->travelTo(now()->setDate(2026, 12, 3));
        $user = User::factory()->create();
        DB::table('music_plays')->insert(['user_id' => $user->id, 'title' => 'Afterglow', 'artist' => 'Vira Echo', 'played_at' => now()->subDay()]);
        $token = $this->app_token($user);

        $this->withToken($token)->getJson('/api/v1/site/wrapped')->assertOk()
            ->assertJsonPath('wrapped.year', 2026)
            ->assertJsonPath('wrapped.music.top_tracks.0.title', 'Afterglow');
    }

    public function test_app_imports_tracks_by_link_through_bridge(): void
    {
        Http::fake(['files.example.com/*' => Http::response('<html></html>', 200, ['Content-Type' => 'text/html'])]);
        $this->app->instance(PublicUrl::class, new PublicUrl(fn () => ['93.184.216.34']));
        $token = $this->app_token(User::factory()->create());

        $id = $this->withToken($token)->postJson('/api/v1/site/music/tracks/import', ['url' => 'https://files.example.com/song.mp3'])
            ->assertStatus(202)->assertJsonPath('import.host', 'files.example.com')->json('import.id');
        $this->withToken($token)->getJson('/api/v1/site/music/imports')->assertOk()->assertJsonPath('imports.0.id', $id);
        $this->withToken($token)->deleteJson("/api/v1/site/music/imports/{$id}")->assertOk();
    }

    public function test_app_opens_apple_style_music_sections_through_bridge(): void
    {
        $user = User::factory()->create();
        $token = $this->app_token($user);
        $track = Track::query()->create(['title' => 'Neon', 'artist' => 'Nightdrive', 'album' => 'Run', 'genre' => 'Synthwave', 'duration' => 100, 'path' => 'music/a.mp3', 'mime' => 'audio/mpeg', 'size' => 1]);

        foreach (['home', 'new', 'radio', 'library', 'library/songs', 'library/albums', 'charts', 'replay', 'find?q=Neon'] as $path) {
            $this->withToken($token)->getJson('/api/v1/site/music/'.$path)->assertOk();
        }
        $this->withToken($token)->getJson('/api/v1/site/music/artist?name=Nightdrive')->assertOk()->assertJsonPath('artist.name', 'Nightdrive');
        $this->withToken($token)->getJson('/api/v1/site/music/album?artist=Nightdrive&title=Run')->assertOk()->assertJsonPath('album.tracks.0.id', $track->id);
        $this->withToken($token)->getJson('/api/v1/site/music/station?key=genre:Synthwave')->assertOk()->assertJsonPath('tracks.0.id', $track->id);
        $this->withToken($token)->postJson("/api/v1/site/music/tracks/{$track->id}/favorite")->assertOk()->assertJsonPath('favorite', true);
        $this->withToken($token)->getJson('/api/v1/site/music/playlists/mine')->assertOk()->assertJsonStructure(['playlists']);

        // «Про виконавця» й текст пісні з відкритого каталогу — ті самі шляхи, що на сайті.
        Http::fake(['*' => Http::response([])]);
        $this->withToken($token)->getJson('/api/v1/site/music/artist/info?name=Nightdrive')->assertOk()->assertJsonStructure(['info' => ['bio', 'origin']]);
        $this->withToken($token)->getJson('/api/v1/site/music/lyrics/find?artist=Nightdrive&title=Neon')->assertOk()->assertJsonPath('lyrics', null);
    }

    public function test_app_joins_gamecon_connect_through_bridge(): void
    {
        $user = User::factory()->create();
        $token = $this->app_token($user);

        $this->actingAs($user)->postJson('/music/connect/heartbeat', ['device_id' => 'web-device-0001', 'name' => 'Chrome · Windows', 'kind' => 'web'])->assertOk();
        $this->withToken($token)->postJson('/api/v1/site/music/connect/heartbeat', ['device_id' => 'app-device-0002', 'name' => 'Pixel 8', 'kind' => 'app'])
            ->assertOk()->assertJsonCount(2, 'devices')->assertJsonStructure(['devices' => [['id', 'name', 'kind', 'last_seen', 'is_active', 'state']], 'active_device_id', 'commands']);
        $this->withToken($token)->postJson('/api/v1/site/music/connect/command', ['target_device_id' => 'web-device-0001', 'action' => 'pause'])->assertStatus(202);
    }

    public function test_app_opens_the_season_pass_claims_and_equips(): void
    {
        $user = User::factory()->create();
        $token = $this->app_token($user);
        $pass = app(SeasonPass::class);
        Season::query()->create(['key' => $pass->currentKey(), 'title' => 'Сезон', 'theme' => 'neon', 'rewards' => ['1' => ['free' => ['type' => 'frame', 'value' => 'pass_mint'], 'plus' => ['type' => 'badge', 'value' => 'pass_star']]]]);
        QuestClaim::query()->create(['user_id' => $user->id, 'quest' => 'post', 'day' => now()->toDateString(), 'season' => $pass->currentKey(), 'xp' => 500]);

        $this->withToken($token)->getJson('/api/v1/site/season')->assertOk()
            ->assertJsonPath('plus', false)->assertJsonPath('levels.0.free.value', 'pass_mint')->assertJsonStructure(['season' => ['title', 'ends_at'], 'level', 'points', 'levels', 'inventory']);
        $this->withToken($token)->postJson('/api/v1/site/season/levels/1/free/claim')->assertOk()->assertJsonPath('ok', true);
        $this->withToken($token)->postJson('/api/v1/site/season/levels/1/plus/claim')->assertStatus(422);
        $this->withToken($token)->postJson('/api/v1/site/season/equip', ['type' => 'frame', 'value' => 'pass_mint'])->assertOk()->assertJsonPath('ok', true);
        $this->withToken($token)->getJson('/api/v1/site/season')->assertOk()->assertJsonPath('inventory.0.equipped', true);
    }

    public function test_app_opens_server_tournaments_through_bridge(): void
    {
        // Турніри серверів: список, сторінка турніру, реєстрація й челендж — ті самі шляхи, що на сайті.
        $owner = User::factory()->create();
        $server = GtaServer::query()->create(['slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp', 'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed']);
        $server->forceFill(['owner_id' => $owner->id])->save();
        $this->withToken($this->app_token($owner))->postJson('/api/v1/site/servers/quant-rp/tournaments', [
            'title' => 'Найдовший дрифт', 'kind' => 'challenge', 'metric' => 'Очки', 'starts_at' => now()->toIso8601String(), 'ends_at' => now()->addDay()->toIso8601String(),
        ])->assertSuccessful();
        $id = Tournament::query()->value('id');

        $token = $this->app_token(User::factory()->create());
        $this->withToken($token)->getJson('/api/v1/site/tournaments')->assertOk()->assertJsonPath('tournaments.0.title', 'Найдовший дрифт');
        $this->withToken($token)->postJson("/api/v1/site/tournaments/{$id}/join")->assertSuccessful();
        $this->withToken($token)->getJson("/api/v1/site/tournaments/{$id}")->assertOk()
            ->assertJsonStructure(['tournament' => ['title', 'kind', 'status'], 'entries', 'rounds', 'leaderboard', 'me' => ['entry_id', 'can_manage']])
            ->assertJsonPath('me.can_manage', false);
    }

    public function test_app_uses_teammate_matching_through_bridge(): void
    {
        // Підбір тиммейтів: анкета, «Шукаю зараз» і список сумісних — ті самі шляхи, що на сайті.
        $token = $this->app_token(User::factory()->create());
        $this->withToken($token)->putJson('/api/v1/site/party/match/profile', ['languages' => ['uk'], 'times' => ['evening'], 'mic' => true])->assertSuccessful();
        $this->withToken($token)->postJson('/api/v1/site/party/match/looking', ['on' => true])->assertSuccessful();
        $this->withToken($token)->getJson('/api/v1/site/party/match')->assertOk()
            ->assertJsonPath('profile.times.0', 'evening')
            ->assertJsonStructure(['profile' => ['looking_until'], 'matches', 'parties', 'options' => ['games', 'times', 'skills', 'languages', 'platforms']]);
    }

    public function test_app_opens_game_card_and_digest_switch_through_bridge(): void
    {
        $owner = User::factory()->create();
        $token = $this->app_token(User::factory()->create());
        $this->withToken($token)->getJson("/api/v1/site/u/{$owner->username}/card")->assertOk()
            ->assertJsonStructure(['profile' => ['name', 'username'], 'game' => ['level', 'title', 'badges', 'since', 'games'], 'url', 'qr']);
        $this->withToken($token)->patchJson('/api/v1/site/settings/digest', ['morning_digest' => false])->assertSuccessful();
        $this->withToken($token)->getJson('/api/v1/me')->assertOk()->assertJsonPath('user.morning_digest', false);
    }

    public function test_app_opens_listen_rooms_through_bridge(): void
    {
        // «Слухати разом» для груп: розділ «Кімнати», статус кімнати групи й налаштування — ті самі шляхи, що на сайті.
        $user = User::factory()->create();
        $token = $this->app_token($user);
        $this->withToken($token)->getJson('/api/v1/site/music/rooms')->assertOk()->assertJsonStructure(['rooms', 'groups', 'stations']);
        $code = $this->withToken($token)->postJson('/api/v1/site/music/rooms', ['title' => 'З друзями'])->assertCreated()->json('code');
        $this->withToken($token)->getJson("/api/v1/listen/{$code}/state")->assertOk()->assertJsonPath('room.title', 'З друзями');
        $this->withToken($token)->getJson('/api/v1/site/music/rooms/community/999')->assertNotFound();
        $this->withToken($token)->putJson('/api/v1/site/music/rooms/community/999/policy', ['who' => 'off'])->assertNotFound();
    }

    public function test_app_sets_stream_schedule_and_crossposting_through_bridge(): void
    {
        $user = User::factory()->create();
        $token = $this->app_token($user);
        $this->withToken($token)->putJson('/api/v1/site/settings/stream-schedule', ['slots' => [['day' => 5, 'time' => '20:00', 'title' => 'CS2']]])->assertSuccessful();
        $this->withToken($token)->getJson("/api/v1/site/crosspost/user/{$user->id}")->assertOk()->assertJsonStructure(['targets', 'events']);
    }

    public function test_app_opens_ideas_board_and_author_stats_through_bridge(): void
    {
        $token = $this->app_token(User::factory()->create());
        $this->withToken($token)->getJson('/api/v1/site/me/author-stats')->assertOk()->assertJsonStructure(['totals', 'days', 'top']);
        $this->withToken($token)->postJson('/api/v1/site/ideas', ['title' => 'Ідея із застосунку'])->assertSuccessful();
        $this->withToken($token)->getJson('/api/v1/site/ideas')->assertOk();
    }

    public function test_app_changes_account_type_and_sees_verification_through_bridge(): void
    {
        $token = $this->app_token(User::factory()->create());
        $this->withToken($token)->putJson('/api/v1/site/settings/account-type', ['type' => 'streamer', 'details' => ['twitch' => 'https://twitch.tv/neo']])->assertSuccessful();
        $this->withToken($token)->getJson('/api/v1/site/settings/account-type')->assertOk();
    }

    public function test_app_reaches_tier_lists_game_questions_and_mentors_through_bridge(): void
    {
        Game::query()->create(['slug' => 'cs2', 'name' => 'CS2', 'letter' => 'C', 'category' => 'pc', 'is_published' => true]);
        $token = $this->app_token(User::factory()->create());
        $this->withToken($token)->getJson('/api/v1/site/tierlists')->assertOk();
        // Екран «Новий тір-лист» застосунку: рівні S…D, елементи через кому.
        $tiers = [['label' => 'S', 'color' => 'rose', 'items' => ['CS2']], ['label' => 'A', 'color' => 'amber', 'items' => ['Valorant', 'Apex']]];
        $this->withToken($token)->postJson('/api/v1/site/tierlists', ['title' => 'Шутери 2026', 'is_public' => true, 'tiers' => $tiers])->assertSuccessful();
        $id = TierList::query()->latest('id')->value('id');
        $this->withToken($token)->getJson("/api/v1/site/tierlists/{$id}")->assertOk()->assertJsonPath('list.tiers.1.items.1', 'Apex');
        $this->withToken($token)->getJson('/api/v1/site/games/cs2/questions')->assertOk()->assertJsonStructure(['questions']);
        $this->withToken($token)->getJson('/api/v1/site/games/cs2/mentors')->assertOk()->assertJsonStructure(['mentors', 'me']);
        $this->withToken($token)->postJson('/api/v1/site/tools/nicknames/check', ['names' => ['ghostbyte']])->assertOk();
    }

    public function test_app_reaches_topics_and_bio_links_through_bridge(): void
    {
        $token = $this->app_token(User::factory()->create());
        $this->withToken($token)->postJson('/api/v1/site/t/speedrun/follow')->assertOk()->assertJsonPath('following', true);
        $this->withToken($token)->getJson('/api/v1/site/t/speedrun')->assertOk();
        $this->withToken($token)->putJson('/api/v1/site/settings/links', ['links' => [['title' => 'Twitch', 'url' => 'https://twitch.tv/me']]])->assertSuccessful();
        $this->withToken($token)->getJson('/api/v1/site/settings/links')->assertOk();
    }

    public function test_app_opens_community_calendar_wiki_and_points_through_bridge(): void
    {
        $owner = User::factory()->create();
        $community = app(CommunityService::class)->create($owner, ['name' => 'Хаб', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN, 'wall' => Community::WALL_OPEN, 'category' => 'esports']);
        $token = $this->app_token($owner);
        $this->withToken($token)->getJson("/api/v1/site/c/{$community->slug}/hub")->assertOk()->assertJsonStructure(['events', 'wiki', 'top']);
        $this->withToken($token)->getJson("/api/v1/site/c/{$community->slug}/calendar")->assertOk();
        $this->withToken($token)->getJson("/api/v1/site/c/{$community->slug}/wiki")->assertOk();
    }

    public function test_app_reaches_goals_fps_and_duels_through_bridge(): void
    {
        Game::query()->create(['slug' => 'dota-2', 'name' => 'Dota 2', 'letter' => 'D', 'category' => 'pc', 'is_published' => true]);
        $token = $this->app_token(User::factory()->create());
        $this->withToken($token)->getJson('/api/v1/site/games/dota-2/goals')->assertOk()->assertJsonStructure(['goals']);
        $this->withToken($token)->getJson('/api/v1/site/games/dota-2/fps')->assertOk()->assertJsonStructure(['rows', 'presets']);
        $this->withToken($token)->getJson('/api/v1/site/duels')->assertOk();
        // Виклик і відповідь суперника — як на екрані «Дуелі» застосунку.
        $rival = User::factory()->create();
        $this->withToken($token)->postJson('/api/v1/site/duels', ['username' => $rival->username, 'game' => 'dota-2', 'terms' => '1×1 до двох перемог'])->assertSuccessful();
        $duel = $this->withToken($this->app_token($rival))->getJson('/api/v1/site/duels')->assertOk()->json('duels.0');
        $this->assertTrue($duel['incoming']);
        $this->withToken($this->app_token($rival))->postJson("/api/v1/site/duels/{$duel['id']}", ['action' => 'accept'])->assertSuccessful();
    }

    public function test_app_reaches_podcasts_and_gifs_through_bridge(): void
    {
        $token = $this->app_token(User::factory()->create());
        $this->withToken($token)->getJson('/api/v1/site/podcasts')->assertOk()->assertJsonStructure(['podcasts', 'mine', 'categories']);
        $this->withToken($token)->getJson('/api/v1/site/gifs')->assertOk()->assertJsonStructure(['configured', 'gifs']);
        $this->withToken($token)->getJson('/api/v1/site/cards/search?q=cs')->assertOk()->assertJsonStructure(['cards']);
    }

    public function test_app_writes_reads_and_edits_articles_through_bridge(): void
    {
        $token = $this->app_token(User::factory()->create());
        $body = str_repeat('Перше речення огляду гри. ', 4)."\n\n## Висновок\n\nВарто **грати**.";
        $this->withToken($token)->postJson('/api/v1/site/articles', ['title' => 'Огляд CS2', 'body' => $body, 'publish' => true])->assertSuccessful();
        $slug = $this->withToken($token)->getJson('/api/v1/site/articles')->assertOk()->json('articles.data.0.slug');
        $this->withToken($token)->getJson("/api/v1/site/articles/{$slug}")->assertOk()->assertJsonPath('article.toc.0.text', 'Висновок');
        $this->withToken($token)->getJson("/api/v1/site/articles/{$slug}/edit")->assertOk()->assertJsonPath('article.body', $body);
        $this->withToken($token)->postJson("/api/v1/site/articles/{$slug}", ['title' => 'Огляд CS2 (оновлено)', 'body' => $body, 'publish' => true])->assertSuccessful();
        $this->withToken($token)->deleteJson("/api/v1/site/articles/{$slug}")->assertSuccessful();
    }

    public function test_app_opens_deals_and_new_sections_flags(): void
    {
        $token = $this->app_token(User::factory()->create());
        $this->withToken($token)->getJson('/api/v1/site/games/deals')->assertOk()->assertJsonStructure(['giveaways', 'subscribed']);
        $this->withToken($token)->postJson('/api/v1/site/games/deals/subscribe', ['on' => true])->assertSuccessful();
        $plugins = $this->withToken($token)->getJson('/api/v1/me')->json('user.plugins');
        foreach (['community_channels', 'community_wiki', 'community_calendar', 'game_backlog', 'game_deals', 'bio_links', 'account_types', 'pixel_avatar', 'meme_maker', 'nick_generator'] as $key) {
            $this->assertArrayHasKey($key, $plugins);
        }
    }

    public function test_app_game_page_has_all_site_blocks(): void
    {
        Game::query()->create(['slug' => 'cs2', 'name' => 'CS2', 'letter' => 'C', 'category' => 'pc', 'is_published' => true]);
        $token = $this->app_token(User::factory()->create());
        $this->withToken($token)->getJson('/api/v1/site/games/cs2')->assertOk()->assertJsonStructure(['backlog_on', 'community_rating', 'leaderboard', 'soundtracks']);
        $this->withToken($token)->postJson('/api/v1/site/games/cs2/played')->assertOk()->assertJsonPath('played', true);
        $this->withToken($token)->postJson('/api/v1/site/games/cs2/rating', ['score' => 9])->assertOk()->assertJsonPath('mine', 9);
        $this->withToken($token)->putJson('/api/v1/site/games/pc', ['cpu' => 'Ryzen 5 5600', 'gpu' => 'RTX 3060', 'ram' => 16])->assertSuccessful();
        $this->withToken($token)->getJson('/api/v1/site/games/cs2/pc-check')->assertOk()->assertJsonPath('configured', true);
        $this->withToken($token)->getJson('/api/v1/site/games/cs2/prices')->assertOk()->assertJsonStructure(['deals', 'wished']);
        $this->withToken($token)->getJson('/api/v1/site/games/cs2/playlists/mine')->assertOk()->assertJsonStructure(['playlists']);
        // «deals», «backlog» і «pc» — не ігри.
        $this->withToken($token)->getJson('/api/v1/site/games/deals')->assertOk()->assertJsonStructure(['giveaways']);
    }

    public function test_app_walks_newcomer_through_first_steps_like_the_site(): void
    {
        $user = User::factory()->create();
        $user->mergePref(['onboarded' => false]);
        $token = $this->app_token($user);
        $step = $this->withToken($token)->getJson('/api/v1/me')->json('user.onboarding');
        $this->assertContains($step, ['phone', 'mode']);
        $this->withToken($token)->postJson('/api/v1/site/start/phone')->assertSuccessful();
        $this->withToken($token)->putJson('/api/v1/site/settings/mode', ['mode' => 'gamer'])->assertOk();
        $this->assertSame('interests', $this->withToken($token)->getJson('/api/v1/me')->json('user.onboarding'));
        $this->withToken($token)->getJson('/api/v1/site/start')->assertOk()->assertJsonStructure(['games', 'servers']);
        $this->withToken($token)->postJson('/api/v1/site/start', ['games' => [], 'servers' => []])->assertSuccessful();
        $this->assertNull($this->withToken($token)->getJson('/api/v1/me')->json('user.onboarding'));
    }

    public function test_app_hides_frozen_profile_like_the_site(): void
    {
        $frozen = User::factory()->create(['frozen_at' => now()]);
        $this->withToken($this->app_token(User::factory()->create()))->getJson("/api/v1/users/{$frozen->username}")->assertNotFound()->assertJsonPath('message', 'Сторінку заморожено.');
        $this->withToken($this->app_token($frozen))->getJson("/api/v1/users/{$frozen->username}")->assertOk();
    }

    public function test_app_changes_notification_and_feed_settings_like_the_site(): void
    {
        $user = User::factory()->create();
        $token = $this->app_token($user);
        $d = $this->withToken($token)->getJson('/api/v1/site/settings/appearance')->assertOk()->assertJsonStructure(['quiet', 'notify', 'muteWords', 'palette'])->json();
        $this->withToken($token)->putJson('/api/v1/site/settings/appearance', [
            'palette' => $d['palette'], 'languages' => [], 'looking_for_group' => false,
            'quiet_enabled' => true, 'quiet_from' => '22:30', 'quiet_to' => '07:00',
            'notify' => ['likes' => false], 'mute_words' => ['спойлер'], 'hide_spoilers' => true, 'seasonal' => false,
        ])->assertSuccessful();
        $this->assertSame(['спойлер'], $user->fresh()->pref('mute_words'));
        $this->assertFalse($user->fresh()->pref('seasonal'));
        $this->withToken($token)->patchJson('/api/v1/site/settings/streamer-mode', ['streamer_mode' => true])->assertSuccessful();
        $this->withToken($token)->patchJson('/api/v1/site/settings/notify-sound', ['notify_sound' => 'pixel'])->assertSuccessful();
        $this->withToken($token)->putJson('/api/v1/site/settings/account/profanity', ['hide' => true])->assertSuccessful();
        $prefs = $this->withToken($token)->getJson('/api/v1/me')->json('user.prefs');
        $this->assertTrue($prefs['streamer_mode']);
        $this->assertSame('pixel', $prefs['notify_sound']);
        $this->assertTrue($prefs['hide_profanity']);
    }

    public function test_app_manages_connections_data_and_profile_look(): void
    {
        Game::query()->create(['slug' => 'cs2', 'name' => 'CS2', 'letter' => 'C', 'category' => 'pc', 'is_published' => true]);
        $user = User::factory()->create();
        $token = $this->app_token($user);
        $this->withToken($token)->getJson('/api/v1/site/settings/account')->assertOk()->assertJsonStructure(['telegram', 'connections']);
        $this->assertSame(200, $this->withToken($token)->get('/api/v1/site/settings/account/export')->baseResponse->getStatusCode());
        $game = Game::query()->where('slug', 'cs2')->value('id');
        // Кольори теми беруться з обкладинки: без неї сервер чесно відмовляє (як на сайті).
        $this->withToken($token)->putJson('/api/v1/site/settings/game-theme', ['game_id' => $game])->assertStatus(422);
        $this->withToken($token)->putJson('/api/v1/site/settings/game-theme', ['game_id' => null])->assertSuccessful();
        $d = $this->withToken($token)->getJson('/api/v1/site/settings/appearance')->json();
        $blocks = array_reverse($d['profile_blocks']);
        $this->withToken($token)->putJson('/api/v1/site/settings/appearance', ['palette' => $d['palette'], 'languages' => [], 'looking_for_group' => false, 'quiet_enabled' => false, 'quiet_from' => '23:00', 'quiet_to' => '08:00', 'profile_blocks' => $blocks])->assertSuccessful();
        $this->assertSame($blocks, $this->withToken($token)->getJson('/api/v1/site/settings/appearance')->json('profile_blocks'));
    }

    public function test_app_composer_tools_publish_like_the_site(): void
    {
        $token = $this->app_token(User::factory()->create());
        $post = fn (array $fields) => $this->withToken($token)->post('/api/v1/posts', ['visibility' => 'public', ...$fields], ['Accept' => 'application/json']);
        // Стікер, опитування, спойлер, чернетка й відкладений запис — ті самі поля, що шле редактор сайту.
        $post(['sticker' => 'gg'])->assertCreated();
        $post(['body' => 'Хто сильніший?', 'poll' => ['question' => 'Хто?', 'options' => ['Я', 'Ти'], 'anonymous' => '0']])->assertCreated()->assertJsonPath('post.poll.question', 'Хто?');
        $post(['body' => 'Фінал серіалу', 'spoiler' => '1'])->assertCreated();
        $post(['body' => 'Ще допишу', 'draft' => '1'])->assertCreated();
        $post(['body' => 'Завтра зранку', 'publish_at' => now()->addDay()->toIso8601String()])->assertCreated();
    }

    public function test_app_reaches_read_later_and_keyword_alerts_through_bridge(): void
    {
        $token = $this->app_token(User::factory()->create());
        $post = Post::factory()->create(['visibility' => 'public']);
        $this->withToken($token)->postJson("/api/v1/site/posts/{$post->id}/later")->assertOk()->assertJsonPath('later', true);
        $this->withToken($token)->getJson('/api/v1/site/later')->assertOk()->assertJsonCount(1, 'posts');
        $this->withToken($token)->postJson('/api/v1/site/settings/keyword-alerts', ['keyword' => 'патч'])->assertOk();
        $this->withToken($token)->getJson('/api/v1/site/settings/keyword-alerts')->assertOk()->assertJsonPath('keywords', ['патч']);
    }

    public function test_app_reaches_support_tickets_through_bridge(): void
    {
        $token = $this->app_token(User::factory()->create());
        $this->withToken($token)->postJson('/api/v1/site/support', ['category' => 'bug', 'subject' => 'Падає плеєр', 'body' => 'Після перемотування застосунок закривається.'])->assertCreated();
        $id = $this->withToken($token)->getJson('/api/v1/site/support')->assertOk()->json('tickets.0.id');
        $this->withToken($token)->getJson("/api/v1/site/support/{$id}")->assertOk()->assertJsonCount(1, 'messages');
        $this->withToken($token)->postJson("/api/v1/site/support/{$id}/reply", ['body' => 'Ще деталі'])->assertOk()->assertJsonCount(2, 'messages');
    }

    public function test_app_reads_help_center_as_json(): void
    {
        // Довідка відкрита й без входу, і через міст.
        $this->getJson('/api/v1/help')->assertOk()->assertJsonStructure(['categories', 'popular']);
        $this->getJson('/api/v1/help/support/tickets')->assertOk()->assertJsonPath('article.slug', 'tickets')->assertJsonStructure(['article' => ['blocks'], 'related']);
        $token = $this->app_token(User::factory()->create());
        $this->withToken($token)->getJson('/api/v1/site/help/feed')->assertOk()->assertJsonPath('category.slug', 'feed');
    }

    public function test_app_votes_in_polls_through_bridge(): void
    {
        $author = User::factory()->create();
        $this->actingAs($author)->post('/posts', ['visibility' => 'public', 'poll' => ['question' => 'Яка гра?', 'options' => ['CS2', 'Dota']]]);
        $post = Post::query()->with('poll.options')->latest('id')->firstOrFail();
        $token = $this->app_token(User::factory()->create());
        $this->withToken($token)->postJson("/api/v1/site/posts/{$post->id}/poll", ['option_id' => $post->poll->options[0]->id])->assertOk()->assertJsonPath('total', 1);
    }
}
