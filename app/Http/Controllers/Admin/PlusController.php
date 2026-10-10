<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Family;
use App\Models\PlusCode;
use App\Models\PlusGrant;
use App\Models\PlusPayment;
use App\Models\PlusRenewal;
use App\Models\User;
use App\Services\Plus\Plus;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Адмінка GameCon+: хто з GameCon+, оплати, ручна видача й промокоди. Рахунки — Admin\BillingController. */
class PlusController extends Controller
{
    public function __construct(private readonly Plus $plus) {}

    public function index(Request $request): Response
    {
        $this->admin($request);
        $grants = PlusGrant::query()->with('by')->where('ends_at', '>', now())->latest('id')->limit(100)->get();
        $users = User::query()->whereIn('id', $grants->where('owner_type', 'user')->pluck('owner_id'))->get()->keyBy('id');
        $families = Family::query()->whereIn('id', $grants->where('owner_type', 'family')->pluck('owner_id'))->get()->keyBy('id');

        return Inertia::render('admin/plus', [
            'stats' => [
                'users' => User::query()->where('plus_until', '>', now())->count(),
                'families' => Family::query()->where('plus_until', '>', now())->count(),
                'renewals' => PlusRenewal::query()->where('active', true)->count(),
                'payments_month' => PlusPayment::query()->where('status', PlusPayment::PAID)->where('created_at', '>=', now()->startOfMonth())->count(),
            ],
            'grants' => $grants->map(fn (PlusGrant $g) => [
                'id' => $g->id,
                'source' => $g->source,
                'note' => $g->note,
                'starts_at' => $g->starts_at->toIso8601String(),
                'ends_at' => $g->ends_at->toIso8601String(),
                'by' => $g->by?->name,
                'owner' => $g->owner_type === 'family'
                    ? (($f = $families->get($g->owner_id)) ? ['kind' => 'family', 'name' => '['.$f->tag.'] '.$f->name, 'href' => '/f/'.$f->slug] : null)
                    : (($u = $users->get($g->owner_id)) ? ['kind' => 'user', 'name' => $u->name, 'href' => '/'.$u->username] : null),
            ])->values(),
            'payments' => PlusPayment::query()->with('user')->latest('id')->limit(50)->get()->map(fn (PlusPayment $p) => [
                'id' => $p->id,
                'product' => $p->product,
                'amount' => $p->amount,
                'currency' => $p->currency,
                'status' => $p->status,
                'user' => $p->user?->only(['name', 'username']),
                'created_at' => $p->created_at->toIso8601String(),
            ]),
            'codes' => PlusCode::query()->latest('id')->limit(100)->get()->map(fn (PlusCode $c) => [
                'id' => $c->id,
                'code' => $c->code,
                'days' => $c->days,
                'uses' => $c->uses,
                'max_uses' => $c->max_uses,
                'expires_at' => $c->expires_at?->toIso8601String(),
                'usable' => $c->usable(),
            ]),
        ]);
    }

    public function grant(Request $request): RedirectResponse
    {
        $this->admin($request);
        $data = $request->validate([
            'username' => ['required', 'string', 'max:64'],
            'days' => ['required', 'integer', 'min:1', 'max:3650'],
            'note' => ['nullable', 'string', 'max:160'],
        ]);
        $user = User::query()->where('username', ltrim($data['username'], '@'))->first();
        abort_if($user === null, 422, 'Людину з таким ніком не знайдено.');
        $this->plus->grant($user, (int) $data['days'], 'admin', $request->user(), $data['note'] ?? null);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'GameCon+ видано.']);

        return back();
    }

    public function revoke(Request $request, PlusGrant $grant): RedirectResponse
    {
        $this->admin($request);
        abort_if($grant->source === 'subscription', 422, 'Підписку Google Play скасовують у Google Play — статус оновиться сам.');
        $this->plus->revoke($grant);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Період GameCon+ знято.']);

        return back();
    }

    public function storeCode(Request $request): RedirectResponse
    {
        $this->admin($request);
        $request->merge(['code' => Str::upper(trim((string) $request->input('code')))]);
        $data = $request->validate([
            'code' => ['nullable', 'string', 'min:4', 'max:32', 'regex:/^[A-Z0-9\-]+$/', Rule::unique('plus_codes', 'code')],
            'days' => ['required', 'integer', 'min:1', 'max:3650'],
            'max_uses' => ['required', 'integer', 'min:1', 'max:100000'],
            'expires_at' => ['nullable', 'date', 'after:now'],
        ], ['code.regex' => 'Код — латинські літери, цифри й дефіс.']);

        PlusCode::query()->create([
            'code' => $data['code'] ?: 'GC-'.Str::upper(Str::random(8)),
            'days' => $data['days'],
            'max_uses' => $data['max_uses'],
            'expires_at' => $data['expires_at'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Промокод створено.']);

        return back();
    }

    public function destroyCode(Request $request, PlusCode $code): RedirectResponse
    {
        $this->admin($request);
        $code->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Промокод видалено.']);

        return back();
    }

    private function admin(Request $request): void
    {
        abort_unless($request->user()->isAdmin(), 403);
    }
}
