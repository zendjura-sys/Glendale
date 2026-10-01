<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Family;
use App\Models\FamilyAuditLog;
use App\Models\FamilyCashout;
use App\Models\FamilyDeposit;
use App\Models\FamilyItem;
use App\Models\FamilyItemLog;
use App\Models\FamilyMember;
use App\Models\FamilyPunishment;
use App\Models\FamilyReport;
use App\Models\FamilyTransaction;
use App\Models\GtaServer;
use App\Models\Message;
use App\Models\User;
use App\Services\Families\FamilyRating;
use App\Services\Families\FamilyService;
use App\Services\Families\WeeklyDigest;
use App\Services\MessengerPresenter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use LogicException;
use Tests\TestCase;

class FamiliesTest extends TestCase
{
    use RefreshDatabase;

    private GtaServer $server;

    private User $leaderUser;

    private Family $family;

    private FamilyMember $leader;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('public');
        Http::preventStrayRequests();

        $this->server = GtaServer::query()->create([
            'slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        $this->leaderUser = User::factory()->create();
        $this->family = app(FamilyService::class)->create($this->leaderUser, [
            'server_id' => $this->server->id,
            'name' => 'Scaletta Family',
            'tag' => 'SCL',
            'rp_nickname' => 'Marco_Scaletta',
            'static_id' => '10001',
        ]);
        app(FamilyService::class)->setStatus($this->family, User::factory()->admin()->create(), Family::STATUS_VERIFIED, null);
        $this->family->refresh();
        $this->leader = FamilyMember::query()->where('user_id', $this->leaderUser->id)->firstOrFail();
    }

    private function member(int $rank = 1, string $nickname = 'Tony_Moretti', string $static = '20002'): FamilyMember
    {
        $user = User::factory()->create();
        $member = $this->family->members()->create([
            'user_id' => $user->id,
            'rp_nickname' => $nickname,
            'static_id' => $static,
            'rank' => $rank,
            'status' => FamilyMember::STATUS_ACTIVE,
            'joined_at' => now(),
        ]);

        return $member->setRelation('user', $user);
    }

    /**
     * Унікальний «скріншот»: шум із сіда, щоб dHash відрізнявся.
     */
    private function screenshot(int $seed, string $format = 'png'): UploadedFile
    {
        mt_srand($seed);
        $img = imagecreatetruecolor(320, 180);
        for ($i = 0; $i < 60; $i++) {
            $color = (int) imagecolorallocate($img, mt_rand(0, 255), mt_rand(0, 255), mt_rand(0, 255));
            imagefilledrectangle($img, mt_rand(0, 300), mt_rand(0, 160), mt_rand(0, 320), mt_rand(0, 180), $color);
        }
        $path = tempnam(sys_get_temp_dir(), 'shot');
        $format === 'jpg' ? imagejpeg($img, $path, 55) : imagepng($img, $path);

        return new UploadedFile($path, "shot-{$seed}.{$format}", $format === 'jpg' ? 'image/jpeg' : 'image/png', null, true);
    }

    private function bizwar(FamilyMember $as, array $overrides = [], ?UploadedFile $proof = null)
    {
        return $this->actingAs($as->user)->post(route('families.reports.store', $this->family), [
            'type' => 'bizwar',
            'for' => 'self',
            'event_date' => now('Europe/Kyiv')->toDateString(),
            'wins' => 2,
            'losses' => 1,
            'hours' => [18, 19],
            'proofs' => [$proof ?? $this->screenshot(random_int(1, 1_000_000))],
            ...$overrides,
        ]);
    }

    public function test_family_creation_enforces_rp_identity_and_seeds_structure(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->post(route('families.store'), [
            'server_id' => $this->server->id, 'name' => 'Bad', 'tag' => 'BAD', 'rp_nickname' => 'marco scaletta', 'static_id' => 'abc',
        ])->assertSessionHasErrors(['rp_nickname', 'static_id']);

        $this->actingAs($user)->post(route('families.store'), [
            'server_id' => $this->server->id, 'name' => 'Corleone', 'tag' => 'scl', 'rp_nickname' => 'Vito_Corleone', 'static_id' => '555',
        ])->assertSessionHasErrors('tag');

        $this->actingAs($user)->post(route('families.store'), [
            'server_id' => $this->server->id, 'name' => 'Corleone', 'tag' => 'CRL', 'rp_nickname' => 'Vito_Corleone', 'static_id' => '555',
        ])->assertRedirect();

        $family = Family::query()->where('tag', 'CRL')->firstOrFail();
        $this->assertSame(Family::STATUS_PENDING, $family->status);
        $this->assertSame(1, $family->members_count);
        $this->assertSame('Vito_Corleone [555]', $family->members()->first()->displayName());
        $this->assertSame(Family::LEADER_RANK, $family->members()->first()->rank);
        $this->assertSame(count(FamilyItem::STARTER), $family->items()->count());
        $this->assertTrue(FamilyAuditLog::query()->where('family_id', $family->id)->where('action', 'FAMILY_CREATE')->exists());
        $this->assertNull($family->conversation_id);
    }

    public function test_verification_opens_family_chat_with_rp_names(): void
    {
        $this->assertNotNull($this->family->conversation_id);
        $conversation = Conversation::query()->findOrFail($this->family->conversation_id);
        $this->assertSame($this->family->id, $conversation->family_id);
        $this->assertSame('[SCL] Scaletta Family', $conversation->title);

        $applicant = User::factory()->create();
        $this->actingAs($applicant)->post(route('families.apply', $this->family), ['rp_nickname' => 'Luca_Brasi', 'static_id' => '777'])
            ->assertSessionHasNoErrors();
        $pending = FamilyMember::query()->where('user_id', $applicant->id)->firstOrFail();
        $this->assertSame(FamilyMember::STATUS_PENDING, $pending->status);

        $this->actingAs($this->leaderUser)->post(route('families.members.accept', [$this->family, $pending]))->assertRedirect();
        $this->assertTrue(ConversationParticipant::query()->where('conversation_id', $conversation->id)->where('user_id', $applicant->id)->whereNull('left_at')->exists());

        $message = $conversation->messages()->create(['user_id' => $applicant->id, 'type' => Message::TYPE_TEXT, 'body' => 'Всім привіт']);
        $card = app(MessengerPresenter::class)->message($message->load('user'), $applicant);
        $this->assertSame('Luca_Brasi [777]', $card['user']['name']);
        $this->assertSame('Новачок', $card['user']['family_rank']['title']);

        $this->actingAs($this->leaderUser)->post(route('families.members.kick', [$this->family, $pending]), ['reason' => 'Неактив'])->assertRedirect();
        $this->assertNotNull(ConversationParticipant::query()->where('conversation_id', $conversation->id)->where('user_id', $applicant->id)->value('left_at'));
    }

    public function test_static_id_belongs_to_one_player_per_server(): void
    {
        $this->member(1, 'Tony_Moretti', '20002');
        $other = User::factory()->create();
        $other2 = User::factory()->create();
        $family2 = app(FamilyService::class)->create($other, ['server_id' => $this->server->id, 'name' => 'Second', 'tag' => 'SEC', 'rp_nickname' => 'Vito_Corleone', 'static_id' => '30003']);
        $family2->update(['status' => Family::STATUS_VERIFIED]);

        $this->actingAs($other2)->post(route('families.apply', $family2), ['rp_nickname' => 'Fake_Tony', 'static_id' => '20002'])
            ->assertSessionHasErrors('static_id');
    }

    public function test_bizwar_report_is_credited_on_approval_by_officer(): void
    {
        $soldier = $this->member();
        $officer = $this->member(7, 'Paulie_Gatto', '30003');

        $this->bizwar($soldier)->assertSessionHasNoErrors();
        $report = FamilyReport::query()->firstOrFail();
        $this->assertSame(FamilyReport::STATUS_PENDING, $report->status);
        $this->assertSame(2 * 50000 + 15000, $report->reward);

        // Звичайний учасник не бачить черги й не може перевіряти.
        $this->actingAs($soldier->user)->get(route('families.queue', $this->family))->assertForbidden();

        $this->actingAs($officer->user)->post(route('families.reports.review', [$this->family, $report]), ['decision' => 'approve'])->assertRedirect();

        $this->assertSame(FamilyReport::STATUS_APPROVED, $report->fresh()->status);
        $this->assertSame(115000, $soldier->fresh()->balance);
        $this->assertTrue(FamilyTransaction::query()->where('member_id', $soldier->id)->where('type', 'report_reward')->where('amount', 115000)->exists());
        $this->assertTrue(FamilyAuditLog::query()->where('action', 'REPORT_APPROVE')->where('target_member_id', $soldier->id)->exists());
        $this->assertSame(1, $soldier->user->notifications()->count());
    }

    public function test_officer_cannot_review_own_report_and_rejection_needs_reason(): void
    {
        $officer = $this->member(7, 'Paulie_Gatto', '30003');
        $this->bizwar($officer)->assertSessionHasNoErrors();
        $report = FamilyReport::query()->firstOrFail();

        $this->actingAs($officer->user)->post(route('families.reports.review', [$this->family, $report]), ['decision' => 'approve'])
            ->assertSessionHasErrors('report');

        $this->actingAs($this->leaderUser)->post(route('families.reports.review', [$this->family, $report]), ['decision' => 'reject'])
            ->assertSessionHasErrors('comment');
        $this->actingAs($this->leaderUser)->post(route('families.reports.review', [$this->family, $report]), ['decision' => 'reject', 'comment' => 'Немає таймкоду'])
            ->assertSessionHasNoErrors();
        $this->assertSame(0, $officer->fresh()->balance);
    }

    public function test_report_for_friend_credits_beneficiary(): void
    {
        $soldier = $this->member();
        $friend = $this->member(2, 'Sal_Tessio', '40004');

        $this->actingAs($soldier->user)->post(route('families.reports.store', $this->family), [
            'type' => 'contract', 'for' => 'friend', 'beneficiary_id' => $friend->id,
            'event_date' => now('Europe/Kyiv')->toDateString(), 'tier' => 'heavy', 'count' => 2,
            'proofs' => [$this->screenshot(5)],
        ])->assertSessionHasNoErrors();

        $report = FamilyReport::query()->firstOrFail();
        $this->assertSame($friend->id, $report->beneficiary_id);
        $this->assertSame($soldier->id, $report->submitter_id);

        $this->actingAs($this->leaderUser)->post(route('families.reports.review', [$this->family, $report]), ['decision' => 'approve']);
        $this->assertSame(2 * 70000, $friend->fresh()->balance);
        $this->assertSame(0, $soldier->fresh()->balance);
    }

    public function test_deadline_locks_reports_older_than_48_hours(): void
    {
        $soldier = $this->member();
        $this->bizwar($soldier, ['event_date' => now('Europe/Kyiv')->subDays(3)->toDateString()])
            ->assertSessionHasErrors('event_date');
        $this->bizwar($soldier, ['event_date' => now('Europe/Kyiv')->addDay()->toDateString()])
            ->assertSessionHasErrors('event_date');
        $this->bizwar($soldier, ['event_date' => now('Europe/Kyiv')->subDay()->toDateString()])
            ->assertSessionHasNoErrors();
    }

    public function test_contract_daily_limit_is_enforced_per_tier(): void
    {
        $soldier = $this->member();
        $payload = fn (int $count, int $seed) => [
            'type' => 'contract', 'for' => 'self', 'event_date' => now('Europe/Kyiv')->toDateString(),
            'tier' => 'light', 'count' => $count, 'proofs' => [$this->screenshot($seed)],
        ];

        $this->actingAs($soldier->user)->post(route('families.reports.store', $this->family), $payload(7, 11))->assertSessionHasNoErrors();
        $this->actingAs($soldier->user)->post(route('families.reports.store', $this->family), $payload(4, 12))->assertSessionHasErrors('count');
        $this->actingAs($soldier->user)->post(route('families.reports.store', $this->family), $payload(3, 13))->assertSessionHasNoErrors();
        $this->actingAs($soldier->user)->post(route('families.reports.store', $this->family), [...$payload(5, 14), 'tier' => 'medium'])->assertSessionHasNoErrors();
    }

    public function test_reused_or_recompressed_screenshot_is_blocked(): void
    {
        $soldier = $this->member();
        $friend = $this->member(2, 'Sal_Tessio', '40004');

        $original = $this->screenshot(42);
        $copy = tempnam(sys_get_temp_dir(), 'copy');
        copy($original->getRealPath(), $copy);

        $this->bizwar($soldier, [], $original)->assertSessionHasNoErrors();

        // Точна копія файлу від іншого учасника.
        $this->bizwar($friend, [], new UploadedFile($copy, 'same.png', 'image/png', null, true))
            ->assertSessionHasErrors('proofs.0');

        // Той самий кадр, пересжатий у JPEG.
        $this->bizwar($friend, [], $this->screenshot(42, 'jpg'))->assertSessionHasErrors('proofs.0');

        // Два однакові файли в одному звіті.
        $this->bizwar($friend, ['proofs' => [$this->screenshot(77), $this->screenshot(77)]])->assertSessionHasErrors('proofs.1');

        $this->bizwar($friend, [], $this->screenshot(43))->assertSessionHasNoErrors();
        $this->assertSame(2, FamilyReport::query()->count());
    }

    public function test_cashout_holds_funds_and_officer_pays_in_game(): void
    {
        $soldier = $this->member();
        app(\App\Services\Families\FamilyBank::class)->post($this->family, $soldier, 'manual_credit', 500000, 0, $this->leader, 'Премія');
        app(\App\Services\Families\FamilyBank::class)->post($this->family, null, 'treasury_in', 0, 10_000_000, $this->leader, 'Старт');

        $this->actingAs($soldier->user)->post(route('families.cashouts.store', $this->family), ['amount' => 6000])->assertSessionHasErrors('amount');
        $this->actingAs($soldier->user)->post(route('families.cashouts.store', $this->family), ['amount' => 3000, 'note' => 'На авто'])->assertSessionHasNoErrors();

        $cashout = FamilyCashout::query()->firstOrFail();
        $this->assertSame(200000, $soldier->fresh()->balance);

        $this->actingAs($soldier->user)->post(route('families.cashouts.pay', [$this->family, $cashout]))->assertForbidden();
        $this->actingAs($this->leaderUser)->post(route('families.cashouts.pay', [$this->family, $cashout]), [
            'comment' => 'Видано біля офісу', 'proof' => UploadedFile::fake()->image('pay.png'),
        ])->assertSessionHasNoErrors();

        $this->assertSame(FamilyCashout::STATUS_PAID, $cashout->fresh()->status);
        $this->assertSame(10_000_000 - 300000, $this->family->fresh()->treasury);
        $this->assertTrue(FamilyAuditLog::query()->where('action', 'MONEY_CASHOUT')->exists());

        $this->actingAs($soldier->user)->post(route('families.cashouts.store', $this->family), ['amount' => 1000]);
        $second = FamilyCashout::query()->where('status', 'pending')->firstOrFail();
        $this->actingAs($soldier->user)->post(route('families.cashouts.cancel', [$this->family, $second]))->assertSessionHasNoErrors();
        $this->assertSame(200000, $soldier->fresh()->balance);
    }

    public function test_deposit_matures_with_interest(): void
    {
        $soldier = $this->member();
        app(\App\Services\Families\FamilyBank::class)->post($this->family, $soldier, 'manual_credit', 500000, 0, $this->leader, 'Премія');

        $this->actingAs($soldier->user)->post(route('families.deposits.store', $this->family), ['amount' => 2000, 'period' => 'weekly', 'periods' => 2])
            ->assertSessionHasNoErrors();
        $deposit = FamilyDeposit::query()->firstOrFail();
        $this->assertSame(200000 + 16000, $deposit->payout);
        $this->assertSame(300000, $soldier->fresh()->balance);

        $this->travel(15)->days();
        $this->artisan('families:tick')->assertSuccessful();

        $this->assertSame(FamilyDeposit::STATUS_MATURED, $deposit->fresh()->status);
        $this->assertSame(516000, $soldier->fresh()->balance);
        $this->assertTrue(FamilyTransaction::query()->where('type', 'deposit_interest')->where('amount', 16000)->exists());
    }

    public function test_warehouse_flags_takes_over_hourly_quota(): void
    {
        $soldier = $this->member();
        $quartermaster = $this->member(8, 'Rocco_Lampone', '50005');
        $armor = $this->family->items()->where('name', 'Бронежилет')->firstOrFail();
        $armor->update(['quantity' => 20, 'hourly_quota' => 3]);

        $this->actingAs($soldier->user)->post(route('families.warehouse.move', $this->family), ['item_id' => $armor->id, 'action' => 'take', 'quantity' => 2]);
        $this->assertFalse(FamilyItemLog::query()->latest('id')->first()->is_suspicious);

        $this->actingAs($soldier->user)->post(route('families.warehouse.move', $this->family), ['item_id' => $armor->id, 'action' => 'take', 'quantity' => 2]);
        $this->assertTrue(FamilyItemLog::query()->latest('id')->first()->is_suspicious);
        $this->assertSame(16, $armor->fresh()->quantity);
        $this->assertTrue(FamilyAuditLog::query()->where('action', 'WAREHOUSE_ALERT')->exists());
        $this->assertSame(1, $quartermaster->user->notifications()->count());

        $this->actingAs($soldier->user)->post(route('families.warehouse.move', $this->family), ['item_id' => $armor->id, 'action' => 'take', 'quantity' => 100])
            ->assertSessionHasErrors('quantity');
    }

    public function test_three_warns_auto_demote_and_kick_mode_removes_member(): void
    {
        $soldier = $this->member(4);

        foreach (range(1, 3) as $i) {
            $this->actingAs($this->leaderUser)->post(route('families.discipline.store', $this->family), [
                'member_id' => $soldier->id, 'type' => 'warn', 'reason' => "Порушення {$i}",
            ])->assertSessionHasNoErrors();
        }

        $this->assertSame(3, $soldier->fresh()->rank);
        $this->assertSame(0, FamilyPunishment::query()->active()->where('member_id', $soldier->id)->where('type', 'warn')->count());
        $this->assertTrue(FamilyAuditLog::query()->where('action', 'SANCTION_ESCALATE')->exists());

        $settings = $this->family->settings ?? [];
        $settings['discipline'] = ['warn_limit' => 2, 'escalation' => 'kick', 'warn_days' => 30];
        $this->family->update(['settings' => $settings]);

        foreach (range(1, 2) as $i) {
            $this->actingAs($this->leaderUser)->post(route('families.discipline.store', $this->family), [
                'member_id' => $soldier->id, 'type' => 'warn', 'reason' => "Рецидив {$i}",
            ]);
        }
        $this->assertSame(FamilyMember::STATUS_KICKED, $soldier->fresh()->status);
    }

    public function test_fine_goes_negative_and_lower_ranks_cannot_punish_higher(): void
    {
        $soldier = $this->member(2);
        $officer = $this->member(8, 'Rocco_Lampone', '50005');

        $this->actingAs($this->leaderUser)->post(route('families.discipline.store', $this->family), [
            'member_id' => $soldier->id, 'type' => 'fine', 'reason' => 'Запізнення', 'amount' => 250,
        ])->assertSessionHasNoErrors();
        $this->assertSame(-25000, $soldier->fresh()->balance);

        $this->actingAs($officer->user)->post(route('families.discipline.store', $this->family), [
            'member_id' => $this->leader->id, 'type' => 'warn', 'reason' => 'Бунт',
        ])->assertSessionHasErrors('member_id');

        $this->actingAs($soldier->user)->post(route('families.discipline.store', $this->family), [
            'member_id' => $officer->id, 'type' => 'warn', 'reason' => 'Бунт',
        ])->assertForbidden();
    }

    public function test_permission_matrix_can_grant_treasury_to_rank_seven(): void
    {
        $officer = $this->member(7, 'Paulie_Gatto', '30003');
        $this->actingAs($officer->user)->post(route('families.bank.manual', $this->family), [
            'target' => 'treasury', 'direction' => 'credit', 'amount' => 100, 'comment' => 'Тест',
        ])->assertForbidden();

        $matrix = $this->family->permissionMatrix();
        $matrix['treasury.manage'] = [7, 9];
        $titles = $this->family->rankTitles();
        $titles[7] = 'Скарбник';

        $this->actingAs($this->leaderUser)->put(route('families.ranks.update', $this->family), ['titles' => array_values($titles), 'matrix' => $matrix])
            ->assertSessionHasNoErrors();

        $this->assertSame('Скарбник', $this->family->fresh()->rankTitle(7));
        $this->actingAs($officer->user)->post(route('families.bank.manual', $this->family), [
            'target' => 'treasury', 'direction' => 'credit', 'amount' => 100, 'comment' => 'Внесок',
        ])->assertSessionHasNoErrors();
        $this->assertSame(10000, $this->family->fresh()->treasury);
        $this->assertTrue(FamilyAuditLog::query()->where('action', 'PERMISSIONS_UPDATE')->exists());
    }

    public function test_weekly_digest_lists_only_earnings_above_one_hryvnia(): void
    {
        Http::fake(['discord.com/api/webhooks/*' => Http::response(null, 204)]);
        $rich = $this->member();
        $poor = $this->member(2, 'Sal_Tessio', '40004');
        $bank = app(\App\Services\Families\FamilyBank::class);
        $bank->post($this->family, $rich, 'report_reward', 450000, 0, $this->leader, 'Бізвар');
        $bank->post($this->family, $poor, 'report_reward', 100, 0, $this->leader, 'Копійки');
        $this->family->update(['webhooks' => ['discord' => 'https://discord.com/api/webhooks/123/abc']]);

        $digest = app(WeeklyDigest::class);
        $built = $digest->build($this->family->fresh());
        $this->assertCount(1, $built['lines']);
        $this->assertSame($rich->id, $built['lines'][0]['member']->id);

        $result = $digest->send($this->family->fresh());
        $this->assertSame(['chat' => true, 'discord' => true], $result);
        $this->assertStringContainsString('Tony_Moretti [20002] — 4 500 ₴', (string) Message::query()->latest('id')->value('body'));
        $this->assertNull($digest->send($this->family->fresh()));
        Http::assertSentCount(1);
    }

    public function test_rating_respects_toggles(): void
    {
        $soldier = $this->member();
        $this->bizwar($soldier);
        $this->actingAs($this->leaderUser)->post(route('families.reports.review', [$this->family, FamilyReport::query()->firstOrFail()]), ['decision' => 'approve']);

        $rating = app(FamilyRating::class);
        $board = collect($rating->leaderboard($this->family->fresh(), 'week'));
        $this->assertSame(2 * 10 + 3, $board->firstWhere('id', $soldier->id)['points']);

        $this->family->update(['settings' => [...($this->family->settings ?? []), 'rating' => ['bizwar' => false]]]);
        app(\App\Services\Families\FamilyNotifier::class)->refresh($this->family, 'settings');
        $board = collect($rating->leaderboard($this->family->fresh(), 'week'));
        $this->assertSame(0, $board->firstWhere('id', $soldier->id)['points']);
        $this->assertSame(2, $board->firstWhere('id', $soldier->id)['bizwar_wins']);
    }

    public function test_audit_log_and_ledger_are_immutable(): void
    {
        $log = FamilyAuditLog::query()->firstOrFail();
        $this->expectException(LogicException::class);
        $log->update(['action' => 'HACK']);
    }

    public function test_suspended_family_is_read_only_and_non_members_are_blocked(): void
    {
        $soldier = $this->member();
        $outsider = User::factory()->create();
        $this->actingAs($outsider)->get(route('families.bank', $this->family))->assertForbidden();

        app(FamilyService::class)->setStatus($this->family, User::factory()->admin()->create(), Family::STATUS_SUSPENDED, 'Порушення правил');
        $this->bizwar($soldier)->assertStatus(423);
    }

    public function test_admin_verifies_family_from_panel(): void
    {
        $owner = User::factory()->create();
        $family = app(FamilyService::class)->create($owner, ['server_id' => $this->server->id, 'name' => 'Новенькі', 'tag' => 'NEW', 'rp_nickname' => 'Nick_Newbie', 'static_id' => '909']);
        $admin = User::factory()->admin()->create();

        $this->actingAs($owner)->patch(route('admin.families.update', $family), ['status' => 'verified'])->assertForbidden();
        $this->actingAs($admin)->patch(route('admin.families.update', $family), ['status' => 'suspended'])->assertSessionHasErrors('reason');
        $this->actingAs($admin)->patch(route('admin.families.update', $family), ['status' => 'verified'])->assertSessionHasNoErrors();

        $this->assertTrue($family->fresh()->isVerified());
        $this->assertNotNull($family->fresh()->conversation_id);
        $this->assertTrue(FamilyAuditLog::query()->where('family_id', $family->id)->where('action', 'FAMILY_STATUS')->where('actor_user_id', $admin->id)->exists());
    }
}
