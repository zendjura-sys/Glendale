<?php

namespace App\Http\Controllers;

use App\Support\Modules\ModuleManager;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Міні-вікна застосунку GameCon для Windows (№261): кожен віджет — маленьке вікно «завжди згори»,
 * що саме по собі є оверлеєм у грі. Сторінка опитує /me/rail (cookie входу); розділ вимкнено модулем
 * чи в режимі людини — віджет порожній і застосунок його не показує.
 */
class DesktopWidgetController extends Controller
{
    /** Віджет → модуль, без якого його немає. */
    public const KINDS = ['friends' => 'friends', 'chats' => 'messages'];

    public function show(Request $request, string $kind, ModuleManager $modules): Response
    {
        abort_unless(array_key_exists($kind, self::KINDS), 404);
        $user = $request->user();

        return response()->view('desktop.widget', [
            'kind' => $kind,
            'guest' => $user === null,
            'available' => $user !== null && $modules->enabled(self::KINDS[$kind]),
        ])->header('Cache-Control', 'no-store');
    }
}
