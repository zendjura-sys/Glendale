<?php

namespace Tests\Feature;

use App\Models\GtaServer;
use App\Models\Movie;
use App\Models\MovieSource;
use App\Models\Post;
use App\Models\QuestClaim;
use App\Models\Season;
use App\Models\Tournament;
use App\Models\Track;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\FriendshipService;
use App\Services\Phones\PhoneNumbers;
use App\Services\Quests\SeasonPass;
use App\Support\Net\PublicUrl;
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
}
