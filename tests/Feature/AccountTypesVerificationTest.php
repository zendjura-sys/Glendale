<?php

namespace Tests\Feature;

use App\Models\AccountLink;
use App\Models\Post;
use App\Models\User;
use App\Models\VerificationRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AccountTypesVerificationTest extends TestCase
{
    use RefreshDatabase;

    /** Людина, що виконує всі вимоги верифікації. */
    private function ready(array $attributes = []): User
    {
        $user = User::factory()->create([...$attributes]);
        $user->forceFill(['created_at' => now()->subDays(60), 'two_factor_confirmed_at' => now(), 'avatar_path' => 'avatars/me.png'])->save();
        for ($i = 0; $i < 5; $i++) {
            Post::query()->create(['author_id' => $user->id, 'wall_type' => $user->getMorphClass(), 'wall_id' => $user->id, 'body' => "Запис {$i}", 'visibility' => 'public']);
        }

        return $user->fresh();
    }

    public function test_business_account_shows_its_fields_on_profile(): void
    {
        $user = User::factory()->create(['username' => 'pixel_cafe']);
        $this->actingAs($user)->put('/settings/account-type', ['type' => 'business', 'details' => ['email' => 'not-mail']])->assertSessionHasErrors('details.email');
        $this->actingAs($user)->put('/settings/account-type', ['type' => 'business', 'details' => ['address' => 'Київ, Хрещатик 1', 'website' => 'pixel.cafe', 'twitch' => 'ignored']])->assertSessionHasNoErrors();

        $this->assertSame(['address' => 'Київ, Хрещатик 1', 'website' => 'https://pixel.cafe'], $user->fresh()->account_details);
        $this->actingAs(User::factory()->create())->get('/pixel_cafe')->assertInertia(fn (Assert $page) => $page
            ->where('account.type', 'business')
            ->where('account.details.address.value', 'Київ, Хрещатик 1')
            ->where('profile.account_type', 'business'));
    }

    public function test_agency_roster_needs_streamer_consent(): void
    {
        $agency = User::factory()->create();
        $streamer = User::factory()->create(['username' => 'neo_stream']);
        $this->actingAs($agency)->post('/settings/account-type/roster', ['username' => 'neo_stream'])->assertSessionHasErrors('username');

        $this->actingAs($agency)->put('/settings/account-type', ['type' => 'agency']);
        $this->actingAs($agency)->post('/settings/account-type/roster', ['username' => '@neo_stream', 'role' => 'Стрімер'])->assertSessionHasNoErrors();
        $link = AccountLink::query()->firstOrFail();
        $this->assertSame('pending', $link->status);
        $this->assertSame(1, $streamer->notifications()->count());

        // До згоди — на сторінці агенції людини немає.
        $this->actingAs($streamer)->get("/{$agency->username}")->assertInertia(fn (Assert $page) => $page->where('account.roster', []));
        $this->actingAs($agency)->post("/settings/account-type/links/{$link->id}", ['accept' => true])->assertForbidden();
        $this->actingAs($streamer)->post("/settings/account-type/links/{$link->id}", ['accept' => true])->assertRedirect();

        $this->actingAs($streamer)->get("/{$agency->username}")->assertInertia(fn (Assert $page) => $page->where('account.roster.0.username', 'neo_stream'));
        $this->actingAs($agency)->get('/neo_stream')->assertInertia(fn (Assert $page) => $page->where('account.member_of.0.id', $agency->id));

        // Агенція стала особистим акаунтом — склад розпускається.
        $this->actingAs($agency)->put('/settings/account-type', ['type' => 'personal']);
        $this->assertSame(0, AccountLink::query()->count());
    }

    public function test_verification_requires_basics_and_admin_decision(): void
    {
        Storage::fake('local');
        $newbie = User::factory()->create();
        $this->actingAs($newbie)->post('/settings/verification', ['kind' => 'identity', 'links' => ['https://twitch.tv/newbie']])->assertSessionHasErrors('kind');

        $streamer = $this->ready();
        $this->actingAs($streamer)->put('/settings/account-type', ['type' => 'streamer']);
        $this->actingAs($streamer)->post('/settings/verification', ['kind' => 'business', 'links' => ['https://twitch.tv/neo']])->assertSessionHasErrors('kind');
        $this->actingAs($streamer)->post('/settings/verification', [
            'kind' => 'creator',
            'links' => ['https://twitch.tv/neo'],
            'document' => UploadedFile::fake()->image('id.jpg'),
        ])->assertSessionHasNoErrors();
        $request = VerificationRequest::query()->firstOrFail();
        Storage::disk('local')->assertExists($request->document_path);
        $this->actingAs($streamer)->post('/settings/verification', ['kind' => 'creator', 'links' => ['https://twitch.tv/neo']])->assertSessionHasErrors('kind');

        $this->actingAs($streamer)->get('/admin/verification')->assertForbidden();
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->get('/admin/verification')->assertInertia(fn (Assert $page) => $page->where('requests.data.0.has_document', true));
        $this->actingAs($admin)->get("/admin/verification/{$request->id}/document")->assertOk();
        $this->actingAs($admin)->post("/admin/verification/{$request->id}", ['decision' => 'reject'])->assertSessionHasErrors('reason');
        $this->actingAs($admin)->post("/admin/verification/{$request->id}", ['decision' => 'approve'])->assertSessionHasNoErrors();

        $streamer->refresh();
        $this->assertTrue($streamer->is_verified);
        $this->assertSame('creator', $streamer->verification_kind);
        Storage::disk('local')->assertMissing((string) $request->document_path);
        $this->assertNull($request->fresh()->document_path);
        $this->assertSame('creator', $streamer->toCard()['verified_kind']);

        // Змінив імʼя — позначку знято.
        $streamer->update(['first_name' => 'Інше']);
        $this->assertFalse($streamer->fresh()->is_verified);
    }

    public function test_rejected_request_has_cooldown_and_needs_info_reopens(): void
    {
        $user = $this->ready();
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($user)->post('/settings/verification', ['kind' => 'identity', 'links' => ['https://example.com/me']]);
        $request = VerificationRequest::query()->firstOrFail();

        $this->actingAs($admin)->post("/admin/verification/{$request->id}", ['decision' => 'needs_info', 'reason' => 'Додайте посилання на соцмережу']);
        $this->actingAs($user)->post('/settings/verification', ['kind' => 'identity', 'links' => ['https://example.com/me', 'https://x.com/me']])->assertSessionHasNoErrors();
        $this->assertSame(1, VerificationRequest::query()->count());
        $this->assertSame('pending', $request->fresh()->status);

        $this->actingAs($admin)->post("/admin/verification/{$request->id}", ['decision' => 'reject', 'reason' => 'Не схоже на справжню сторінку']);
        $this->actingAs($user)->post('/settings/verification', ['kind' => 'identity', 'links' => ['https://example.com/me']])->assertSessionHasErrors('kind');
        $this->actingAs($user)->get('/settings/account-type')->assertInertia(fn (Assert $page) => $page
            ->where('verification.request.status', 'rejected')
            ->whereNot('verification.retry_at', null));
    }
}
