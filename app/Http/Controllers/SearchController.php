<?php

namespace App\Http\Controllers;

use App\Services\Search\SiteSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Глобальний пошук (№233): одним запитом по всіх розділах сайту, що є в режимі людини
 * (люди, записи, спільноти, ігри, кіно, музика, сервери, клани, сім’ї, статті, гайди, турніри,
 * подкасти). Вкладка звужує до одного розділу й показує більше. Сайт — сторінка, застосунок — JSON.
 */
class SearchController extends Controller
{
    /** Скільки показувати в розділі на вкладці «Усі» та на вкладці одного розділу. */
    private const PER_ALL = 4;

    private const PER_KIND = 30;

    public function index(Request $request, SiteSearch $search): Response|JsonResponse
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:80'],
            'type' => ['nullable', 'string', 'max:20'],
        ]);
        $q = trim((string) ($data['q'] ?? ''));
        $type = isset($data['type']) && $search->available($data['type']) ? $data['type'] : null;

        $all = ['q' => $q, 'fixed' => null, 'hits' => []];
        $hits = [];
        if (mb_strlen($q) >= 2) {
            $all = $search->search($q, $request->user(), self::PER_ALL);
            $hits = $type === null ? $all['hits'] : $search->hits($all['fixed'] ?? $q, $request->user(), self::PER_KIND, $type);
        }
        // Вкладки — розділи, де щось знайшлося (порядок — як у SiteSearch::KINDS).
        $found = array_unique(array_column($all['hits'], 'kind'));
        $kinds = array_values(array_filter(array_keys(SiteSearch::KINDS), fn (string $kind) => in_array($kind, $found, true)));

        $payload = [
            'q' => $q,
            'type' => $type,
            'fixed' => $all['fixed'],
            'kinds' => $kinds,
            'hits' => $hits,
        ];

        return $request->wantsJson() ? response()->json($payload) : Inertia::render('search/index', $payload);
    }
}
