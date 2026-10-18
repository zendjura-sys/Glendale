<?php

namespace Tests\Feature;

use App\Models\Movie;
use App\Models\MovieSource;
use App\Models\Post;
use App\Models\User;
use App\Services\Auth\ApiTokens;
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
}
