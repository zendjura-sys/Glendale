<?php

namespace Tests\Feature;

use App\Models\Podcast;
use App\Models\Post;
use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class GifPodcastsVideoCoverTest extends TestCase
{
    use RefreshDatabase;

    public function test_gif_search_and_post_card_accept_only_giphy(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->getJson('/gifs')->assertOk()->assertJsonPath('configured', false)->assertJsonPath('gifs', []);

        app(SiteSettings::class)->putSecret('giphy_key', 'giphy-test-key');
        Http::fake(['api.giphy.com/*' => Http::response(['data' => [[
            'id' => 'abc',
            'title' => 'GG',
            'images' => [
                'downsized' => ['url' => 'https://media2.giphy.com/media/abc/giphy.gif?cid=track', 'width' => 200, 'height' => 150],
                'fixed_width_small' => ['url' => 'https://media2.giphy.com/media/abc/100w.gif?cid=track'],
            ],
        ]]])]);
        $this->actingAs($user)->getJson('/gifs?q=gg')->assertOk()
            ->assertJsonPath('configured', true)
            ->assertJsonPath('gifs.0.url', 'https://media2.giphy.com/media/abc/giphy.gif');

        $this->actingAs($user)->post('/posts', ['gif' => ['url' => 'https://media2.giphy.com/media/abc/giphy.gif', 'title' => 'GG'], 'visibility' => 'public'])->assertSessionHasNoErrors();
        $post = Post::query()->latest('id')->firstOrFail();
        $this->assertSame('gif', $post->card['kind'] ?? null);

        $this->actingAs($user)->post('/posts', ['gif' => ['url' => 'https://evil.example/x.gif'], 'visibility' => 'public'])->assertSessionHasErrors('gif');
    }

    public function test_podcast_episode_notifies_subscribers(): void
    {
        Storage::fake('public');
        $author = User::factory()->create();
        $fan = User::factory()->create();
        $this->actingAs($author)->post('/podcasts', ['title' => 'Патч-нотатки', 'category' => array_key_first(Podcast::CATEGORIES)])->assertRedirect();
        $podcast = Podcast::query()->firstOrFail();

        $this->actingAs($fan)->postJson("/podcasts/{$podcast->id}/subscribe")->assertOk()->assertJsonPath('subscribed', true)->assertJsonPath('subscribers', 1);
        $this->actingAs($fan)->post("/podcasts/{$podcast->id}/episodes", ['title' => 'Чужий', 'audio' => UploadedFile::fake()->create('a.mp3', 100, 'audio/mpeg')])->assertForbidden();

        $this->actingAs($author)->post("/podcasts/{$podcast->id}/episodes", ['title' => 'Випуск 1', 'audio' => UploadedFile::fake()->create('a.mp3', 100, 'audio/mpeg')])->assertSessionHasNoErrors();
        $episode = $podcast->episodes()->firstOrFail();
        Storage::disk('public')->assertExists($episode->audio_path);
        $this->assertSame(1, $fan->notifications()->count());

        $this->actingAs($fan)->postJson("/podcasts/{$podcast->id}/episodes/{$episode->id}/play")->assertOk();
        $this->actingAs($fan)->postJson("/podcasts/{$podcast->id}/episodes/{$episode->id}/play")->assertOk();
        $this->assertSame(1, $episode->fresh()?->plays_count);

        $this->actingAs($fan)->get('/podcasts')->assertInertia(fn (Assert $page) => $page->component('podcasts/index')->where('podcasts.0.subscribed', true));
    }

    public function test_video_cover_needs_plus(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();
        $video = fn () => UploadedFile::fake()->create('cover.mp4', 500, 'video/mp4');
        $this->actingAs($user)->post('/me/cover-video', ['video' => $video()])->assertForbidden();

        $user->forceFill(['plus_until' => now()->addMonth()])->save();
        $this->actingAs($user)->post('/me/cover-video', ['video' => $video()])->assertSessionHasNoErrors();
        $path = (string) $user->fresh()?->cover_video_path;
        Storage::disk('public')->assertExists($path);

        $this->actingAs($user)->delete('/me/cover-video');
        Storage::disk('public')->assertMissing($path);
        $this->assertNull($user->fresh()?->cover_video_path);
    }
}
