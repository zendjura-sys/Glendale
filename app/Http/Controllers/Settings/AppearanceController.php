<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Services\FriendshipService;
use App\Support\Backgrounds;
use App\Support\I18n\Locales;
use App\Support\MutedWords;
use App\Support\NetworkModes;
use App\Support\NotifyPrefs;
use App\Support\Palette;
use App\Support\Plugins\Plugins;
use App\Support\ProfileBlocks;
use App\Support\Skins;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
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
            'background' => [
                ...Backgrounds::for($user),
                // Поле вводу показує збережене відео навіть після закінчення GameCon+.
                'video' => Backgrounds::youtubeId($user->pref('background_video')),
            ],
            'backgrounds' => Backgrounds::presets(),
            'skin' => Skins::for($user),
            'seasonal' => $user->pref('seasonal') !== false,
            'modes' => app(NetworkModes::class)->available(),
            'networkMode' => app(NetworkModes::class)->for($user)['id'],
            'moduleNames' => app(NetworkModes::class)->moduleNames(),
            'isPlus' => $user->isPlus(),
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
            'notify' => NotifyPrefs::for($user),
            'muteWords' => MutedWords::phrases($user),
            'hideSpoilers' => (bool) $user->pref('hide_spoilers'),
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
            'notify' => ['sometimes', 'array'],
            'notify.likes' => ['sometimes', 'boolean'],
            'notify.comments' => ['sometimes', 'boolean'],
            'notify.mentions' => ['sometimes', 'boolean'],
            'notify.events' => ['sometimes', 'boolean'],
            'notify.playing' => ['sometimes', 'boolean'],
            'notify.site' => ['sometimes', 'boolean'],
            'notify.email' => ['sometimes', 'boolean'],
            'notify.push' => ['sometimes', 'boolean'],
            'mute_words' => ['sometimes', 'array', 'max:20'],
            'mute_words.*' => ['string', 'max:40'],
            'hide_spoilers' => ['sometimes', 'boolean'],
            'background' => ['sometimes', 'string', 'in:'.implode(',', Backgrounds::presets())],
            'background_motion' => ['sometimes', 'boolean'],
            'background_video' => ['sometimes', 'nullable', 'string', 'max:200'],
            'skin' => ['sometimes', 'string', 'in:'.implode(',', Skins::ALL)],
            'seasonal' => ['sometimes', 'boolean'],
            'network_mode' => ['sometimes', 'string', 'in:'.implode(',', array_column(app(NetworkModes::class)->available(), 'id'))],
        ]);

        $enabled = app(Locales::class)->enabled();
        $languages = array_values(array_unique(array_filter(
            $data['languages'] ?? [],
            fn (string $code) => in_array($code, $enabled, true),
        )));

        $plugins = app(Plugins::class);
        $patch = [];
        if ($plugins->on('palettes')) {
            $patch['palette'] = $data['palette'];
        }
        if ($plugins->on('quiet_hours')) {
            $patch['quiet_enabled'] = $data['quiet_enabled'];
            $patch['quiet_from'] = $data['quiet_from'];
            $patch['quiet_to'] = $data['quiet_to'];
        }
        if ($plugins->on('spoken_languages')) {
            $patch['languages'] = $languages;
        }
        if ($plugins->on('looking_for_group')) {
            $patch['looking_for_group'] = $data['looking_for_group'];
        }
        if (array_key_exists('close_friends', $data)) {
            $friendIds = app(FriendshipService::class)->friendIds($request->user());
            $patch['close_friends'] = array_values(array_intersect(array_map('intval', $data['close_friends']), $friendIds));
        }
        if ($plugins->on('profile_visitors') && array_key_exists('show_visitors', $data)) {
            $patch['show_visitors'] = (bool) $data['show_visitors'];
        }
        if ($plugins->on('profile_order') && array_key_exists('profile_blocks', $data)) {
            $patch['profile_blocks'] = ProfileBlocks::normalize($data['profile_blocks']);
        }
        if ($plugins->on('muted_words') && array_key_exists('mute_words', $data)) {
            $patch['mute_words'] = MutedWords::normalize($data['mute_words']);
        }
        if ($plugins->on('spoiler_switch') && array_key_exists('hide_spoilers', $data)) {
            $patch['hide_spoilers'] = (bool) $data['hide_spoilers'];
        }
        if ($plugins->on('notify_switches') && array_key_exists('notify', $data)) {
            $incoming = $data['notify'];
            $notify = [];
            foreach (NotifyPrefs::KEYS as $key) {
                $notify[$key] = array_key_exists($key, $incoming)
                    ? (bool) $incoming[$key]
                    : NotifyPrefs::enabled($request->user(), $key);
            }
            $patch['notify'] = $notify;
        }
        if (array_key_exists('seasonal', $data)) {
            $patch['seasonal'] = (bool) $data['seasonal'];
        }
        if (array_key_exists('skin', $data)) {
            $patch['skin'] = $data['skin'];
        }
        if (array_key_exists('network_mode', $data)) {
            $patch['network_mode'] = $data['network_mode'];
        }
        if (array_key_exists('background', $data)) {
            $patch['background'] = $data['background'];
        }
        if (array_key_exists('background_motion', $data)) {
            $patch['background_motion'] = (bool) $data['background_motion'];
        }
        if (array_key_exists('background_video', $data)) {
            $video = Backgrounds::youtubeId($data['background_video']);
            if (filled($data['background_video']) && $video === null) {
                throw ValidationException::withMessages(['background_video' => 'Не вдалося розпізнати посилання на відео YouTube.']);
            }
            // Нове відео може поставити лише учасник GameCon+; прибрати своє — будь-хто.
            if ($video !== null && $video !== $request->user()->pref('background_video') && ! $request->user()->isPlus()) {
                throw ValidationException::withMessages(['background_video' => 'Відеофон доступний з GameCon+.']);
            }
            $patch['background_video'] = $video;
        }
        $request->user()->mergePref($patch);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Вигляд збережено.']);

        return to_route('appearance.edit');
    }
}
