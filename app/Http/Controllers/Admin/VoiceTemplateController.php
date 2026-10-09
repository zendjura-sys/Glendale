<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\VoiceRoomTemplate;
use App\Services\Voice\VoiceRooms;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Голосові кімнати, які адміністрація додає в кожну сім’ю (наприклад, «Бізвар»).
 * Кімнати з’являються в сім’ях при наступному відкритті списку; доступ за рангами — стартовий,
 * далі кожна сім’я змінює його у «Рангах і правах».
 */
class VoiceTemplateController extends Controller
{
    public function __construct(private readonly VoiceRooms $voice) {}

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        VoiceRoomTemplate::query()->create([
            'name' => $data['name'],
            'ranks' => VoiceRoomTemplate::normalizeRanks($data['ranks']),
            'position' => (int) VoiceRoomTemplate::query()->max('position') + 1,
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Кімнату «{$data['name']}» додано в усі сім’ї."]);

        return back();
    }

    public function update(Request $request, VoiceRoomTemplate $template): RedirectResponse
    {
        $data = $this->validated($request);
        $this->voice->updateTemplate($template, $data['name'], $data['ranks'], $request->boolean('apply_ranks'));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Збережено.']);

        return back();
    }

    public function destroy(VoiceRoomTemplate $template): RedirectResponse
    {
        $this->voice->deleteTemplate($template);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Кімнату «{$template->name}» прибрано з усіх сімей."]);

        return back();
    }

    /**
     * @return array{name: string, ranks: list<int>|null}
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'ranks' => ['nullable', 'array'],
            'ranks.*' => ['integer', 'between:1,9'],
            'apply_ranks' => ['sometimes', 'boolean'],
        ]);

        return [
            'name' => trim((string) $data['name']),
            'ranks' => isset($data['ranks']) ? array_values(array_map('intval', (array) $data['ranks'])) : null,
        ];
    }
}
