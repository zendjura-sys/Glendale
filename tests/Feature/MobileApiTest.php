<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MobileApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_feed_and_post(): void
    {
        $user = User::factory()->create(['email' => 'player@gamecon.test']);

        $this->getJson('/api/v1/me')->assertUnauthorized();

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'player@gamecon.test',
            'password' => 'password',
            'device' => 'GameCon',
        ])->assertOk()->json('token');

        $this->assertIsString($token);

        $this->withToken($token)->getJson('/api/v1/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'player@gamecon.test');

        $this->withToken($token)->getJson('/api/v1/feed')
            ->assertOk()
            ->assertJsonStructure(['tab', 'posts' => ['data', 'current_page']]);

        $this->withToken($token)->postJson('/api/v1/posts', [
            'body' => 'Перший запис із застосунку',
            'visibility' => 'public',
        ])->assertCreated()->assertJsonPath('post.body', 'Перший запис із застосунку');

        $this->withToken($token)->getJson('/api/v1/friends')->assertOk()->assertJsonPath('counts.all', 0);
        $this->withToken($token)->getJson('/api/v1/messages')->assertOk()->assertJsonStructure(['conversations', 'unread']);
        $this->withToken($token)->getJson('/api/v1/communities')->assertOk();
        $this->withToken($token)->getJson('/api/v1/music')->assertOk();
        $this->withToken($token)->getJson('/api/v1/cinema')->assertOk();
        $this->withToken($token)->getJson('/api/v1/families')->assertOk();
        $this->withToken($token)->getJson('/api/v1/servers')->assertOk();
        $this->withToken($token)->getJson('/api/v1/notifications')->assertOk();

        $this->withToken($token)->postJson('/api/v1/logout')->assertOk();
        $this->withToken($token)->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_register_and_discord_start(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'first_name' => 'Марко',
            'last_name' => 'Скалетта',
            'email' => 'marco@gamecon.test',
            'password' => 'password-123',
            'password_confirmation' => 'password-123',
        ])->assertCreated()->assertJsonPath('user.first_name', 'Марко');

        app(SiteSettings::class)->put([
            'discord_client_id' => '123456789012345678',
        ]);
        app(SiteSettings::class)->putSecret('discord_client_secret', 'discord-secret-value-123456');

        $this->postJson('/api/v1/auth/discord')
            ->assertOk()
            ->assertJsonStructure(['url']);
    }

    public function test_wrong_password(): void
    {
        User::factory()->create(['email' => 'player@gamecon.test']);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'player@gamecon.test',
            'password' => 'nope-nope',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }
}
