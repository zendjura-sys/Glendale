<?php

namespace Tests\Feature;

use App\Models\SpamBlock;
use App\Models\User;
use App\Models\UsernameChange;
use App\Services\Antispam\PhishingGuard;
use App\Services\FriendshipService;
use App\Services\Messenger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Захист від фішингу, історія ніків, значок команди й монітор черги задач. */
class SafetyExtrasTest extends TestCase
{
    use RefreshDatabase;

    public function test_phishing_lookalikes_are_caught_and_real_domains_pass(): void
    {
        $guard = app(PhishingGuard::class);
        foreach (['steamcommunlty.com', 'steamcornmunity.com', 'dlscord.gg', 'discorcl.gift', 'discord-nitro.xyz', 'steam-trade-offer.ru', 'free-nitro-discord.com', 'stеamcommunity.com'] as $fake) {
            $this->assertNotNull($guard->imitates($fake), $fake);
        }
        foreach (['steamcommunity.com', 'store.steampowered.com', 'discord.gg', 'cdn.discordapp.com', 'youtube.com', 'gamecon.online', 'top.gg', 'example.com', 'steamdb.info'] as $real) {
            $this->assertNull($guard->imitates($real), $real);
        }
        $this->assertSame('1.2.3.4', $guard->suspicious('логін тут http://1.2.3.4/login')['host'] ?? null);
        $this->assertNull($guard->suspicious('версія 1.2.3.4 вийшла'));
    }

    public function test_phishing_link_is_not_sent_in_chat(): void
    {
        [$a, $b] = User::factory()->count(2)->create(['created_at' => now()->subWeek()]);
        app(FriendshipService::class)->request($a, $b);
        app(FriendshipService::class)->accept($b, $a);
        $chat = app(Messenger::class)->createGroup($a, 'Рейд', [$b->id]);

        $this->actingAs($b)->post("/messages/{$chat->id}", ['body' => 'Безкоштовне Nitro: https://discord-nitro.xyz/claim'])->assertSessionHasErrors('body');
        $this->assertSame(1, SpamBlock::query()->where('kind', 'phishing')->count());
        $this->actingAs($b)->post("/messages/{$chat->id}", ['body' => 'Заходь https://discord.gg/gamecon'])->assertSessionHasNoErrors();
    }

    public function test_username_history_is_kept_and_old_name_is_held(): void
    {
        $user = User::factory()->create(['username' => 'oldnick']);
        $user->update(['username' => 'newnick']);
        $this->assertDatabaseHas('username_changes', ['user_id' => $user->id, 'old_username' => 'oldnick', 'new_username' => 'newnick']);
        $this->assertTrue(UsernameChange::held('oldnick'));
        $this->assertFalse(UsernameChange::held('oldnick', $user->id));

        // Адмінка знаходить людину за старим ніком і показує історію.
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->get('/admin/users?q=oldnick')->assertInertia(fn (Assert $page) => $page
            ->where('users.data.0.username', 'newnick')
            ->where('users.data.0.previous_usernames', ['oldnick']));
    }

    public function test_staff_flag_is_in_user_card(): void
    {
        $this->assertSame('admin', User::factory()->admin()->create()->toCard()['staff']);
        $this->assertNull(User::factory()->create()->toCard()['staff']);
    }

    public function test_admin_sees_failed_jobs_and_can_forget_them(): void
    {
        $uuid = (string) Str::uuid();
        DB::table('failed_jobs')->insert([
            'uuid' => $uuid, 'connection' => 'database', 'queue' => 'default',
            'payload' => json_encode(['displayName' => 'App\\Jobs\\RefreshMoviePlayers']),
            'exception' => "RuntimeException: Kodik недоступний\n#0 trace", 'failed_at' => now(),
        ]);
        $admin = User::factory()->admin()->create();
        $this->actingAs(User::factory()->create())->get('/admin/system')->assertForbidden();
        $this->actingAs($admin)->get('/admin/system')->assertInertia(fn (Assert $page) => $page
            ->where('queue.failed_total', 1)
            ->where('queue.failed.0.job', 'RefreshMoviePlayers')
            ->where('queue.failed.0.error', 'RuntimeException: Kodik недоступний'));
        $this->actingAs($admin)->delete("/admin/system/jobs/{$uuid}")->assertRedirect();
        $this->assertSame(0, DB::table('failed_jobs')->count());
    }
}
