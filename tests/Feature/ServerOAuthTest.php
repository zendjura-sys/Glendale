<?php

namespace Tests\Feature;

use App\Models\GtaServer;
use App\Models\OAuthClient;
use App\Models\RpCharacter;
use App\Models\ServerPlayer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ServerOAuthTest extends TestCase
{
    use RefreshDatabase;

    private const CALLBACK = 'https://quant.example/auth/callback';

    /**
     * @return array{GtaServer, User, OAuthClient, string}
     */
    private function setUpApp(): array
    {
        $this->withoutVite();
        $owner = User::factory()->create();
        $server = GtaServer::query()->create([
            'slug' => 'quant', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        $server->forceFill(['owner_id' => $owner->id])->save();

        $this->actingAs(User::factory()->create())->post(route('servers.apps.store', $server), ['name' => 'Сайт', 'redirect_uris' => self::CALLBACK])->assertForbidden();
        $this->actingAs($owner)->post(route('servers.apps.store', $server), ['name' => 'Сайт', 'redirect_uris' => 'http://evil.example/cb'])->assertSessionHasErrors('redirect_uris');
        $this->actingAs($owner)->post(route('servers.apps.store', $server), ['name' => 'Сайт', 'redirect_uris' => self::CALLBACK."\nhttp://localhost:3000/cb"])->assertRedirect();

        $secret = null;
        $this->actingAs($owner)->get(route('servers.show', $server))
            ->assertInertia(function (Assert $page) use (&$secret) {
                $page->has('apps', 1)->where('apps.0.redirect_uris', [self::CALLBACK, 'http://localhost:3000/cb']);
                $secret = $page->toArray()['props']['apps'][0]['secret'];
            });
        $this->assertIsString($secret);
        // Секрет показується лише раз.
        $this->actingAs($owner)->get(route('servers.show', $server))->assertInertia(fn (Assert $page) => $page->where('apps.0.secret', null));

        return [$server, $owner, OAuthClient::query()->sole(), $secret];
    }

    /** Гравець погоджується; повертає код з адреси повернення. */
    private function consent(User $player, OAuthClient $client, array $extra = []): string
    {
        $query = ['response_type' => 'code', 'client_id' => $client->client_id, 'redirect_uri' => self::CALLBACK, 'scope' => 'profile characters family', 'state' => 'xyz', ...$extra];
        $this->actingAs($player)->get(route('oauth.authorize', $query))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('oauth/authorize')->where('server.name', 'Quant RP')->where('scopes', ['profile', 'characters', 'family']));

        $location = $this->actingAs($player)->post(route('oauth.decide'), ['decision' => 'allow', 'query' => $query])->assertRedirect()->headers->get('Location');
        $this->assertStringStartsWith(self::CALLBACK.'?', (string) $location);
        parse_str((string) parse_url((string) $location, PHP_URL_QUERY), $params);
        $this->assertSame('xyz', $params['state']);

        return $params['code'];
    }

    public function test_server_signs_players_in_reads_their_profile_and_syncs_online(): void
    {
        [$server, , $client, $secret] = $this->setUpApp();
        $player = User::factory()->create();
        RpCharacter::query()->create(['user_id' => $player->id, 'gta_server_id' => $server->id, 'name' => 'Taras_Koval', 'status' => 'active', 'is_main' => true]);

        // Чужа адреса повернення — помилка на нашій сторінці, без редиректу.
        $this->actingAs($player)->get(route('oauth.authorize', ['client_id' => $client->client_id, 'redirect_uri' => 'https://evil.example/']))->assertStatus(400);

        $code = $this->consent($player, $client);
        $this->postJson('/api/oauth/token', ['grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => self::CALLBACK, 'client_id' => $client->client_id, 'client_secret' => 'wrong'])
            ->assertStatus(401)->assertJsonPath('error', 'invalid_client');
        $token = $this->withBasicAuth($client->client_id, $secret)
            ->postJson('/api/oauth/token', ['grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => self::CALLBACK])
            ->assertOk()->assertJsonPath('token_type', 'Bearer')->json('access_token');
        // Код одноразовий.
        $this->withBasicAuth($client->client_id, $secret)
            ->postJson('/api/oauth/token', ['grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => self::CALLBACK])
            ->assertStatus(400)->assertJsonPath('error', 'invalid_grant');

        $this->withToken($token)->getJson('/api/oauth/userinfo')
            ->assertOk()
            ->assertJsonPath('sub', (string) $player->id)
            ->assertJsonPath('verified_player', true)
            ->assertJsonPath('characters.0.name', 'Taras_Koval')
            ->assertJsonPath('family', null);

        $this->withBasicAuth($client->client_id, $secret)->postJson('/api/oauth/server/sync', [
            'online' => 812, 'max' => 1000,
            'players' => [['user_id' => $player->id, 'nickname' => 'Taras_Koval', 'online' => true], ['user_id' => 999999]],
        ])->assertOk()->assertJsonPath('updated', 1)->assertJsonPath('ignored', 1);
        $this->assertSame(812, $server->fresh()->players_online);
        $this->assertTrue(ServerPlayer::query()->sole()->online);

        $this->actingAs($player)->get(route('servers.show', $server))
            ->assertInertia(fn (Assert $page) => $page->where('verified.players', 1)->where('verified.online', 1)->where('verified.me.nickname', 'Taras_Koval')->where('apps', null));

        // Гравець скасовує доступ — токен більше не працює.
        $this->actingAs($player)->get(route('account.edit'))->assertInertia(fn (Assert $page) => $page->where('connections.0.server', 'Quant RP'));
        $this->actingAs($player)->delete(route('account.connections.destroy', $client->id))->assertRedirect();
        $this->withToken($token)->getJson('/api/oauth/userinfo')->assertStatus(401);
    }

    public function test_launcher_uses_pkce_without_a_secret_and_revoked_apps_stop_working(): void
    {
        [$server, $owner, $client, $secret] = $this->setUpApp();
        $player = User::factory()->create();
        $verifier = str_repeat('v', 50);
        $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');

        $code = $this->consent($player, $client, ['code_challenge' => $challenge, 'code_challenge_method' => 'S256']);
        $this->postJson('/api/oauth/token', ['grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => self::CALLBACK, 'client_id' => $client->client_id, 'code_verifier' => 'wrong'.$verifier])
            ->assertStatus(400);
        $code = $this->consent($player, $client, ['code_challenge' => $challenge, 'code_challenge_method' => 'S256']);
        $token = $this->postJson('/api/oauth/token', ['grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => self::CALLBACK, 'client_id' => $client->client_id, 'code_verifier' => $verifier])
            ->assertOk()->json('access_token');

        // Без PKCE і без секрету код не обміняти.
        $plain = $this->consent($player, $client);
        $this->postJson('/api/oauth/token', ['grant_type' => 'authorization_code', 'code' => $plain, 'redirect_uri' => self::CALLBACK, 'client_id' => $client->client_id])
            ->assertStatus(400)->assertJsonPath('error', 'invalid_client');

        $this->actingAs($owner)->delete(route('servers.apps.destroy', [$server, $client]))->assertRedirect();
        $this->withToken($token)->getJson('/api/oauth/userinfo')->assertStatus(401);
        $this->withBasicAuth($client->client_id, $secret)->postJson('/api/oauth/server/sync', ['online' => 1])->assertStatus(401);
        $this->actingAs($player)->get(route('oauth.authorize', ['client_id' => $client->client_id]))->assertStatus(400);
    }
}
