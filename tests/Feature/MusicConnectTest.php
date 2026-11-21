<?php

namespace Tests\Feature;

use App\Events\Music\ConnectCommand;
use App\Events\Music\ConnectUpdated;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** GameCon Connect: пристрої бачать одне одного, керують і перекидають відтворення. */
class MusicConnectTest extends TestCase
{
    use RefreshDatabase;

    private const WEB = 'web-device-0001';

    private const APP = 'app-device-0002';

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    /**
     * @return array<string, mixed>
     */
    private function state(bool $playing, float $position = 30, string $key = 'local:1'): array
    {
        return [
            'track' => ['key' => $key, 'source' => 'local', 'id' => 1, 'title' => 'Neon', 'artist' => 'Nightdrive', 'duration' => 200, 'url' => '/music/tracks/1/stream'],
            'playing' => $playing,
            'position' => $position,
            'duration' => 200,
            'volume' => 0.7,
            'shuffle' => false,
            'repeat' => 'off',
            'updated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $state
     */
    private function beat(string $device, string $kind = 'web', ?array $state = null, bool $withState = false, ?User $user = null): TestResponse
    {
        $body = ['device_id' => $device, 'name' => $kind === 'web' ? 'Chrome · Windows' : 'Pixel 8', 'kind' => $kind];
        if ($withState || $state !== null) {
            $body['state'] = $state;
        }

        return $this->actingAs($user ?? $this->user)->postJson('/music/connect/heartbeat', $body);
    }

    private function command(string $target, string $action, ?float $value = null, ?User $user = null): TestResponse
    {
        return $this->actingAs($user ?? $this->user)->postJson('/music/connect/command', [
            'target_device_id' => $target, 'action' => $action, 'value' => $value, 'device_id' => self::WEB,
        ]);
    }

    public function test_heartbeat_registers_devices_and_hides_stale_ones(): void
    {
        $this->beat(self::WEB)->assertOk()->assertJsonCount(1, 'devices')->assertJsonPath('active_device_id', null);
        $this->beat(self::APP, 'app', $this->state(true))->assertOk()
            ->assertJsonCount(2, 'devices')
            ->assertJsonPath('active_device_id', self::APP)
            ->assertJsonPath('devices.0.id', self::APP)
            ->assertJsonPath('devices.0.is_active', true)
            ->assertJsonPath('devices.0.state.track.title', 'Neon')
            ->assertJsonPath('commands', []);

        // Вкладка без стану не стирає того, що вже відомо.
        $this->beat(self::APP, 'app')->assertJsonPath('devices.0.state.playing', true);

        $this->travel(31)->seconds();
        $this->beat(self::WEB)->assertOk()->assertJsonCount(1, 'devices')
            ->assertJsonPath('devices.0.id', self::WEB)
            ->assertJsonPath('active_device_id', null);
    }

    public function test_commands_are_queued_for_the_target_and_consumed_once(): void
    {
        $this->beat(self::WEB);
        $this->beat(self::APP, 'app', $this->state(true));

        $this->command(self::APP, 'seek', 90)->assertStatus(202);
        $this->command(self::APP, 'pause')->assertStatus(202);

        $commands = $this->beat(self::APP, 'app')->assertOk()->json('commands');
        $this->assertSame(['seek', 'pause'], array_column($commands, 'action'));
        $this->assertSame(90, (int) $commands[0]['value']);
        $this->assertSame(self::WEB, $commands[0]['from_device_id']);
        $this->assertNotEmpty($commands[0]['id']);

        $this->beat(self::APP, 'app')->assertJsonPath('commands', []);
        $this->beat(self::WEB)->assertJsonPath('commands', []);
    }

    public function test_commands_expire(): void
    {
        $this->beat(self::WEB);
        $this->command(self::WEB, 'next')->assertStatus(202);
        $this->travel(61)->seconds();
        $this->beat(self::WEB)->assertJsonPath('commands', []);
    }

    public function test_transfer_builds_payload_and_pauses_the_previous_device(): void
    {
        $this->beat(self::WEB);
        $state = $this->state(true, 40);
        $state['queue'] = [$state['track'], ['key' => 'local:2', 'source' => 'local', 'id' => 2, 'title' => 'Dusk', 'artist' => 'Nightdrive', 'duration' => 100]];
        $state['index'] = 0;
        $this->beat(self::APP, 'app', $state);

        $this->travel(5)->seconds();
        $this->command(self::WEB, 'transfer')->assertStatus(202);

        $web = $this->beat(self::WEB)->assertJsonPath('active_device_id', self::WEB)->json('commands');
        $this->assertCount(1, $web);
        $this->assertSame('transfer', $web[0]['action']);
        $this->assertSame('Neon', $web[0]['value']['track']['title']);
        $this->assertTrue($web[0]['value']['playing']);
        $this->assertSame(0, $web[0]['value']['index'] ?? null);
        $this->assertEqualsWithDelta(45, $web[0]['value']['position'], 1.5);
        $this->assertSame(['local:1', 'local:2'], array_column($web[0]['value']['queue'], 'key'));

        // Застосунок забирає «паузу» тим самим heartbeat, що ще каже «грає», — це не перехоплення.
        $this->assertSame(['pause'], array_column($this->beat(self::APP, 'app', $state)->assertJsonPath('active_device_id', self::WEB)->json('commands'), 'action'));
        $this->beat(self::WEB)->assertJsonPath('commands', []);
    }

    public function test_transfer_without_anything_playing_is_rejected(): void
    {
        $this->beat(self::WEB);
        $this->beat(self::APP, 'app');
        $this->command(self::APP, 'transfer')->assertUnprocessable();
    }

    public function test_starting_playback_takes_over_and_pauses_the_previous_device(): void
    {
        $this->beat(self::APP, 'app', $this->state(true));
        $this->beat(self::WEB, 'web', $this->state(true, 0, 'local:2'))->assertJsonPath('active_device_id', self::WEB);

        $this->assertSame(['pause'], array_column($this->beat(self::APP, 'app')->json('commands'), 'action'));
        // Повторний heartbeat активного пристрою вже нікого не зупиняє.
        $this->beat(self::WEB, 'web', $this->state(true, 10, 'local:2'));
        $this->beat(self::APP, 'app')->assertJsonPath('commands', []);
    }

    public function test_other_users_devices_cannot_be_targeted(): void
    {
        $stranger = User::factory()->create();
        $this->beat(self::APP, 'app', $this->state(true), user: $stranger);

        $this->beat(self::WEB)->assertJsonCount(1, 'devices');
        $this->command(self::APP, 'pause')->assertNotFound();
        $this->beat(self::APP, 'app', user: $stranger)->assertJsonPath('commands', []);
    }

    public function test_validation_rejects_bad_input(): void
    {
        $this->actingAs($this->user)->postJson('/music/connect/heartbeat', ['device_id' => 'x', 'name' => 'A', 'kind' => 'tv'])
            ->assertJsonValidationErrors(['device_id', 'kind']);
        $this->beat(self::WEB);
        $this->command(self::WEB, 'explode')->assertJsonValidationErrors(['action']);
    }

    public function test_events_are_broadcast_on_the_private_user_channel(): void
    {
        Event::fake([ConnectUpdated::class, ConnectCommand::class]);

        $this->beat(self::WEB);
        $this->beat(self::APP, 'app', $this->state(true));
        Event::assertDispatched(ConnectUpdated::class, fn (ConnectUpdated $e) => $e->userId === $this->user->id
            && $e->activeDeviceId === self::APP
            && $e->broadcastOn()->name === 'private-App.Models.User.'.$this->user->id);

        $this->command(self::APP, 'next')->assertStatus(202);
        Event::assertDispatched(ConnectCommand::class, fn (ConnectCommand $e) => $e->targetDeviceId === self::APP
            && $e->command['action'] === 'next'
            && $e->broadcastAs() === 'connect.command');
    }

    public function test_app_reaches_connect_through_the_bridge(): void
    {
        $token = app(ApiTokens::class)->issue($this->user, 'android');

        $this->withToken($token)->postJson('/api/v1/site/music/connect/heartbeat', [
            'device_id' => self::APP, 'name' => 'Pixel 8', 'kind' => 'app', 'state' => $this->state(true),
        ])->assertOk()->assertJsonPath('active_device_id', self::APP)->assertJsonStructure(['devices', 'active_device_id', 'commands']);

        $this->withToken($token)->postJson('/api/v1/site/music/connect/command', ['target_device_id' => self::APP, 'action' => 'volume', 'value' => 0.3])
            ->assertStatus(202);
        $this->withToken($token)->postJson('/api/v1/site/music/connect/heartbeat', ['device_id' => self::APP, 'name' => 'Pixel 8', 'kind' => 'app'])
            ->assertJsonPath('commands.0.action', 'volume')
            ->assertJsonPath('devices.0.state.volume', 0.3);
    }
}
