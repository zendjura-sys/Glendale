<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\I18n\Locales;
use App\Support\Palette;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AppearanceController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('settings/appearance', [
            'palette' => $user->palette(),
            'palettes' => Palette::all(),
            'quiet' => [
                'enabled' => (bool) $user->pref('quiet_enabled'),
                'from' => (string) $user->pref('quiet_from', '23:00'),
                'to' => (string) $user->pref('quiet_to', '08:00'),
            ],
            'languages' => array_values(array_filter((array) $user->pref('languages', []), 'is_string')),
            'looking_for_group' => (bool) $user->pref('looking_for_group'),
            'languageOptions' => app(Locales::class)->options(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'palette' => ['required', 'string', 'in:'.implode(',', array_column(Palette::all(), 'id'))],
            'quiet_enabled' => ['required', 'boolean'],
            'quiet_from' => ['required', 'date_format:H:i'],
            'quiet_to' => ['required', 'date_format:H:i'],
            'languages' => ['array', 'max:8'],
            'languages.*' => ['string', 'max:16'],
            'looking_for_group' => ['required', 'boolean'],
        ]);

        $enabled = app(Locales::class)->enabled();
        $languages = array_values(array_unique(array_filter(
            $data['languages'] ?? [],
            fn (string $code) => in_array($code, $enabled, true),
        )));

        $request->user()->mergePref([
            'palette' => $data['palette'],
            'quiet_enabled' => $data['quiet_enabled'],
            'quiet_from' => $data['quiet_from'],
            'quiet_to' => $data['quiet_to'],
            'languages' => $languages,
            'looking_for_group' => $data['looking_for_group'],
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Вигляд збережено.']);

        return to_route('appearance.edit');
    }
}
