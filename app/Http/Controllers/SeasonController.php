<?php

namespace App\Http\Controllers;

use App\Services\Quests\SeasonPass;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Сезонний пропуск: рівні, нагороди двох доріжок, інвентар косметики. */
class SeasonController extends Controller
{
    public function __construct(private readonly SeasonPass $pass) {}

    public function index(Request $request): Response
    {
        return Inertia::render('season/index', $this->pass->board($request->user()));
    }

    public function claim(Request $request, int $level, string $track): RedirectResponse
    {
        $result = $this->pass->claim($request->user(), $level, $track);
        Inertia::flash('toast', $result['fresh']
            ? ['type' => 'success', 'message' => "Отримано: {$result['reward']['name']}"]
            : ['type' => 'info', 'message' => 'Нагороду вже отримано.']);

        return back();
    }

    public function equip(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', 'string', Rule::in(SeasonPass::EQUIPPABLE)],
            'value' => ['nullable', 'string', 'max:64'],
        ]);
        $this->pass->equip($request->user(), $data['type'], $data['value'] ?? null);
        Inertia::flash('toast', ['type' => 'success', 'message' => ($data['value'] ?? null) === null ? 'Знято.' : 'Вдягнуто.']);

        return back();
    }
}
