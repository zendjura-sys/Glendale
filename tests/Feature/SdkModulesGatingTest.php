<?php

namespace Tests\Feature;

use App\Models\DeveloperApp;
use App\Models\User;
use App\Services\Developer\OAuthServer;
use App\Support\Modules\ModuleManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** SDK API (№306): вимкнений розділ (чат, сім'ї, клани, музика) застосунок теж не отримує. */
class SdkModulesGatingTest extends TestCase
{
    use RefreshDatabase;

    public function test_disabled_modules_are_hidden_from_sdk_api(): void
    {
        $user = User::factory()->create();
        $app = DeveloperApp::query()->forceCreate([
            'user_id' => $user->id, 'name' => 'Test Game', 'client_id' => Str::random(24), 'public_key' => Str::random(32),
            'confidential' => false, 'redirect_uris' => ['http://127.0.0.1/callback'], 'scopes' => ['profile', 'chat', 'groups', 'music'],
        ]);
        $issue = new \ReflectionMethod(OAuthServer::class, 'issueTokens');
        $token = $issue->invoke(app(OAuthServer::class), $app, $user->id, ['profile', 'chat', 'groups', 'music'])['access_token'];

        $this->withToken($token)->getJson('/api/developer/v1/chat/conversations')->assertOk();
        $this->withToken($token)->getJson('/api/developer/v1/groups')->assertOk();

        app(ModuleManager::class)->set('messages', false);
        app(ModuleManager::class)->set('music', false);
        $this->withToken($token)->getJson('/api/developer/v1/chat/conversations')->assertNotFound();
        $this->withToken($token)->getJson('/api/developer/v1/music/now')->assertNotFound();
        $this->withToken($token)->getJson('/api/developer/v1/groups/clans/1/members')->assertNotFound();
    }
}
