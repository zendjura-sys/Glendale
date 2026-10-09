<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Services\FriendshipService;
use App\Support\I18n\Locales;
use App\Support\Palette;
use App\Support\ProfileBlocks;
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
            'show_visitors' => (bool) $user->pref('show_visitors'),
            'profile_blocks' => ProfileBlocks::normalize($user->pref('profile_blocks')),
            'languageOptions' => app(Locales::class)->options(),
            'friends' => app(FriendshipService::class)->friendsQuery($user)->limit(40)->get()->map->toCard()->values(),
            'closeFriends' => array_map('intval', (array) $user->pref('close_friends', [])),
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
            'close_friends' => ['sometimes', 'array', 'max:30'],
            'close_friends.*' => ['integer'],
            'show_visitors' => ['sometimes', 'boolean'],
            'profile_blocks' => ['sometimes', 'array', 'max:12'],
            'profile_blocks.*' => ['string'],
        ]);

        $enabled = app(Locales::class)->enabled();
        $languages = array_values(array_unique(array_filter(
            $data['languages'] ?? [],
            fn (string $code) => in_array($code, $enabled, true),
        )));

        $patch = [
            'palette' => $data['palette'],
            'quiet_enabled' => $data['quiet_enabled'],
            'quiet_from' => $data['quiet_from'],
            'quiet_to' => $data['quiet_to'],
            'languages' => $languages,
            'looking_for_group' => $data['looking_for_group'],
        ];
        if (array_key_exists('close_friends', $data)) {
            $friendIds = app(FriendshipService::class)->friendIds($request->user());
            $patch['close_friends'] = array_values(array_intersect(array_map('intval', $data['close_friends']), $friendIds));
        }
        if (array_key_exists('show_visitors', $data)) {
            $patch['show_visitors'] = (bool) $data['show_visitors'];
        }
        if (array_key_exists('profile_blocks', $data)) {
            $patch['profile_blocks'] = ProfileBlocks::normalize($data['profile_blocks']);
        }
        $request->user()->mergePref($patch);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Вигляд збережено.']);

        return to_route('appearance.edit');
    }
}
