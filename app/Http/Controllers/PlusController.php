<?php

namespace App\Http\Controllers;

use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\GtaServer;
use App\Models\PlusPayment;
use App\Models\User;
use App\Services\Plus\Billing;
use App\Services\Plus\LemonSqueezy;
use App\Services\Plus\Plus;
use App\Services\Plus\ServerPromotions;
use App\Support\PlusStyle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/** GameCon+: тарифи, оплата через Lemon Squeezy, подарунки, промокоди й оформлення. */
class PlusController extends Controller
{
    public function __construct(
        private readonly Plus $plus,
        private readonly LemonSqueezy $lemon,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('plus/index', [
            'state' => $this->plus->state($user),
            'style' => $user->plus_style ?? (object) [],
            'options' => PlusStyle::options(),
            'products' => $this->products(),
            'families' => $this->ledFamilies($user)->map(fn (Family $f) => [
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
            'paid' => $request->boolean('paid'),
        ]);
    }

    /** Посилання на оплату. Відповідь JSON: фронтенд відкриває сторінку Lemon Squeezy. */
    public function checkout(Request $request, ServerPromotions $promotions): JsonResponse
    {
        $data = $request->validate([
            'product' => ['required', 'string', Rule::in(array_keys((array) config('plus.products')))],
            'username' => ['nullable', 'string', 'max:64'],
            'family_id' => ['nullable', 'integer'],
            'server_id' => ['nullable', 'integer'],
        ]);
        $user = $request->user();
        $product = (string) $data['product'];
        $kind = (string) config("plus.products.{$product}.kind");
        $custom = [];

        if ($kind === 'gift') {
            $to = User::query()->where('username', ltrim((string) ($data['username'] ?? ''), '@'))->first();
            abort_if($to === null, 422, 'Людину з таким ніком не знайдено.');
            $custom['to_user_id'] = (string) $to->id;
        }
        if ($kind === 'family') {
            $family = $this->ledFamilies($user)->firstWhere('id', (int) ($data['family_id'] ?? 0));
            abort_if($family === null, 403, 'Підключити GameCon+ для сім’ї може лише її лідер.');
            $custom['family_id'] = (string) $family->id;
        }
        if ($kind === 'promo') {
            $server = GtaServer::query()->published()->find((int) ($data['server_id'] ?? 0));
            abort_unless($server !== null && $server->owner_id === $user->id, 403, 'Просувати сервер може лише його власник.');
            $custom['server_id'] = (string) $server->id;
        }
        if ($kind === 'plus' && $this->plus->state($user)['subscription'] !== null) {
            $status = $this->plus->state($user)['subscription']['status'] ?? null;
            abort_if(in_array($status, ['active', 'on_trial', 'past_due'], true), 422, 'Підписка вже активна — керувати нею можна через «Керувати оплатою».');
        }

        $url = $this->lemon->checkout($product, $user, $custom, url('/plus?paid=1'));
        abort_if($url === null, 503, 'Оплата тимчасово недоступна. Спробуйте пізніше.');

        return response()->json([
            'url' => $url,
            'starts_at' => $kind === 'promo' ? $promotions->freeAt((string) config("plus.products.{$product}.promo"))->toIso8601String() : null,
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
        ]);
        $user->forceFill(['plus_style' => PlusStyle::clean($data) ?: null])->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Оформлення збережено.']);

        return back();
    }

    public function familyStyle(Request $request, Family $family): RedirectResponse
    {
        abort_unless($this->ledFamilies($request->user())->contains('id', $family->id), 403);
        abort_unless($family->isPlus(), 403, 'Оформлення доступне з GameCon+ для сім’ї.');
        $data = $request->validate(['accent' => ['nullable', 'string', 'max:16']]);
        $family->forceFill(['plus_style' => PlusStyle::clean($data) ?: null])->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Оформлення сім’ї збережено.']);

        return back();
    }

    /** Вебхук Lemon Squeezy: підпис перевіряється до будь-якої обробки. */
    public function webhook(Request $request, Billing $billing): HttpResponse
    {
        $body = $request->getContent();
        if (! $this->lemon->verify($body, $request->header('X-Signature'))) {
            return response('invalid signature', 401);
        }
        $payload = json_decode($body, true);
        if (is_array($payload)) {
            $billing->handle($payload);
        }

        return response()->noContent();
    }

    /**
     * Ціни для показу й чи можна вже купити.
     *
     * @return array<string, array{kind: string, price: int, days: int, recurring: bool, available: bool}>
     */
    private function products(): array
    {
        $out = [];
        foreach ((array) config('plus.products') as $key => $product) {
            $product = (array) $product;
            $out[(string) $key] = [
                'kind' => (string) $product['kind'],
                'price' => (int) $product['price'],
                'days' => (int) $product['days'],
                'recurring' => (bool) $product['recurring'],
                'available' => $this->lemon->available((string) $key),
            ];
        }

        return $out;
    }

    /**
     * @return Collection<int, Family>
     */
    private function ledFamilies(User $user): Collection
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
