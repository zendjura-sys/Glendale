<?php

namespace App\Http\Controllers;

use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\PlusPayment;
use App\Models\User;
use App\Services\Billing\Shop;
use App\Services\Plus\Plus;
use App\Support\PlusStyle;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/** GameCon+: сторінка тарифів, промокоди й оформлення. Оплата — з рахунку (BillingController). */
class PlusController extends Controller
{
    public function __construct(
        private readonly Plus $plus,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('plus/index', [
            'state' => $this->plus->state($user),
            'style' => $user->plus_style ?? (object) [],
            'options' => PlusStyle::options(),
            'products' => Shop::catalog(),
            'families' => self::ledFamilies($user)->map(fn (Family $f) => [
                ...$f->toCard(),
                'state' => $this->plus->state($f),
                'style' => $f->plus_style ?? (object) [],
            ])->values(),
            'payments' => PlusPayment::query()->where('user_id', $user->id)->latest('id')->limit(20)->get()
                ->map(fn (PlusPayment $p) => [
                    'id' => $p->id,
                    'product' => $p->product,
                    'amount' => $p->amount,
                    'currency' => $p->currency,
                    'status' => $p->status,
                    'receipt_url' => $p->receipt_url,
                    'created_at' => $p->created_at->toIso8601String(),
                ]),
            'balance' => (int) $user->balance,
        ]);
    }

    public function redeem(Request $request): RedirectResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:32']]);
        $grant = $this->plus->redeem($request->user(), $data['code']);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Промокод активовано: GameCon+ до '.$grant->ends_at->format('d.m.Y').'.']);

        return back();
    }

    public function style(Request $request): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user->isPlus(), 403, 'Оформлення доступне з GameCon+.');
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:16'],
            'frame' => ['nullable', 'string', 'max:16'],
            'accent' => ['nullable', 'string', 'max:16'],
            'fx' => ['nullable', 'string', 'max:16'],
            'header' => ['nullable', 'string', 'max:16'],
        ]);
        $user->forceFill(['plus_style' => PlusStyle::clean($data) ?: null])->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Оформлення збережено.']);

        return back();
    }

    public function familyStyle(Request $request, Family $family): RedirectResponse
    {
        abort_unless(self::ledFamilies($request->user())->contains('id', $family->id), 403);
        abort_unless($family->isPlus(), 403, 'Оформлення доступне з GameCon+ для сім’ї.');
        $data = $request->validate(['accent' => ['nullable', 'string', 'max:16']]);
        $family->forceFill(['plus_style' => PlusStyle::clean($data) ?: null])->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Оформлення сім’ї збережено.']);

        return back();
    }

    /**
     * @return Collection<int, Family>
     */
    public static function ledFamilies(User $user): Collection
    {
        $ids = FamilyMember::query()->where('user_id', $user->id)
            ->where('status', FamilyMember::STATUS_ACTIVE)
            ->where('rank', '>=', Family::LEADER_RANK)
            ->pluck('family_id');

        return Family::query()->with('server')
            ->where(fn ($q) => $q->whereIn('id', $ids)->orWhere('owner_id', $user->id))
            ->where('status', Family::STATUS_VERIFIED)
            ->get();
    }
}
