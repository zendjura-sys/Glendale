<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlusPayment;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Звіт про доходи за 12 місяців: GameCon+ і покупки (платежі), комісія з підписок на авторів,
 * просування спільнот. Суми в копійках; повернені платежі не рахуються.
 */
class RevenueController extends Controller
{
    public function __invoke(): Response
    {
        $from = now()->startOfMonth()->subMonths(11);
        $keys = [];
        for ($i = 0; $i < 12; $i++) {
            $keys[] = $from->copy()->addMonths($i)->format('Y-m');
        }
        $zero = array_fill_keys($keys, 0);
        [$payments, $fees, $promo] = [$zero, $zero, $zero];

        foreach (PlusPayment::query()->where('status', 'paid')->where('created_at', '>=', $from)->get(['amount', 'created_at']) as $p) {
            $key = $p->created_at->format('Y-m');
            if (isset($payments[$key])) {
                $payments[$key] += (int) $p->amount;
            }
        }
        $wallet = DB::table('wallet_transactions')->whereIn('type', ['author_sub', 'author_income', 'promo'])->where('created_at', '>=', $from)->get(['type', 'amount', 'created_at']);
        foreach ($wallet as $t) {
            $key = Carbon::parse($t->created_at)->format('Y-m');
            if (! isset($fees[$key])) {
                continue;
            }
            // Комісія = сплачене підписниками мінус отримане авторами.
            match ($t->type) {
                'author_sub' => $fees[$key] -= (int) $t->amount,
                'author_income' => $fees[$key] -= (int) $t->amount,
                default => $promo[$key] -= (int) $t->amount,
            };
        }
        $rows = array_map(fn (string $key) => [
            'month' => $key,
            'payments' => $payments[$key],
            'author_fee' => $fees[$key],
            'promo' => $promo[$key],
            'total' => $payments[$key] + $fees[$key] + $promo[$key],
        ], $keys);

        $products = DB::table('plus_payments')->where('status', 'paid')->where('created_at', '>=', $from)
            ->selectRaw('product, COUNT(*) as count, SUM(amount) as sum')->groupBy('product')->orderByDesc('sum')->limit(10)->get()
            ->map(fn ($p) => ['product' => (string) $p->product, 'count' => (int) $p->count, 'sum' => (int) $p->sum])->values()->all();
        $authors = DB::table('wallet_transactions as w')->join('users as u', 'u.id', '=', 'w.user_id')
            ->where('w.type', 'author_income')->where('w.created_at', '>=', $from)
            ->selectRaw('u.id, u.name, u.username, SUM(w.amount) as sum')->groupBy('u.id', 'u.name', 'u.username')->orderByDesc('sum')->limit(10)->get()
            ->map(fn ($a) => ['id' => (int) $a->id, 'name' => $a->name, 'username' => $a->username, 'sum' => (int) $a->sum])->values()->all();

        return Inertia::render('admin/revenue', [
            'months' => $rows,
            'totals' => [
                'year' => array_sum(array_column($rows, 'total')),
                'month' => $rows[11]['total'],
                'previous' => $rows[10]['total'],
                'refunded' => (int) PlusPayment::query()->where('status', 'refunded')->where('created_at', '>=', $from)->sum('amount'),
            ],
            'products' => $products,
            'authors' => $authors,
        ]);
    }
}
