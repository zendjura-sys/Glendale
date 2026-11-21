<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Quality\LinkChecker;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Адмінка → Биті посилання: звіт нічної перевірки; «Ігнорувати» й «Перевірити» пишуться в журнал. */
class LinkCheckController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'source' => ['nullable', Rule::in(array_keys(LinkChecker::SOURCES))],
            'tab' => ['nullable', Rule::in(['broken', 'ignored'])],
        ]);
        $tab = $filters['tab'] ?? 'broken';

        $items = DB::table('link_checks')
            ->when($tab === 'broken', fn ($q) => $q->where('ignored', false)->where('fails', '>=', LinkChecker::BROKEN_AFTER))
            ->when($tab === 'ignored', fn ($q) => $q->where('ignored', true))
            ->when($filters['source'] ?? null, fn ($q, string $s) => $q->where('source', $s))
            ->orderBy('failing_since')->orderByDesc('id')
            ->paginate(30)->withQueryString()
            ->through(fn (object $r) => [
                'id' => $r->id,
                'source' => $r->source,
                'field' => $r->field,
                'kind' => $r->kind,
                'url' => $r->url,
                'label' => $r->label,
                'status' => $r->status,
                'error' => $r->error,
                'fails' => $r->fails,
                'failing_since' => $r->failing_since,
                'checked_at' => $r->checked_at,
                'edit_url' => LinkChecker::editUrl($r->source, $r->label),
            ]);

        $base = DB::table('link_checks');

        return Inertia::render('admin/links', [
            'items' => $items,
            'filters' => ['source' => $filters['source'] ?? null, 'tab' => $tab],
            'sources' => LinkChecker::SOURCES,
            'stats' => [
                'total' => (clone $base)->count(),
                'checked' => (clone $base)->whereNotNull('checked_at')->count(),
                'broken' => (clone $base)->where('ignored', false)->where('fails', '>=', LinkChecker::BROKEN_AFTER)->count(),
                'last_run' => (clone $base)->max('checked_at'),
            ],
        ]);
    }

    public function ignore(Request $request, int $check): RedirectResponse
    {
        $on = $request->boolean('on', true);
        DB::table('link_checks')->where('id', $check)->update(['ignored' => $on, 'updated_at' => now()]);
        Log::info('admin.link_check.ignore', ['by' => $request->user()->id, 'check' => $check, 'ignored' => $on]);

        return back()->with('success', $on ? 'Адресу більше не показуємо.' : 'Адресу знову перевіряємо.');
    }

    public function recheck(Request $request, int $check, LinkChecker $checker): RedirectResponse
    {
        $checker->recheck($check);
        Log::info('admin.link_check.recheck', ['by' => $request->user()->id, 'check' => $check]);

        return back()->with('success', 'Перевірено.');
    }
}
