<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Models\FamilyWikiPage;
use App\Services\Families\FamilyAudit;
use App\Services\Families\FamilyCharter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Статут сім’ї (+ тест за ним перед вступом) і вікі для учасників.
 * Статут бачать усі — щоб кандидат прочитав його до заявки; вікі — лише учасники.
 */
class FamilyCharterController extends FamilyBaseController
{
    /** Публічний статут і питання тесту (без правильних відповідей). */
    public function show(Request $request, Family $family, FamilyCharter $charter): Response|JsonResponse
    {
        $member = $request->user() ? $this->gate->member($family, $request->user()) : null;
        $data = [
            'text' => $charter->text($family),
            'quiz' => $charter->publicQuiz($family),
            'pass' => $charter->passPercent($family),
        ];
        // Завжди Inertia::render / page() — міст сайту для застосунку знімає props з X-Inertia.
        // Не можна віддавати «голий» JSON через wantsJson: без family/me вкладка ламається.
        if ($member !== null) {
            $can = $this->gate->abilities($member, $family);

            return $this->page($family, $member, 'families/charter', 'charter', [
                ...$data,
                'edit' => ($can['settings.manage'] ?? false) ? [
                    'text' => $charter->text($family) ?? '',
                    'quiz' => $charter->quiz($family),
                    'pass' => $charter->passPercent($family),
                ] : null,
            ]);
        }

        return Inertia::render('families/charter-public', ['family' => $family->toCard(), ...$data]);
    }

    public function update(Request $request, Family $family, FamilyCharter $charter, FamilyAudit $audit): RedirectResponse
    {
        $member = $this->member($request, $family, 'settings.manage', write: true);
        $data = $request->validate([
            'text' => ['nullable', 'string', 'max:'.FamilyCharter::MAX_TEXT],
            'quiz' => ['present', 'array', 'max:'.FamilyCharter::MAX_QUESTIONS],
            'quiz.*.q' => ['required', 'string', 'max:200'],
            'quiz.*.options' => ['required', 'array', 'min:2', 'max:4'],
            'quiz.*.options.*' => ['required', 'string', 'max:120'],
            'quiz.*.correct' => ['required', 'integer', 'min:0', 'max:3'],
            'pass' => ['required', 'integer', 'min:50', 'max:100'],
        ], ['quiz.*.options.*.required' => 'Заповніть усі варіанти відповіді.']);
        $charter->save($family, $data['text'] ?? null, $data['quiz'], (int) $data['pass']);
        $audit->log($family, 'CHARTER_UPDATE', $member, null, ['questions' => count($data['quiz'])]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Статут збережено.']);

        return back();
    }

    /** Вікі: список сторінок і відкрита сторінка. */
    public function wiki(Request $request, Family $family, ?string $slug = null): Response|JsonResponse
    {
        $member = $this->member($request, $family);
        $can = $this->gate->abilities($member, $family);
        // Застосунок відкриває сторінку через ?page=slug.
        $slug ??= $request->filled('page') ? (string) $request->query('page') : null;
        $pages = FamilyWikiPage::query()->with('editor')->where('family_id', $family->id)->orderBy('position')->orderBy('title')->get();
        $page = $slug !== null ? $pages->firstWhere('slug', $slug) : $pages->first();
        abort_if($slug !== null && $page === null, 404);
        $data = [
            'pages' => $pages->map(fn (FamilyWikiPage $p) => ['slug' => $p->slug, 'title' => $p->title])->values(),
            'page' => $page ? [
                'slug' => $page->slug,
                'title' => $page->title,
                'body' => $page->body,
                'updated_at' => $page->updated_at?->toIso8601String(),
                'editor' => $page->editor?->toCard(),
            ] : null,
            'can_edit' => (bool) ($can['settings.manage'] ?? false) || (bool) ($can['members.manage'] ?? false),
        ];

        return $this->page($family, $member, 'families/wiki', 'wiki', $data);
    }

    public function saveWiki(Request $request, Family $family, FamilyAudit $audit): RedirectResponse|JsonResponse
    {
        $member = $this->member($request, $family, write: true);
        $can = $this->gate->abilities($member, $family);
        abort_unless(($can['settings.manage'] ?? false) || ($can['members.manage'] ?? false), 403);
        $data = $request->validate([
            'slug' => ['nullable', 'string', 'max:80'],
            'title' => ['required', 'string', 'max:120'],
            'body' => ['nullable', 'string', 'max:50000'],
        ]);
        $page = ($data['slug'] ?? null) ? FamilyWikiPage::query()->where('family_id', $family->id)->where('slug', $data['slug'])->first() : null;
        if ($page === null) {
            abort_if(FamilyWikiPage::query()->where('family_id', $family->id)->count() >= 100, 422, 'У вікі вже 100 сторінок.');
            $base = Str::slug($data['title']) ?: 'page';
            $slug = $base;
            for ($i = 2; FamilyWikiPage::query()->where('family_id', $family->id)->where('slug', $slug)->exists(); $i++) {
                $slug = $base.'-'.$i;
            }
            $page = new FamilyWikiPage(['family_id' => $family->id, 'slug' => $slug, 'position' => FamilyWikiPage::query()->where('family_id', $family->id)->max('position') + 1]);
        }
        $page->fill(['title' => $data['title'], 'body' => $data['body'] ?? null, 'updated_by' => $request->user()->id])->save();
        $audit->log($family, 'WIKI_UPDATE', $member, null, ['page' => $page->title]);

        if ($request->wantsJson()) {
            return response()->json(['slug' => $page->slug]);
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Сторінку збережено.']);

        return to_route('families.wiki.page', [$family, $page->slug]);
    }

    public function deleteWiki(Request $request, Family $family, string $slug, FamilyAudit $audit): RedirectResponse|JsonResponse
    {
        $member = $this->member($request, $family, 'settings.manage', write: true);
        $page = FamilyWikiPage::query()->where('family_id', $family->id)->where('slug', $slug)->firstOrFail();
        $page->delete();
        $audit->log($family, 'WIKI_DELETE', $member, null, ['page' => $page->title]);

        if ($request->wantsJson()) {
            return response()->json(['ok' => true]);
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Сторінку видалено.']);

        return to_route('families.wiki', $family);
    }
}
