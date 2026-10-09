<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Models\FamilyCashout;
use App\Models\FamilyDeposit;
use App\Models\FamilyMember;
use App\Models\FamilyTransaction;
use App\Services\Families\FamilyBank;
use App\Support\Money;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FamilyBankController extends FamilyBaseController
{
    public function index(Request $request, Family $family): Response
    {
        $member = $this->member($request, $family);
        $can = $this->gate->abilities($member, $family);
        $scope = $can['treasury.manage'] && $request->string('scope')->toString() === 'family' ? 'family' : 'me';

        $ledger = FamilyTransaction::query()
            ->with(['member', 'actor'])
            ->where('family_id', $family->id)
            ->when($scope === 'me', fn ($q) => $q->where('member_id', $member->id))
            ->latest('id')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (FamilyTransaction $t) => self::transaction($t, $family));

        $settings = $family->resolvedSettings();

        return $this->page($family, $member, 'families/bank', 'bank', [
            'scope' => $scope,
            'ledger' => Inertia::scroll(fn () => $ledger),
            'cashouts' => FamilyCashout::query()->with('member')->where('member_id', $member->id)->latest('id')->limit(10)->get()
                ->map(fn (FamilyCashout $c) => self::cashout($c)),
            'deposits' => FamilyDeposit::query()->where('member_id', $member->id)->latest('id')->limit(20)->get()
                ->map(fn (FamilyDeposit $d) => self::deposit($d)),
            'config' => [
                'deposits' => $settings['deposits'],
                'cashout_min' => $settings['cashout']['min_amount'],
                'rates' => $settings['rates'],
            ],
            'totals' => $can['treasury.manage'] ? [
                'balances' => (int) FamilyMember::query()->where('family_id', $family->id)->where('status', FamilyMember::STATUS_ACTIVE)->sum('balance'),
                'deposits' => (int) FamilyDeposit::query()->where('family_id', $family->id)->where('status', FamilyDeposit::STATUS_ACTIVE)->sum('amount'),
                'pending_cashouts' => (int) FamilyCashout::query()->where('family_id', $family->id)->where('status', FamilyCashout::STATUS_PENDING)->sum('amount'),
                'paid_week' => (int) -FamilyTransaction::query()->where('family_id', $family->id)->where('type', 'cashout_paid')->where('created_at', '>=', now()->subWeek())->sum('treasury_delta'),
            ] : null,
            'roster' => $can['treasury.manage'] ? $this->roster($family) : [],
        ]);
    }

    public function requestCashout(Request $request, Family $family, FamilyBank $bank): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:1', 'max:100000000'],
            'note' => ['nullable', 'string', 'max:300'],
        ]);

        $bank->requestCashout($family, $member, $this->money($data['amount']), $data['note'] ?? null);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Заявку створено: кошти зарезервовано до видачі в грі.']);

        return back();
    }

    public function cancelCashout(Request $request, Family $family, FamilyCashout $cashout, FamilyBank $bank): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        if ($cashout->member_id !== $member->id) {
            $this->gate->authorize($member, $family, 'treasury.manage');
        }
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:300']]);

        $bank->cancelCashout($family, $cashout, $member, $data['reason'] ?? null);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Заявку скасовано, кошти повернено на рахунок.']);

        return back();
    }

    public function payCashout(Request $request, Family $family, FamilyCashout $cashout, FamilyBank $bank): RedirectResponse
    {
        $member = $this->member($request, $family, 'treasury.manage', write: true);
        $data = $request->validate([
            'comment' => ['nullable', 'string', 'max:300'],
            'proof' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);

        $bank->payCashout($family, $cashout, $member, $request->file('proof'), $data['comment'] ?? null);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Виплату підтверджено ✅']);

        return back();
    }

    public function cashoutProof(Request $request, Family $family, FamilyCashout $cashout): StreamedResponse
    {
        $member = $this->member($request, $family);
        abort_unless($cashout->member_id === $member->id || $this->gate->can($member, $family, 'treasury.manage'), 403);
        abort_if($cashout->proof_path === null || $cashout->proof_path === '', 404);

        return Storage::disk('local')->response($cashout->proof_path);
    }

    public function openDeposit(Request $request, Family $family, FamilyBank $bank): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:1', 'max:100000000'],
            'period' => ['required', Rule::in(array_keys(FamilyDeposit::PERIODS))],
            'periods' => ['required', 'integer', 'min:1', 'max:60'],
        ]);

        $deposit = $bank->openDeposit($family, $member, $this->money($data['amount']), $data['period'], (int) $data['periods']);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Депозит відкрито: до виплати '.Money::format($deposit->payout).' '.$deposit->matures_at->setTimezone('Europe/Kyiv')->format('d.m.Y H:i').'.']);

        return back();
    }

    public function closeDeposit(Request $request, Family $family, FamilyDeposit $deposit, FamilyBank $bank): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        abort_unless($deposit->member_id === $member->id, 403);

        $bank->closeDeposit($family, $deposit, $member);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Депозит закрито достроково — тіло повернено, відсотки не нараховано.']);

        return back();
    }

    public function manual(Request $request, Family $family, FamilyBank $bank): RedirectResponse
    {
        $member = $this->member($request, $family, 'treasury.manage', write: true);
        $data = $request->validate([
            'target' => ['required', Rule::in(['member', 'treasury'])],
            'member_id' => ['nullable', 'required_if:target,member', 'integer'],
            'direction' => ['required', Rule::in(['credit', 'debit'])],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:100000000'],
            'comment' => ['required', 'string', 'min:3', 'max:300'],
        ], ['comment.required' => 'Коментар обов’язковий — він потрапить у журнал аудиту.']);

        $amount = $this->money($data['amount']) * ($data['direction'] === 'debit' ? -1 : 1);

        if ($data['target'] === 'treasury') {
            $bank->treasury($family, $member, $amount, $data['comment']);
        } else {
            $target = FamilyMember::query()->where('family_id', $family->id)->where('status', FamilyMember::STATUS_ACTIVE)->findOrFail($request->integer('member_id'));
            $bank->manual($family, $member, $target, $amount, $data['comment']);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Операцію проведено й записано в журнал.']);

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    public static function transaction(FamilyTransaction $t, ?Family $family = null): array
    {
        return [
            'id' => $t->id,
            'type' => $t->type,
            'type_label' => FamilyTransaction::TYPES[$t->type] ?? $t->type,
            'amount' => $t->amount,
            'balance_after' => $t->balance_after,
            'treasury_delta' => $t->treasury_delta,
            'treasury_after' => $t->treasury_after,
            'comment' => $t->comment,
            'member' => $family && $t->relationLoaded('member') ? $t->member?->displayName() : null,
            'actor' => $family && $t->relationLoaded('actor') ? $t->actor?->displayName() : null,
            'created_at' => $t->created_at->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function cashout(FamilyCashout $c): array
    {
        return [
            'id' => $c->id,
            'amount' => $c->amount,
            'status' => $c->status,
            'note' => $c->note,
            'member' => ['id' => $c->member->id, 'display' => $c->member->displayName(), 'balance' => $c->member->balance],
            'process_comment' => $c->process_comment,
            'processed_at' => $c->processed_at?->toIso8601String(),
            'has_proof' => $c->proof_path !== null,
            'created_at' => $c->created_at->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function deposit(FamilyDeposit $d): array
    {
        return [
            'id' => $d->id,
            'amount' => $d->amount,
            'payout' => $d->payout,
            'period' => $d->period,
            'periods' => $d->periods,
            'rate' => $d->rate_bp / 100,
            'status' => $d->status,
            'accrued' => $d->accrued(),
            'paid' => $d->paid,
            'matures_at' => $d->matures_at->toIso8601String(),
            'created_at' => $d->created_at->toIso8601String(),
        ];
    }
}
