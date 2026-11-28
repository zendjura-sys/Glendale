<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Modules\ModuleManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** №261: міні-вікна застосунку Windows — друзі й чати; вимкнений модуль чи гість — віджет порожній. */
class DesktopWidgetTest extends TestCase
{
    use RefreshDatabase;

    public function test_widgets_follow_modules_and_login(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->get('/desktop/widget/friends')->assertOk()->assertViewHas('available', true)
            ->assertSee('widget_state', false)->assertHeader('Cache-Control', 'no-store, private');
        $this->actingAs($user)->get('/desktop/widget/chats')->assertOk()->assertViewHas('available', true);

        app(ModuleManager::class)->set('messages', false);
        $this->actingAs($user)->get('/desktop/widget/chats')->assertOk()->assertViewHas('available', false);

        $this->actingAs($user)->get('/desktop/widget/unknown')->assertNotFound();
    }

    public function test_guest_gets_widget_instead_of_login_redirect(): void
    {
        $this->get('/desktop/widget/friends')->assertOk()->assertViewHas('available', false)->assertViewHas('guest', true);
    }
}
