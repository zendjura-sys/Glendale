<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Ранковий і щотижневий дайджести — налаштування для сайту й застосунку.
 */
class DigestController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'morning_digest' => ['sometimes', 'boolean'],
            'weekly_digest' => ['sometimes', 'boolean'],
        ]);
        $user = $request->user();
        abort_unless($user instanceof User, 401);
        $user->mergePref(array_map(fn ($on) => (bool) $on, $data));

        return back();
    }
}
