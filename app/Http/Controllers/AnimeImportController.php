<?php

namespace App\Http\Controllers;

use App\Models\MovieRequest;
use App\Services\Cinema\AnimeListImport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Імпорт списків аніме з Shikimori (за ніком) і MyAnimeList (файл експорту). */
class AnimeImportController extends Controller
{
    public function __construct(private readonly AnimeListImport $import) {}

    public function show(Request $request): Response
    {
        return Inertia::render('cinema/import', [
            'preview' => $request->session()->get('anime_preview'),
            'source' => $request->session()->get('anime_source'),
        ]);
    }

    public function preview(Request $request): RedirectResponse|JsonResponse
    {
        $data = $request->validate([
            'source' => ['required', 'in:shikimori,mal,anixart'],
            'nickname' => ['required_if:source,shikimori', 'nullable', 'string', 'max:60'],
            'file' => ['required_if:source,mal,anixart', 'nullable', 'file', 'max:20480'],
        ]);
        $rows = match ($data['source']) {
            'shikimori' => $this->import->fromShikimori((string) $data['nickname']),
            'anixart' => $this->import->fromAnixartCsv((string) file_get_contents($request->file('file')->getRealPath())),
            default => $this->import->fromMalXml((string) file_get_contents($request->file('file')->getRealPath())),
        };
        $preview = $this->import->preview($request->user(), $rows);
        $this->import->remember($request->user(), $preview);
        // Застосунок (міст /api/v1/site) не має сесії — йому передперегляд одразу у відповіді.
        if ($request->is('api/*')) {
            return response()->json(['preview' => $preview, 'source' => $data['source']]);
        }

        return redirect()->route('cinema.import')->with('anime_preview', $preview)->with('anime_source', $data['source']);
    }

    /** Попросити додати тайтли, яких немає в каталозі (запити на додавання). */
    public function requestMissing(Request $request): RedirectResponse
    {
        $data = $request->validate(['titles' => ['required', 'array', 'max:40'], 'titles.*' => ['string', 'max:200']]);
        foreach ($data['titles'] as $title) {
            MovieRequest::query()->firstOrCreate(['user_id' => $request->user()->id, 'title' => $title]);
        }

        return back()->with('success', 'Запити надіслано — тайтли з’являться після перевірки.');
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['movies' => ['required', 'array', 'max:5000'], 'movies.*' => ['integer']]);
        $added = $this->import->import($request->user(), $data['movies']);

        return redirect('/cinema')->with('success', "Додано в списки: {$added}.");
    }
}
