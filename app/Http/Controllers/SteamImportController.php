<?php

namespace App\Http\Controllers;

use App\Services\Games\SteamImport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Імпорт бібліотеки Steam у беклог ігор. */
class SteamImportController extends Controller
{
    public function __construct(private readonly SteamImport $import) {}

    public function show(Request $request): Response
    {
        return Inertia::render('games/steam-import', $this->import->preview($request->user()));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['games' => ['required', 'array', 'max:2000'], 'games.*' => ['string']]);
        $added = $this->import->import($request->user(), $data['games']);

        return redirect('/games/backlog')->with('success', "Додано в беклог ігор: {$added}.");
    }
}
