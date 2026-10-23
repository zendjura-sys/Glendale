<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\PartyPost;
use App\Models\TeammateProfile;
use App\Models\User;
use App\Services\Party\Teammates;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Підбір тиммейтів: анкета, «Шукаю зараз», сумісні гравці й запрошення в паті. */
class TeammateController extends Controller
{
    public function __construct(private readonly Teammates $teammates) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $game = $request->filled('game') ? Game::query()->where('slug', (string) $request->query('game'))->first() : null;

        return Inertia::render('party/match', [
            'profile' => $this->teammates->form($user),
            'matches' => $this->teammates->matches($user, $game?->id),
            'game' => $game ? ['slug' => $game->slug, 'name' => $game->name] : null,
            'parties' => array_values(PartyPost::query()->open()->where('user_id', $user->id)->latest('id')->get(['id', 'title'])
                ->map(fn (PartyPost $p) => ['id' => $p->id, 'title' => $p->title])->all()),
            'options' => [
                'games' => array_values(Game::query()->where('is_published', true)->orderByDesc('popularity')->limit(80)->get(['slug', 'name'])
                    ->map(fn (Game $g) => ['slug' => $g->slug, 'name' => $g->name])->all()),
                'times' => array_keys(TeammateProfile::TIMES),
                'skills' => array_keys(TeammateProfile::SKILLS),
                'languages' => array_keys(TeammateProfile::LANGUAGES),
                'platforms' => array_keys(PartyPost::PLATFORMS),
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'games' => ['array', 'max:8'],
            'games.*' => ['string', 'max:120'],
            'languages' => ['array', 'max:4'],
            'languages.*' => [Rule::in(array_keys(TeammateProfile::LANGUAGES))],
            'times' => ['array', 'max:5'],
            'times.*' => [Rule::in(array_keys(TeammateProfile::TIMES))],
            'skill' => ['nullable', Rule::in(array_keys(TeammateProfile::SKILLS))],
            'platform' => ['nullable', Rule::in(array_keys(PartyPost::PLATFORMS))],
            'mic' => ['boolean'],
            'note' => ['nullable', 'string', 'max:140'],
            'visible' => ['boolean'],
        ]);
        $this->teammates->save($request->user(), $data);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Анкету збережено.']);

        return back();
    }

    public function looking(Request $request): RedirectResponse
    {
        $data = $request->validate(['on' => ['required', 'boolean']]);
        $this->teammates->looking($request->user(), (bool) $data['on']);

        return back();
    }

    public function invite(Request $request, PartyPost $party): RedirectResponse
    {
        $data = $request->validate(['user_id' => ['required', 'integer']]);
        $this->teammates->invite($party, $request->user(), User::query()->whereKey((int) $data['user_id'])->firstOrFail());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запрошення надіслано.']);

        return back();
    }
}
