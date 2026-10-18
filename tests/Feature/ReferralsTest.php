<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\ReferralJoined;
use App\Services\Achievements;
use App\Services\FriendshipService;
use App\Services\Referrals;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ReferralsTest extends TestCase
{
    use RefreshDatabase;

    public function test_invite_link_makes_friends_and_rewards_the_inviter(): void
    {
        $this->withoutVite();
        Notification::fake();
        $inviter = User::factory()->create();
        $code = app(Referrals::class)->code($inviter);

        $this->actingAs($inviter)->get(route('referrals.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('invite/index')->where('link', url('/r/'.$code))->where('total', 0));
        auth()->logout();

        $this->get('/r/zzzzzzzz')->assertRedirect('/');
        $this->get('/r/'.$code)->assertRedirect(route('register'))->assertCookie(Referrals::COOKIE, $code);

        $this->withCookie(Referrals::COOKIE, $code)->post(route('register.store'), [
            'first_name' => 'Тарас',
            'last_name' => 'Коваль',
            'email' => 'taras@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertRedirect();
        $friend = User::query()->where('email', 'taras@example.com')->sole();
        $this->assertSame($inviter->id, $friend->invited_by);
        $this->assertSame(FriendshipService::FRIENDS, app(FriendshipService::class)->status($inviter, $friend));
        Notification::assertSentTo($inviter, ReferralJoined::class);

        // Досвід — лише за тих, хто підтвердив пошту.
        $base = app(Achievements::class)->for($inviter->fresh())['xp'];
        $friend->forceFill(['email_verified_at' => now()])->save();
        cache()->forget("achievements.{$inviter->id}");
        $after = app(Achievements::class)->for($inviter->fresh());
        $this->assertSame($base + Referrals::XP, $after['xp']);
        $this->assertTrue(collect($after['badges'])->firstWhere('key', 'invite_1')['earned']);

        $this->actingAs($inviter)->get(route('referrals.index'))
            ->assertInertia(fn (Assert $page) => $page->where('total', 1)->where('active', 1)->where('people.0.active', true)->where('ladder.0.reached', true));
    }
}
