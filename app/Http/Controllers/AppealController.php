<?php

namespace App\Http\Controllers;

use App\Models\Appeal;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** Оскарження блокування для тих, хто не може увійти. */
class AppealController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('auth/appeal');
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'body' => ['required', 'string', 'min:10', 'max:2000'],
        ]);
        $user = User::query()->where('email', mb_strtolower($data['email']))->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'Невірна пошта або пароль.']);
        }
        if (! $user->isBanned()) {
            throw ValidationException::withMessages(['email' => 'Цей акаунт не заблоковано — просто увійдіть.']);
        }
        if (Appeal::query()->where('user_id', $user->id)->where('kind', 'ban')->where('status', Appeal::PENDING)->exists()) {
            throw ValidationException::withMessages(['body' => 'Оскарження вже на розгляді. Модератори дадуть відповідь найближчим часом.']);
        }
        Appeal::query()->create(['user_id' => $user->id, 'kind' => 'ban', 'body' => trim($data['body'])]);

        return to_route('login')->with('status', 'Оскарження надіслано. Якщо його приймуть, ви зможете увійти.');
    }
}
