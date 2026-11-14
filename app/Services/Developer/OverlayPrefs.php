<?php

namespace App\Services\Developer;

use App\Models\DeveloperApp;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Налаштування оверлею GameCon SDK конкретного гравця в конкретній грі (синхронізуються
 * між пристроями). Що саме гравцю дозволено міняти, вирішує розробник (player_can).
 */
class OverlayPrefs
{
    public const PRESETS = [
        'minimal' => ['drop'],
        'standard' => ['hud', 'drop', 'chat'],
        'full' => ['hud', 'drop', 'chat', 'party', 'family'],
    ];

    /** @return array{enabled: bool, prefs: array<string, mixed>, allowed: list<string>} */
    public function get(DeveloperApp $app, User $user): array
    {
        $row = DB::table('developer_overlay_prefs')->where('developer_app_id', $app->id)->where('user_id', $user->id)->first();

        return [
            'enabled' => $row === null ? true : (bool) $row->enabled,
            'prefs' => $row === null ? (object) [] : (json_decode((string) $row->prefs, true) ?: (object) []),
            'allowed' => $app->overlayConfig()['player_can'],
        ];
    }

    /**
     * Зберегти лише дозволене розробником; решту відкидаємо мовчки (гра могла не знати про ліміти).
     *
     * @param  array<string, mixed>  $input
     * @return array{enabled: bool, prefs: array<string, mixed>, allowed: list<string>}
     */
    public function save(DeveloperApp $app, User $user, array $input): array
    {
        $can = $app->overlayConfig()['player_can'];
        $current = $this->get($app, $user);
        $prefs = (array) $current['prefs'];
        $p = (array) ($input['prefs'] ?? []);
        $corner = fn ($v) => in_array($v, ['top-left', 'top-right', 'bottom-left', 'bottom-right'], true) ? $v : null;
        if (in_array('move', $can, true) && isset($p['positions']) && is_array($p['positions'])) {
            $prefs['positions'] = array_filter(array_map($corner, array_intersect_key($p['positions'], array_flip(['hud', 'family', ...DeveloperApp::OVERLAY_SECTIONS]))));
        }
        if (in_array('modules', $can, true)) {
            if (isset($p['modules']) && is_array($p['modules'])) {
                $prefs['modules'] = array_values(array_intersect(DeveloperApp::OVERLAY_MODULES, $p['modules']));
            }
            // Розділи одним вікном чи окремо — теж «що видно», тож за тим самим дозволом.
            if (isset($p['layout']) && in_array($p['layout'], ['unified', 'separate', 'custom'], true)) {
                $prefs['layout'] = $p['layout'];
            }
            if (isset($p['windows']) && is_array($p['windows'])) {
                $prefs['windows'] = array_values(array_intersect(DeveloperApp::OVERLAY_SECTIONS, $p['windows']));
            }
            if (isset($p['preset']) && (array_key_exists($p['preset'], self::PRESETS) || $p['preset'] === 'custom')) {
                $prefs['preset'] = $p['preset'];
            }
        }
        if (in_array('hotkeys', $can, true)) {
            foreach (['hotkey', 'chat_hotkey'] as $k) {
                if (isset($p[$k]) && is_string($p[$k]) && preg_match('/^((Ctrl|Shift|Alt|Meta)\+){0,3}([A-Z0-9]|F([1-9]|1[0-2])|Tab|Home|End|Insert|`)$/', $p[$k]) === 1) {
                    $prefs[$k] = $p[$k];
                }
            }
            if (isset($p['gamepad'])) {
                $prefs['gamepad'] = (bool) $p['gamepad'];
            }
        }
        if (in_array('density', $can, true)) {
            if (isset($p['density'])) {
                $prefs['density'] = max(60, min(100, (int) $p['density']));
            }
            if (isset($p['scale'])) {
                $prefs['scale'] = max(80, min(130, (int) $p['scale']));
            }
        }
        // Режим стрімера — завжди за гравцем: це його приватність.
        if (isset($p['streamer'])) {
            $prefs['streamer'] = (bool) $p['streamer'];
        }
        $enabled = array_key_exists('enabled', $input) && in_array('disable', $can, true) ? (bool) $input['enabled'] : $current['enabled'];
        DB::table('developer_overlay_prefs')->updateOrInsert(
            ['developer_app_id' => $app->id, 'user_id' => $user->id],
            ['enabled' => $enabled, 'prefs' => json_encode($prefs), 'updated_at' => now(), 'created_at' => now()],
        );

        return $this->get($app, $user);
    }

    /** Вимкнути/увімкнути оверлей гри з налаштувань GameCon — гравець вирішує завжди. */
    public function toggle(DeveloperApp $app, User $user, bool $enabled): void
    {
        DB::table('developer_overlay_prefs')->updateOrInsert(
            ['developer_app_id' => $app->id, 'user_id' => $user->id],
            ['enabled' => $enabled, 'updated_at' => now(), 'created_at' => now()],
        );
    }

    public function reset(DeveloperApp $app, User $user): void
    {
        DB::table('developer_overlay_prefs')->where('developer_app_id', $app->id)->where('user_id', $user->id)->update(['prefs' => null, 'updated_at' => now()]);
    }

    /** @return array<int, bool> app id → оверлей увімкнено */
    public function enabledMap(User $user): array
    {
        return DB::table('developer_overlay_prefs')->where('user_id', $user->id)->pluck('enabled', 'developer_app_id')->map(fn ($v) => (bool) $v)->all();
    }
}
