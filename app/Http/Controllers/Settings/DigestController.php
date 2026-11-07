<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Ранковий дайджест — одне налаштування для сайту й застосунку.
 */
class DigestController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate(['morning_digest' => ['required', 'boolean']]);
        $user = $request->user();
        abort_unless($user instanceof User, 401);
        $user->mergePref(['morning_digest' => (bool) $data['morning_digest']]);

        return back();
    }
}
