<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\MorningDigestNotice;
use App\Services\Auth\ApiTokens;
use App\Services\FriendshipService;
use App\Services\MorningDigest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class MorningDigestTest extends TestCase
{
    use RefreshDatabase;

    public function test_digest_tells_about_birthdays_and_respects_opt_out(): void
    {
        Notification::fake();
        $this->travelTo(Carbon::parse('2026-10-24 09:00', MorningDigest::TZ));
        [$me, $friend, $quiet] = User::factory()->count(3)->create(['last_seen_at' => now()]);
        app(FriendshipService::class)->request($me, $friend);
        app(FriendshipService::class)->accept($friend, $me);
        $friend->forceFill(['birthday' => '2000-10-24', 'first_name' => 'Тарас'])->save();

        $lines = app(MorningDigest::class)->lines($me);
        $this->assertContains('День народження: Тарас', $lines);
        // Нічого особливого — без дайджесту (самі завдання дня не привід).
        $this->assertSame([], app(MorningDigest::class)->lines($quiet));

        $this->withToken(app(ApiTokens::class)->issue($friend, 'android'))->patchJson('/api/v1/site/settings/digest', ['morning_digest' => false])->assertSuccessful();
        $this->assertFalse($friend->fresh()->wantsDigest());

        $this->artisan('digest:morning')->assertSuccessful();
        Notification::assertSentTo($me, MorningDigestNotice::class);
        Notification::assertNotSentTo($quiet, MorningDigestNotice::class);
    }
}
