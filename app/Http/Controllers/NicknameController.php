<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Генератор ніків і назв кланів (генерує браузер; сервер лише каже, чи вільна адреса). */
class NicknameController extends Controller
{
    public function index(): Response
    {
        app(Plugins::class)->ensure('nick_generator');

        return Inertia::render('tools/nicknames');
    }

    public function check(Request $request): JsonResponse
    {
        app(Plugins::class)->ensure('nick_generator');
        $data = $request->validate(['names' => ['required', 'array', 'max:30'], 'names.*' => ['required', 'string', 'max:40']]);
        $originals = array_map(fn ($n) => (string) $n, $data['names']);
        $names = array_map('mb_strtolower', $originals);
        $taken = User::query()->whereIn('username', $names)->pluck('username')->map(fn ($u) => mb_strtolower((string) $u))->all();
        $reserved = array_map('mb_strtolower', (array) config('reserved.usernames', []));
        $valid = fn (string $n) => (bool) preg_match('/^[a-z][a-z0-9_.]*[a-z0-9]$/', $n) && mb_strlen($n) >= 3 && mb_strlen($n) <= 32;
        $isFree = fn (string $n) => $valid($n) && ! in_array($n, $taken, true) && ! in_array($n, $reserved, true);

        // Вільні адреси — малими літерами (так їх порівнює сайт) і в написанні запиту:
        // застосунок 1.1.74 порівнював нік як є, і «SneakyVarenyk» вважав зайнятим.
        $free = [];
        foreach ($originals as $original) {
            if ($isFree(mb_strtolower($original))) {
                $free[] = mb_strtolower($original);
                $free[] = $original;
            }
        }

        return response()->json(['free' => array_values(array_unique($free))]);
    }
}
