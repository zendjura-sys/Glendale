<?php

namespace Tests\Feature;

use App\Http\Controllers\Mail\UnsubscribeController;
use App\Mail\NewsletterMail;
use App\Models\Broadcast;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/** №284: новини GameCon на пошту — лише за згодою, відписка одним натисканням. */
class NewsletterTest extends TestCase
{
    use RefreshDatabase;

    public function test_consent_is_off_by_default_and_toggled_in_settings(): void
    {
        $user = User::factory()->create();
        $this->assertFalse($user->pref('news_email', false));
        $this->actingAs($user)->patch(route('profile.update'), ['first_name' => $user->first_name, 'last_name' => $user->last_name, 'username' => $user->username, 'email' => $user->email, 'news_email' => true])->assertRedirect();
        $this->assertTrue($user->fresh()->pref('news_email', false));
    }

    public function test_broadcast_emails_only_consenting_verified_people_and_unsubscribe_stops_only_news(): void
    {
        Mail::fake();
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $reader = User::factory()->create(['email_social' => true]);
        $reader->mergePref(['news_email' => true]);
        $unverified = User::factory()->unverified()->create();
        $unverified->mergePref(['news_email' => true]);
        User::factory()->create(); // без згоди

        $this->actingAs($admin)->getJson('/admin/broadcasts/count?audience=all')->assertJsonPath('readers', 1);
        $this->actingAs($admin)->post('/admin/broadcasts', [
            'title' => 'Сезон зими', 'body' => 'Нові нагороди й челенджі.', 'audience' => 'all', 'email' => true,
        ])->assertRedirect();

        Mail::assertQueued(NewsletterMail::class, 1);
        Mail::assertQueued(NewsletterMail::class, fn (NewsletterMail $m) => $m->hasTo($reader->email)
            && $m->headline === 'Сезон зими' && str_contains($m->unsubscribeUrl, 'list=news'));
        $this->assertSame(1, Broadcast::query()->sole()->emailed_count);

        // Відписка одним натисканням (POST від поштовика) — лише від новин, листи про активність лишаються.
        $this->post(UnsubscribeController::url($reader, 'news'))->assertOk();
        $this->assertFalse($reader->fresh()->pref('news_email', false));
        $this->assertTrue($reader->fresh()->email_social);
    }
}
