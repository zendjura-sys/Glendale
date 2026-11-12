<?php

namespace App\Http\Controllers;

use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\PlusGift;
use App\Models\PlusPayment;
use App\Models\StaffRole;
use App\Models\User;
use App\Services\Billing\Shop;
use App\Services\FriendshipService;
use App\Services\Moderation\ContentFilter;
use App\Services\Plus\Plus;
use App\Services\Plus\PlusTrial;
use App\Services\Plus\PromoCodes;
use App\Support\PlusStyle;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
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
            // Власна роль-підпис: текст, колір і коли можна змінити знову.
            'title' => [
                'name' => $user->plus_title,
                'color' => $user->plus_title_color ?? 'sky',
                'next_change' => $user->plus_title !== null && $user->plus_title_at?->gt(now()->subWeek()) ? $user->plus_title_at->copy()->addWeek()->toIso8601String() : null,
                'colors' => StaffRole::COLORS,
            ],
            'options' => PlusStyle::options(),
            'products' => Shop::catalog(),
            // Пробний період (лише на сайті: у застосунку — тільки Google Play).
            'trial' => ['days' => app(PlusTrial::class)->days(), 'available' => app(PlusTrial::class)->eligible($user), 'used' => $user->plus_trial_at !== null],
            'families' => self::ledFamilies($user)->map(fn (Family $f) => [
                ...$f->toCard(),
                'state' => $this->plus->state($f),
                'style' => $f->plus_style ?? (object) [],
            ])->values(),
            // Друзі для вибору в «Подарувати»; надіслані подарунки зі статусом.
            'friends' => app(FriendshipService::class)->friendsQuery($user)->orderBy('name')->limit(200)->get()
                ->map(fn (User $f) => ['username' => $f->username, 'name' => $f->name, 'avatar_url' => $f->toCard()['avatar_url'] ?? null])->values(),
            'sent_gifts' => PlusGift::query()->with('recipient')->where('payer_id', $user->id)->where('status', '!=', 'draft')
                ->latest('id')->limit(10)->get()->map(fn (PlusGift $g) => $g->toCard())->values(),
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
        ]);
    }

    /** Увімкнути пробний період GameCon+ (один раз на акаунт). */
    public function trial(Request $request, PlusTrial $trial): RedirectResponse
    {
        $grant = $trial->start($request->user());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'GameCon+ увімкнено до '.$grant->ends_at->format('d.m.Y').'. Оберіть рамку, колір ніку й тему нижче.']);

        return back();
    }

    /** Листівка подарунка: бачать отримувач і дарувальник (отримувач — лише після вручення). */
    public function gift(Request $request, PlusGift $gift): Response
    {
        $user = $request->user();
        $isRecipient = $gift->recipient_id === $user->id;
        abort_unless(($isRecipient && $gift->status === 'delivered') || $gift->payer_id === $user->id, 404);
        if ($isRecipient && $gift->seen_at === null) {
            $gift->update(['seen_at' => now()]);
        }
        $gift->load('payer', 'recipient');

        return Inertia::render('plus/gift', [
            'gift' => $gift->toCard(),
            'mine' => $isRecipient,
            'plus_until' => $isRecipient ? $user->fresh()?->plus_until?->toIso8601String() : null,
        ]);
    }

    /** Активувати промокод: дні GameCon+, знижку на підписку чи перший платіж, безкоштовний період. */
    public function redeem(Request $request, PromoCodes $codes): RedirectResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:32'], 'product' => ['nullable', 'string', 'max:40']]);
        $result = $codes->redeem($request->user(), $data['code'], $data['product'] ?? null);

        Inertia::flash('toast', ['type' => 'success', 'message' => $result['message']]);

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
            'motion' => ['nullable', 'string', 'max:16'],
            'theme' => ['nullable', 'string', 'max:16'],
        ]);
        $user->forceFill(['plus_style' => PlusStyle::clean($data) ?: null])->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Оформлення збережено.']);

        return back();
    }

    /** Слова, яких не може бути у власній ролі: щоб підпис не видавав себе за команду сайту. */
    private const TITLE_RESERVED = ['адмін', 'admin', 'модер', 'moder', 'gamecon', 'геймкон', 'підтримк', 'support', 'staff', 'персонал', 'розробник', 'developer', 'офіційн', 'official'];

    /**
     * Власна роль-підпис біля ніка для підписника GameCon+: текст до 24 символів і колір.
     * Змінити можна раз на тиждень; прибрати — будь-коли.
     */
    public function title(Request $request): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user->isPlus(), 403, 'Власна роль доступна з GameCon+.');
        $data = $request->validate([
            'name' => ['nullable', 'string', 'min:2', 'max:24', 'regex:/^[\pL\pN][\pL\pN \-_.!?♥★]*$/u'],
            'color' => ['nullable', Rule::in(StaffRole::COLORS)],
        ], ['name.regex' => 'Лише літери, цифри, пробіл і прості знаки.']);
        $name = trim((string) ($data['name'] ?? ''));

        if ($name === '') {
            $user->forceFill(['plus_title' => null, 'plus_title_color' => null])->save();
            Inertia::flash('toast', ['type' => 'success', 'message' => 'Власну роль прибрано.']);

            return back();
        }
        $lower = Str::lower($name);
        foreach (self::TITLE_RESERVED as $word) {
            if (str_contains($lower, $word)) {
                throw ValidationException::withMessages(['name' => 'Така роль схожа на роль команди GameCon — оберіть іншу.']);
            }
        }
        $changed = $name !== $user->plus_title;
        // Текст змінюється раз на тиждень (колір — будь-коли).
        if ($changed && $user->plus_title !== null && $user->plus_title_at !== null && $user->plus_title_at->gt(now()->subWeek())) {
            throw ValidationException::withMessages(['name' => 'Роль можна змінити раз на тиждень — наступна зміна '.$user->plus_title_at->copy()->addWeek()->format('d.m о H:i').'.']);
        }
        $clean = (string) app(ContentFilter::class)->clean($name);
        $user->forceFill([
            'plus_title' => $clean,
            'plus_title_color' => $data['color'] ?? 'sky',
            'plus_title_at' => $changed ? now() : $user->plus_title_at,
        ])->save();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Власну роль збережено.']);

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
