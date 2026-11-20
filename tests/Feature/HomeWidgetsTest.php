<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Auth\ApiTokens;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class HomeWidgetsTest extends TestCase
{
    use RefreshDatabase;

    public function test_widgets_order_saved_and_shared_with_app(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->get('/feed')->assertInertia(fn (Assert $p) => $p->where('engagement.widgets', ['streak', 'ready', 'online', 'suggestions', 'birthdays']));
        $this->actingAs($user)->putJson('/settings/home-widgets', ['widgets' => ['online', 'streak']])->assertOk()->assertJsonPath('widgets', ['online', 'streak']);
        $this->actingAs($user)->putJson('/settings/home-widgets', ['widgets' => ['hack']])->assertStatus(422);
        $this->actingAs($user)->putJson('/settings/home-widgets', ['widgets' => []])->assertOk()->assertJsonPath('widgets', []);

        $token = app(ApiTokens::class)->issue($user, 'android');
        $this->withToken($token)->putJson('/api/v1/site/settings/home-widgets', ['widgets' => ['suggestions']])->assertOk();
        $this->withToken($token)->getJson('/api/v1/me')->assertJsonPath('user.home_widgets', ['suggestions']);
    }

    public function test_lobby_layout_saved_validated_and_shared(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->get('/feed')->assertInertia(fn (Assert $p) => $p->where('engagement.layout.0', ['key' => 'stories', 'size' => 'full']));
        $layout = [['key' => 'requests', 'size' => 'full'], ['key' => 'season', 'size' => 'half']];
        $this->actingAs($user)->putJson('/settings/home-layout', ['layout' => $layout])->assertOk()->assertJsonPath('layout', $layout);
        $this->actingAs($user)->putJson('/settings/home-layout', ['layout' => [['key' => 'hack', 'size' => 'half']]])->assertStatus(422);
        $this->actingAs($user)->putJson('/settings/home-layout', ['layout' => [['key' => 'pulse', 'size' => 'huge']]])->assertStatus(422);
        // Порожній розклад — усі віджети сховані (людина так вирішила), а не «за замовчуванням».
        $this->actingAs($user)->putJson('/settings/home-layout', ['layout' => []])->assertOk()->assertJsonPath('layout', []);
    }

    public function test_panel_view_renders_without_chrome(): void
    {
        // Сторінка в панелі «поруч» — звичайна відповідь Inertia (оболонку прибирає клієнт за ?panel=1).
        $this->actingAs(User::factory()->create())->get('/messages?panel=1')->assertOk();
    }
}
