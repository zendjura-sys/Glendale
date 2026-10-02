<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SiteBridgeTest extends TestCase
{
    use RefreshDatabase;

    private function token(User $user): string
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()->json('token');
    }

    public function test_site_action_redirect_becomes_json(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $mine = Post::factory()->create(['author_id' => $user->id]);
        $foreign = Post::factory()->create(['author_id' => $other->id]);
        $token = $this->token($user);

        $this->withToken($token)->postJson('/api/v1/site/posts/'.$mine->id.'/pin')
            ->assertOk()
            ->assertJsonPath('ok', true);
        $this->assertTrue($mine->fresh()->is_pinned);

        // Права ті самі, що на сайті: чужий запис закріпити не можна.
        $this->withToken($token)->postJson('/api/v1/site/posts/'.$foreign->id.'/pin')->assertForbidden();
        $this->assertFalse($foreign->fresh()->is_pinned);

        // Без токена міст недоступний.
        $this->postJson('/api/v1/site/posts/'.$mine->id.'/pin')->assertUnauthorized();
    }

    public function test_site_page_is_returned_as_props(): void
    {
        $user = User::factory()->create();
        $token = $this->token($user);

        $slug = $this->withToken($token)->postJson('/api/v1/communities', [
            'name' => 'Клан Тест',
            'type' => 'group',
            'category' => 'games',
            'privacy' => 'open',
        ])->assertSuccessful()->json('community.slug');
        $this->assertIsString($slug);

        $this->withToken($token)->getJson('/api/v1/site/c/'.$slug.'/members')
            ->assertOk()
            ->assertJsonPath('community.slug', $slug)
            ->assertJsonPath('tab', 'all')
            ->assertJsonMissingPath('component');
    }

    public function test_site_validation_errors_are_json(): void
    {
        $user = User::factory()->create();
        $token = $this->token($user);

        $this->withToken($token)->postJson('/api/v1/site/families', [])
            ->assertUnprocessable()
            ->assertJsonStructure(['message', 'errors']);
    }
}
