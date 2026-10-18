<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PhoneNumber;
use App\Models\PhoneNumberRule;
use App\Services\Billing\Catalog;
use App\Services\Phones\PhoneNumbers;
use App\Services\Phones\PhoneTiers;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Адмінка → Номери: коди мереж, шанси випадкового номера, знижка GameCon+, частота безкоштовної зміни;
 * правки рівня й резерв конкретних номерів; пошук власників і вилучення номера. Ціни — Адмінка → Білінг.
 */
class PhoneNumbersController extends Controller
{
    public function __construct(private readonly PhoneNumbers $phones) {}

    public function index(Request $request, Catalog $catalog): Response
    {
        $search = trim((string) $request->query('q', ''));
        $digits = preg_replace('/\D/', '', $search) ?? '';
        $numbers = PhoneNumber::query()->with('user')->where('status', PhoneNumber::ACTIVE)
            ->when($search !== '', fn ($q) => $q->where(fn ($q) => $q
                ->when(strlen($digits) >= 3, fn ($q) => $q->where('digits', 'like', '%'.substr($digits, -7).'%')
                    ->when(strlen($digits) >= 9, fn ($q) => $q->where('operator', substr($digits, -9, 2))))
                ->orWhereHas('user', fn ($u) => $u->where('username', 'like', '%'.ltrim($search, '@').'%')->orWhere('name', 'like', '%'.$search.'%'))))
            ->orderByDesc('id')->limit(50)->get()
            ->map(fn (PhoneNumber $n) => [
                'id' => $n->id,
                ...$n->toCard(),
                'user' => ['id' => $n->user->id, 'name' => $n->user->name, 'username' => $n->user->username],
                'created_at' => $n->created_at->toIso8601String(),
            ]);

        return Inertia::render('admin/phones', [
            'config' => $this->phones->config(),
            'tiers' => PhoneTiers::ALL,
            'prices' => collect(PhoneTiers::ALL)->mapWithKeys(fn (string $t) => [$t => intdiv($catalog->price(PhoneNumbers::product($t)), 100)]),
            'stats' => [
                'total' => PhoneNumber::query()->where('status', PhoneNumber::ACTIVE)->count(),
                'purchased' => PhoneNumber::query()->where('status', PhoneNumber::ACTIVE)->where('kind', PhoneNumber::PURCHASED)->count(),
                'by_tier' => PhoneNumber::query()->where('status', PhoneNumber::ACTIVE)->selectRaw('tier, count(*) as total')->groupBy('tier')->pluck('total', 'tier'),
            ],
            'rules' => PhoneNumberRule::query()->orderByDesc('id')->get()->map(fn (PhoneNumberRule $r) => [
                'id' => $r->id,
                'number' => $r->formatted(),
                'tier' => $r->tier,
                'auto_tier' => PhoneTiers::detect($r->operator, $r->digits),
                'reserved' => $r->reserved,
                'note' => $r->note,
            ]),
            'numbers' => $numbers,
            'search' => $search,
        ]);
    }

    public function update(Request $request, SiteSettings $settings): RedirectResponse
    {
        $rule = ['required', 'numeric', 'min:0', 'max:100'];
        $data = $request->validate([
            'premium_code' => ['required', 'string', 'regex:/^\d{1,4}$/'],
            'random_code' => ['required', 'string', 'regex:/^\d{1,4}$/', 'different:premium_code'],
            'plus_discount' => ['required', 'integer', 'min:0', 'max:100'],
            'random_cooldown_days' => ['required', 'integer', 'min:0', 'max:365'],
            'chances' => ['required', 'array'],
            'chances.bronze' => $rule,
            'chances.silver' => $rule,
            'chances.gold' => $rule,
            'chances.platinum' => $rule,
            'chances.diamond' => $rule,
        ]);
        $chances = array_map('floatval', array_intersect_key($data['chances'], PhoneNumbers::DEFAULTS['chances']));
        if (array_sum($chances) > 100) {
            throw ValidationException::withMessages(['chances' => 'Сума шансів не може перевищувати 100%.']);
        }
        $settings->put([PhoneNumbers::SETTING => [...$data, 'chances' => $chances]]);
        Log::info('phones: settings updated', ['by' => $request->user()->id, 'codes' => [$data['premium_code'], $data['random_code']]]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування номерів збережено.']);

        return back();
    }

    /** Правка рівня або резерв номера (оператор + 7 цифр — діє в обох мережах). */
    public function storeRule(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'number' => ['required', 'string', 'max:40'],
            'tier' => ['nullable', 'string', 'in:'.implode(',', PhoneTiers::ALL)],
            'reserved' => ['boolean'],
            'note' => ['nullable', 'string', 'max:120'],
        ]);
        $digits = preg_replace('/\D/', '', $data['number']) ?? '';
        if (strlen($digits) < 9) {
            throw ValidationException::withMessages(['number' => 'Вкажіть код оператора й 7 цифр, напр. 05 123-45-67.']);
        }
        $operator = substr($digits, -9, 2);
        $local = substr($digits, -7);
        if (preg_match('/^(0[1-9]|[1-9]\d)$/', $operator) !== 1) {
            throw ValidationException::withMessages(['number' => 'Код оператора — від 01 до 99.']);
        }
        PhoneNumberRule::query()->updateOrCreate(
            ['operator' => $operator, 'digits' => $local],
            ['tier' => $data['tier'] ?? null, 'reserved' => $request->boolean('reserved'), 'note' => $data['note'] ?? null],
        );
        // Номер уже в когось — рівень оновлюється одразу.
        if (($data['tier'] ?? null) !== null) {
            PhoneNumber::query()->where(['operator' => $operator, 'digits' => $local])->update(['tier' => $data['tier']]);
        }
        Log::info('phones: rule saved', ['by' => $request->user()->id, 'number' => $operator.$local, 'tier' => $data['tier'] ?? null, 'reserved' => $request->boolean('reserved')]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Правку номера збережено.']);

        return back();
    }

    public function destroyRule(Request $request, PhoneNumberRule $rule): RedirectResponse
    {
        $rule->delete();
        PhoneNumber::query()->where(['operator' => $rule->operator, 'digits' => $rule->digits])
            ->update(['tier' => PhoneTiers::detect($rule->operator, $rule->digits)]);
        Log::info('phones: rule removed', ['by' => $request->user()->id, 'number' => $rule->operator.$rule->digits]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Правку прибрано.']);

        return back();
    }

    /** Вилучити номер у людини (порушення) — номер звільняється. */
    public function destroyNumber(Request $request, PhoneNumber $number): RedirectResponse
    {
        $number->delete();
        Log::info('phones: number taken away', ['by' => $request->user()->id, 'number' => $number->formatted(), 'user' => $number->user_id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Номер '.$number->formatted().' вилучено.']);

        return back();
    }
}
