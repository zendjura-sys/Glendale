<?php

namespace Tests\Feature;

use App\Models\Appeal;
use App\Models\Post;
use App\Models\User;
use App\Models\UserReport;
use App\Models\UserStrike;
use App\Services\Moderation\ReporterTrust;
use App\Services\Moderation\Strikes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class StrikesTrustNewcomersTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    public function test_strikes_mute_at_thresholds_and_appeal_revokes(): void
    {
        $admin = $this->admin();
        $user = User::factory()->create();
        UserReport::query()->create(['user_id' => $user->id, 'reporter_id' => $admin->id, 'reason' => array_key_first(UserReport::REASONS)]);

        $this->actingAs($admin)->post("/admin/moderation/people/{$user->id}", ['action' => 'strike', 'reason' => 'Образи'])->assertRedirect();
        app(Strikes::class)->add($user->fresh(), $admin, 'Спам');
        $this->assertNull($user->fresh()->muted_until);
        app(Strikes::class)->add($user->fresh(), $admin, 'Флуд');
        $this->assertTrue($user->fresh()->muted_until->between(now()->addHours(23), now()->addHours(25)));
        $this->assertSame(3, app(Strikes::class)->activeCount($user));

        // Людина бачить страйки в налаштуваннях і оскаржує.
        $this->actingAs($user)->get('/settings/account')->assertInertia(fn (Assert $page) => $page->has('strikes', 3)->where('strikes.0.active', true));
        $this->actingAs($user)->post('/settings/account/appeals', ['kind' => 'strike', 'body' => 'Я не флудив, це був бот у чаті.'])->assertSessionHasNoErrors();
        $appeal = Appeal::query()->firstOrFail();
        $this->actingAs($admin)->post("/admin/moderation/appeals/{$appeal->id}", ['accept' => true])->assertRedirect();
        $this->assertSame(2, app(Strikes::class)->activeCount($user));

        // Застарілі не рахуються.
        UserStrike::query()->update(['expires_at' => now()->subDay()]);
        $this->assertSame(0, app(Strikes::class)->activeCount($user));
    }

    public function test_reporter_trust_is_earned_or_set_manually(): void
    {
        $reporter = User::factory()->create();
        $others = User::factory()->count(10)->create();
        foreach ($others as $i => $target) {
            UserReport::query()->create(['user_id' => $target->id, 'reporter_id' => $reporter->id, 'reason' => array_key_first(UserReport::REASONS), 'status' => $i < 9 ? 'resolved' : 'dismissed']);
        }
        $this->assertTrue(app(ReporterTrust::class)->for([$reporter->id])[$reporter->id]['trusted']);

        $this->actingAs($this->admin())->post("/admin/moderation/users/{$reporter->id}/trust", ['trusted' => false])->assertRedirect();
        $this->assertFalse(app(ReporterTrust::class)->for([$reporter->id])[$reporter->id]['trusted']);

        // Скарга довіреного — позначена в черзі.
        $reporter->mergePref(['trusted_reporter' => true]);
        $target = User::factory()->create();
        UserReport::query()->create(['user_id' => $target->id, 'reporter_id' => $reporter->id, 'reason' => array_key_first(UserReport::REASONS)]);
        $this->actingAs($this->admin())->get('/admin/moderation')->assertInertia(fn (Assert $page) => $page->where('people.0.trusted', true));
    }

    public function test_newcomer_queue_and_appeal_sla(): void
    {
        $admin = $this->admin();
        $spammer = User::factory()->create(['email_verified_at' => null]);
        Post::query()->create(['author_id' => $spammer->id, 'wall_type' => $spammer->getMorphClass(), 'wall_id' => $spammer->id, 'body' => 'Дешеві скіни https://scam.example', 'visibility' => 'public']);
        $old = User::factory()->create();
        $old->forceFill(['created_at' => now()->subDays(30)])->save();

        $this->actingAs($admin)->get('/admin/moderation')->assertInertia(fn (Assert $page) => $page
            ->where('newcomers.0.id', $spammer->id)
            ->where('newcomers', fn ($rows) => collect($rows)->doesntContain('id', $old->id)));
        $this->actingAs($admin)->post("/admin/moderation/users/{$spammer->id}/reviewed")->assertRedirect();
        $this->actingAs($admin)->get('/admin/moderation')->assertInertia(fn (Assert $page) => $page->where('newcomers', fn ($rows) => collect($rows)->doesntContain('id', $spammer->id)));

        $appeal = Appeal::query()->create(['user_id' => $spammer->id, 'kind' => 'mute', 'body' => 'Помилка, прошу переглянути.']);
        $appeal->forceFill(['created_at' => now()->subHours(Appeal::SLA_HOURS + 1)])->save();
        $this->actingAs($admin)->get('/admin/moderation')->assertInertia(fn (Assert $page) => $page->where('appeals.0.overdue', true)->where('stats.appeals_overdue', 1));

        Artisan::call('appeals:sla');
        Artisan::call('appeals:sla');
        $this->assertSame(1, $admin->notifications()->count()); // нагадування лише раз
    }
}
