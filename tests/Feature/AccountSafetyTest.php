<?php

namespace Tests\Feature;

use App\Models\ApiToken;
use App\Models\Appeal;
use App\Models\LoginEvent;
use App\Models\Post;
use App\Models\User;
use App\Models\UserReport;
use App\Models\UserSession;
use App\Services\Auth\AccountSecurity;
use App\Services\Search\SiteSearch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AccountSafetyTest extends TestCase
{
    use RefreshDatabase;

    public function test_logins_are_logged_and_the_session_is_listed(): void
    {
        $user = User::factory()->create();

        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'wrong'])->assertSessionHasErrors();
        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password']);
        $this->assertAuthenticatedAs($user);
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password', 'device' => 'Pixel 8'])->assertOk();

        $this->assertSame([[false, 'password'], [true, 'password'], [true, 'app']], LoginEvent::query()->orderBy('id')->get()->map(fn (LoginEvent $e) => [$e->success, $e->method])->all());

        $this->get(route('account.edit'))->assertInertia(fn (Assert $page) => $page
            ->component('settings/account')
            ->has('sessions', 1)
            ->where('sessions.0.current', true)
            ->has('tokens', 1)
            ->where('tokens.0.name', 'Pixel 8')
            ->has('logins', 3));
    }

    public function test_revoked_session_is_logged_out_and_app_tokens_can_be_revoked(): void
    {
        $user = User::factory()->create();
        $other = 'abcdefghijabcdefghijabcdefghijabcdefghij';
        UserSession::query()->create(['user_id' => $user->id, 'session_hash' => AccountSecurity::hash($other), 'handle' => $other, 'user_agent' => 'Mozilla/5.0 (Android 14) Chrome/120', 'last_active_at' => now()]);
        ApiToken::query()->create(['user_id' => $user->id, 'name' => 'android', 'token' => hash('sha256', 'x')]);
        $remember = $user->getRememberToken();

        $this->actingAs($user)->delete(route('account.sessions.others'))->assertRedirect();

        $this->assertSame(0, UserSession::query()->where('session_hash', AccountSecurity::hash($other))->count());
        $this->assertSame(0, ApiToken::query()->count());
        $this->assertNotSame($remember, $user->fresh()->getRememberToken());
        $this->assertTrue(app(AccountSecurity::class)->revoked($other));

        $this->assertSame('Chrome · Android', AccountSecurity::device('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537'));
    }

    public function test_freezing_hides_the_account_until_the_next_login(): void
    {
        [$user, $viewer] = User::factory()->count(2)->create();
        $user->forceFill(['first_name' => 'Заморожений'])->save();

        $this->actingAs($user)->post(route('account.freeze'), ['password' => 'wrong'])->assertSessionHasErrors('password');
        $this->actingAs($user)->post(route('account.freeze'), ['password' => 'password'])->assertRedirect(route('login'));
        $this->assertGuest();
        $this->assertNotNull($user->fresh()->frozen_at);

        $this->actingAs($viewer)->get('/'.$user->username)->assertInertia(fn (Assert $page) => $page->component('profile/frozen'));
        $this->assertSame([], array_filter(app(SiteSearch::class)->hits('Заморожений'), fn (array $hit) => ($hit['kind'] ?? null) === 'user'));

        auth()->logout();
        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password']);
        $this->assertNull($user->fresh()->frozen_at);
    }

    public function test_user_downloads_own_data(): void
    {
        $user = User::factory()->create();
        Post::query()->create(['author_id' => $user->id, 'wall_type' => $user->getMorphClass(), 'wall_id' => $user->id, 'body' => 'Мій перший запис', 'visibility' => 'public']);

        $response = $this->actingAs($user)->get(route('account.export'));
        $response->assertOk();
        $data = json_decode($response->streamedContent(), true);

        $this->assertSame($user->username, $data['profile']['username']);
        $this->assertSame('Мій перший запис', $data['posts'][0]['body']);
        $this->assertArrayNotHasKey('password', $data['profile']);
    }

    public function test_people_reports_are_resolved_by_admins(): void
    {
        [$reporter, $target] = User::factory()->count(2)->create();
        $moderator = User::factory()->create(['role' => User::ROLE_MODERATOR]);
        $admin = User::factory()->admin()->create();

        $this->actingAs($reporter)->post(route('users.report', $reporter), ['reason' => 'spam'])->assertSessionHasErrors('reason');
        $this->actingAs($reporter)->post(route('users.report', $target), ['reason' => 'scam', 'comment' => 'Просить гроші'])->assertRedirect();
        $this->assertSame(1, UserReport::query()->where('status', UserReport::PENDING)->count());

        $this->actingAs($admin)->get(route('admin.moderation.index'))
            ->assertInertia(fn (Assert $page) => $page->has('people', 1)->where('people.0.user.id', $target->id)->where('stats.people', 1));

        $this->actingAs($moderator)->post(route('admin.moderation.people.resolve', $target->id), ['action' => 'ban'])->assertForbidden();
        $this->actingAs($admin)->post(route('admin.moderation.people.resolve', $target->id), ['action' => 'mute', 'hours' => 24])->assertRedirect();
        $this->assertTrue($target->fresh()->isMuted());
        $this->assertSame(0, UserReport::query()->where('status', UserReport::PENDING)->count());

        $this->actingAs($reporter)->post(route('users.report', $target), ['reason' => 'abuse']);
        $this->actingAs($admin)->post(route('admin.moderation.people.resolve', $target->id), ['action' => 'ban', 'reason' => 'Шахрайство'])->assertRedirect();
        $this->assertTrue($target->fresh()->isBanned());
    }

    public function test_appeals_lift_mutes_and_bans(): void
    {
        $user = User::factory()->create(['muted_until' => now()->addDay()]);
        $user->forceFill(['muted_until' => now()->addDay(), 'mute_reason' => 'Флуд'])->save();
        $admin = User::factory()->admin()->create();

        $this->actingAs($user)->post(route('account.appeals.store'), ['kind' => 'mute', 'body' => 'коротко'])->assertSessionHasErrors('body');
        $this->actingAs($user)->post(route('account.appeals.store'), ['kind' => 'mute', 'body' => 'Я не флудив, це був бот у чаті.'])->assertRedirect();
        $appeal = Appeal::query()->sole();

        $this->actingAs($admin)->post(route('admin.moderation.appeals.answer', $appeal), ['accept' => true, 'reply' => 'Вибачте, помилка.'])->assertRedirect();
        $this->assertFalse($user->fresh()->isMuted());
        $this->actingAs($user)->get(route('account.edit'))
            ->assertInertia(fn (Assert $page) => $page->where('appeals.0.status', 'accepted')->where('appeals.0.reply', 'Вибачте, помилка.'));

        $banned = User::factory()->create();
        $banned->forceFill(['banned_at' => now(), 'ban_reason' => 'Спам'])->save();
        auth()->logout();
        $this->post(route('appeal.store'), ['email' => $banned->email, 'password' => 'wrong', 'body' => 'Будь ласка, перегляньте.'])->assertSessionHasErrors('email');
        $this->post(route('appeal.store'), ['email' => $banned->email, 'password' => 'password', 'body' => 'Будь ласка, перегляньте.'])->assertRedirect(route('login'));
        $banAppeal = Appeal::query()->where('kind', 'ban')->sole();

        $this->actingAs($admin)->post(route('admin.moderation.appeals.answer', $banAppeal), ['accept' => true])->assertRedirect();
        $this->assertFalse($banned->fresh()->isBanned());
        $this->actingAs($admin)->post(route('admin.moderation.appeals.answer', $banAppeal), ['accept' => false])->assertStatus(422);
    }

    public function test_hide_profanity_preference_shares_the_mask_pattern(): void
    {
        $user = User::factory()->create();
        Cache::flush();

        $this->actingAs($user)->get(route('account.edit'))->assertInertia(fn (Assert $page) => $page->where('auth.user.profanity_mask', null));
        $this->actingAs($user)->put(route('account.profanity'), ['hide' => true])->assertRedirect();
        $this->actingAs($user)->get(route('account.edit'))->assertInertia(fn (Assert $page) => $page
            ->where('hideProfanity', true)
            ->where('auth.user.profanity_mask', fn (string $pattern) => str_contains($pattern, 'пизд') && ! str_contains($pattern, '\\b')));
    }
}
