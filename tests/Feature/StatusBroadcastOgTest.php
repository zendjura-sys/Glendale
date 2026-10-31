<?php

namespace Tests\Feature;

use App\Jobs\SendBroadcast;
use App\Models\ApiToken;
use App\Models\Broadcast;
use App\Models\StatusIncident;
use App\Models\User;
use App\Notifications\BroadcastNotice;
use App\Services\CommunityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class StatusBroadcastOgTest extends TestCase
{
    use RefreshDatabase;

    public function test_status_page_is_public_and_shows_incident_flow(): void
    {
        Storage::fake('public');
        $this->get('/status')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('status')
            ->where('overall', 'operational')
            ->has('components', 5)
            ->has('active', 0));

        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->post('/admin/status', ['title' => 'Не надходять сповіщення', 'severity' => 'major', 'message' => 'Дивимося.'])->assertRedirect();
        $incident = StatusIncident::query()->sole();
        $this->assertSame('investigating', $incident->status);

        // Збій видно всім: на сторінці статусу й банером у спільних даних сайту.
        $this->get('/status')->assertInertia(fn (Assert $page) => $page
            ->where('overall', 'down')
            ->where('active.0.title', 'Не надходять сповіщення'));
        $this->actingAs(User::factory()->create())->get('/status')->assertInertia(fn (Assert $page) => $page
            ->where('incident.title', 'Не надходять сповіщення'));

        $this->actingAs($admin)->post("/admin/status/{$incident->id}", ['status' => 'resolved', 'message' => 'Полагодили.'])->assertRedirect();
        $incident->refresh();
        $this->assertSame('resolved', $incident->status);
        $this->assertNotNull($incident->resolved_at);
        $this->assertCount(2, $incident->updates ?? []);
        $this->get('/status')->assertInertia(fn (Assert $page) => $page
            ->where('overall', 'operational')
            ->has('active', 0)
            ->where('history.0.updates.0.message', 'Полагодили.'));
        $this->assertNull(Cache::get('status:banner'));
    }

    public function test_only_staff_admins_manage_status_and_broadcasts(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->get('/admin/status')->assertForbidden();
        $this->actingAs($user)->post('/admin/broadcasts', ['title' => 'Привіт', 'body' => 'Текст', 'audience' => 'all'])->assertForbidden();
    }

    public function test_broadcast_reaches_chosen_audience(): void
    {
        Queue::fake();
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->get('/admin/broadcasts')->assertInertia(fn (Assert $page) => $page->component('admin/broadcasts'));
        $this->actingAs($admin)->post('/admin/broadcasts', ['title' => 'Оновлення', 'body' => 'Нові функції', 'url' => '/changelog', 'audience' => 'plus'])->assertRedirect();
        $this->actingAs($admin)->post('/admin/broadcasts', ['title' => 'Погано', 'body' => 'Посилання', 'url' => 'javascript:alert(1)', 'audience' => 'all'])->assertSessionHasErrors('url');
        Queue::assertPushed(SendBroadcast::class);

        Notification::fake();
        $plus = User::factory()->create(['plus_until' => now()->addMonth()]);
        $free = User::factory()->create();
        $banned = User::factory()->create(['plus_until' => now()->addMonth(), 'banned_at' => now()]);
        (new SendBroadcast(Broadcast::query()->sole()->id))->handle();
        Notification::assertSentTo($plus, BroadcastNotice::class, fn (BroadcastNotice $n) => $n->toArray($plus)['url'] === '/changelog');
        Notification::assertNotSentTo([$free, $banned, $admin], BroadcastNotice::class);
        $this->assertSame(1, Broadcast::query()->sole()->sent_count);

        // Аудиторія «застосунок» — лише ті, хто входив з телефона.
        ApiToken::query()->create(['user_id' => $free->id, 'name' => 'android', 'token' => hash('sha256', 'x')]);
        $this->assertSame([$free->id], SendBroadcast::audience('app')->pluck('id')->all());
    }

    public function test_og_cards_render_for_open_profiles_and_link_in_head(): void
    {
        Storage::fake('public');
        $user = User::factory()->create(['username' => 'tonny', 'name' => 'Тоні Старк']);
        $response = $this->get('/og/u/tonny.png')->assertOk();
        $this->assertSame('image/png', $response->headers->get('Content-Type'));
        [$w, $h] = getimagesize($response->getFile()->getPathname()) ?: [0, 0];
        $this->assertSame([1200, 630], [$w, $h]);

        $this->get('/tonny')->assertOk()->assertSee('/og/u/tonny.png?v=', false);

        $user->forceFill(['banned_at' => now()])->save();
        $this->get('/og/u/tonny.png')->assertNotFound();

        // Спільнота — лише якщо її сторінку відкрито гостям.
        $community = app(CommunityService::class)->create($user->fresh() ?? $user, ['name' => 'Клан', 'type' => 'group', 'privacy' => 'open']);
        $this->get("/og/c/{$community->slug}.png")->assertNotFound();
    }
}
