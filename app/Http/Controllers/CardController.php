<?php

namespace App\Http\Controllers;

use App\Services\Cards\CardCollection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Колекційні картки ігор: альбом, щоденний набір, уламки, створення, вітрина профілю. */
class CardController extends Controller
{
    public function __construct(private readonly CardCollection $cards) {}

    public function index(Request $request): Response
    {
        return Inertia::render('cards/index', [
            ...$this->cards->album($request->user()),
            'opened' => $request->session()->get('opened_pack'),
        ]);
    }

    public function open(Request $request): RedirectResponse
    {
        $drawn = $this->cards->openPack($request->user());

        return back()->with('opened_pack', $drawn);
    }

    public function dust(Request $request): RedirectResponse
    {
        $gain = $this->cards->dustDuplicates($request->user());

        return back()->with('success', $gain > 0 ? "Отримано уламків: {$gain}." : 'Дублікатів немає.');
    }

    public function craft(Request $request, int $game): RedirectResponse
    {
        $this->cards->craft($request->user(), $game);

        return back()->with('success', 'Картку створено.');
    }

    public function showcase(Request $request, int $game): RedirectResponse
    {
        $this->cards->toggleShowcase($request->user(), $game);

        return back();
    }
}
