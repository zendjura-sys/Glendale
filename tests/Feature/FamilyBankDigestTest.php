<?php

namespace Tests\Feature;

use App\Mail\FamilyBankDigestMail;
use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\FamilyTransaction;
use App\Models\GtaServer;
use App\Models\User;
use App\Services\Families\FamilyService;
use App\Services\Families\PersonalBankDigest;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class FamilyBankDigestTest extends TestCase
{
    use RefreshDatabase;

    private Family $family;

    private FamilyMember $member;

    protected function setUp(): void
    {
        parent::setUp();
        $server = GtaServer::query()->create([
            'slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        $this->family = app(FamilyService::class)->create(User::factory()->create(), [
            'server_id' => $server->id, 'name' => 'Scaletta Family', 'tag' => 'SCL',
            'rp_nickname' => 'Marco_Scaletta', 'static_id' => '10001',
        ]);
        $this->member = $this->family->members()->create([
            'user_id' => User::factory()->create(['email_social' => true])->id, 'rp_nickname' => 'Tony_Moretti', 'static_id' => '20002',
            'rank' => 1, 'status' => FamilyMember::STATUS_ACTIVE, 'joined_at' => now(),
        ]);
        $this->member->forceFill(['balance' => 125_050])->save();
    }

    private function transaction(string $type, int $amount, CarbonImmutable $at, ?int $memberId = null): void
    {
        $t = new FamilyTransaction(['family_id' => $this->family->id, 'member_id' => $memberId ?? $this->member->id, 'type' => $type, 'amount' => $amount, 'treasury_delta' => 0, 'comment' => $type === 'fine' ? 'Запізнення' : null]);
        $t->created_at = $at->utc();
        $t->save();
    }

    public function test_member_gets_own_account_and_week_operations_only(): void
    {
        $monday = CarbonImmutable::parse('2026-09-28 12:00', 'Europe/Kyiv');
        $this->transaction('report_reward', 50_000, $monday);
        $this->transaction('fine', -10_000, $monday->addDays(2));
        $this->transaction('report_reward', 99_900, $monday->subDays(3)); // минулий тиждень — не входить
        $this->transaction('report_reward', 7_700, $monday, $this->family->members()->where('rank', '>', 1)->value('id')); // чужий рахунок

        $accounts = app(PersonalBankDigest::class)->build($this->member->user, $monday->addDays(5));

        $this->assertCount(1, $accounts);
        $this->assertSame('[SCL] Scaletta Family', $accounts[0]['family']);
        $this->assertSame(125_050, $accounts[0]['balance']);
        $this->assertSame(50_000, $accounts[0]['income']);
        $this->assertSame(10_000, $accounts[0]['spent']);
        $this->assertCount(2, $accounts[0]['operations']);
        $this->assertSame('Штраф', $accounts[0]['operations'][1]['label']);
        $this->assertSame('Запізнення', $accounts[0]['operations'][1]['comment']);

        $rendered = (new FamilyBankDigestMail($accounts, '28.09 – 04.10.2026'))->render();
        $this->assertStringContainsString('1 250,50 ₴', $rendered);
        $this->assertStringContainsString('Запізнення', $rendered);
    }

    public function test_digest_goes_only_to_family_members_who_did_not_unsubscribe(): void
    {
        Mail::fake();
        $stranger = User::factory()->create();
        $left = User::factory()->create();
        $this->family->members()->create(['user_id' => $left->id, 'rp_nickname' => 'Left_Guy', 'static_id' => '30003', 'rank' => 1, 'status' => FamilyMember::STATUS_LEFT, 'joined_at' => now()]);

        $this->artisan('families:bank-digest')->assertSuccessful();

        Mail::assertQueued(FamilyBankDigestMail::class, fn (FamilyBankDigestMail $m) => $m->hasTo($this->member->user->email));
        Mail::assertNotQueued(FamilyBankDigestMail::class, fn (FamilyBankDigestMail $m) => $m->hasTo($stranger->email) || $m->hasTo($left->email));

        Mail::fake();
        $this->member->user->forceFill(['email_social' => false])->save();
        $this->assertFalse(app(PersonalBankDigest::class)->send($this->member->user->fresh()));
        Mail::assertNothingQueued();
    }
}
