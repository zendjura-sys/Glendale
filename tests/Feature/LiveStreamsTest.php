<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserStream;
use App\Notifications\StreamLive;
use App\Services\FriendshipService;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LiveStreamsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{User, User}
     */
    private function friends(): array
    {
        [$streamer, $friend] = User::factory()->count(2)->create();
        $friendships = app(FriendshipService::class);
        $friendships->request($friend, $streamer);
        $friendships->accept($streamer, $friend);

        return [$streamer, $friend];
    }

    public function test_twitch_channel_goes_live_and_friends_see_it(): void
    {
        $this->withoutVite();
        Notification::fake();
        [$streamer, $friend] = $this->friends();
        app(SiteSettings::class)->put(['twitch_client_id' => 'abcdefghijklmnopqrstuvwxyz']);
        app(SiteSettings::class)->putSecret('twitch_client_secret', 'secretsecretsecretsecret12');
        $live = true;
        Http::fake([
            'id.twitch.tv/*' => Http::response(['access_token' => 'tok']),
            'api.twitch.tv/helix/streams*' => function () use (&$live) {
                return Http::response(['data' => $live ? [['user_login' => 'taras_rp', 'title' => 'Рейд на склад', 'game_name' => 'Grand Theft Auto V', 'viewer_count' => 1520]] : []]);
            },
        ]);

        $this->actingAs($streamer)->put(route('stream.update'), ['platform' => 'twitch', 'channel' => 'nope!'])->assertSessionHasErrors('channel');
        $this->actingAs($streamer)->put(route('stream.update'), ['platform' => 'twitch', 'channel' => 'https://www.twitch.tv/Taras_RP'])->assertRedirect();
        $stream = UserStream::query()->sole();
        $this->assertSame('taras_rp', $stream->channel);
        $this->assertTrue($stream->is_live);
        $this->assertSame(1520, $stream->viewers);
        Notification::assertSentToTimes($friend, StreamLive::class, 1);

        // Наступна перевірка в тому самому ефірі — без повторного сповіщення.
        $this->artisan('streams:check')->assertSuccessful();
        Notification::assertSentToTimes($friend, StreamLive::class, 1);

        $this->actingAs($friend)->get('/'.$streamer->username)
            ->assertInertia(fn (Assert $page) => $page
                ->where('stream.live', true)
                ->where('stream.embed', fn (string $url) => str_starts_with($url, 'https://player.twitch.tv/?channel=taras_rp&parent=')));
        $this->actingAs($friend)->get(route('feed'))
            ->assertInertia(fn (Assert $page) => $page->loadDeferredProps('events', fn (Assert $reload) => $reload
                ->has('streaming', 1)
                ->where('streaming.0.user.id', $streamer->id)
                ->where('streaming.0.game', 'Grand Theft Auto V')));

        $live = false;
        $this->artisan('streams:check')->assertSuccessful();
        $this->assertFalse($stream->fresh()->is_live);
    }

    public function test_youtube_without_keys_and_manual_live(): void
    {
        $this->withoutVite();
        Notification::fake();
        [$streamer, $friend] = $this->friends();
        Http::fake([
            'www.youtube.com/@tarasrp/live' => Http::response('<html><head><link rel="canonical" href="https://www.youtube.com/watch?v=abcdefghijk"><meta property="og:title" content="Нічний стрім"></head><body>"isLiveNow":true</body></html>'),
            'www.youtube.com/@quiet/live' => Http::response('<html><head><link rel="canonical" href="https://www.youtube.com/@quiet"></head></html>'),
        ]);

        $this->actingAs($streamer)->put(route('stream.update'), ['platform' => 'youtube', 'channel' => 'https://youtube.com/@tarasrp'])->assertRedirect();
        $stream = UserStream::query()->sole();
        $this->assertSame('@tarasrp', $stream->channel);
        $this->assertTrue($stream->is_live);
        $this->assertSame('https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1&mute=1', $stream->embed('gamecon.test'));

        // Без ефіру на YouTube — ручна позначка «Я в ефірі».
        $this->actingAs($friend)->post(route('stream.live'), ['on' => true])->assertStatus(422);
        $this->actingAs($streamer)->put(route('stream.update'), ['platform' => 'youtube', 'channel' => '@quiet'])->assertRedirect();
        $this->assertFalse(UserStream::query()->sole()->live());
        $this->actingAs($streamer)->post(route('stream.live'), ['on' => true])->assertRedirect();
        $this->assertTrue(UserStream::query()->sole()->live());
        $this->actingAs($streamer)->post(route('stream.live'), ['on' => false])->assertRedirect();
        $this->assertFalse(UserStream::query()->sole()->live());

        $this->actingAs($streamer)->delete(route('stream.destroy'))->assertRedirect();
        $this->assertSame(0, UserStream::query()->count());
    }
}
