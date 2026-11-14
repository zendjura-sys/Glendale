<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Models\UserStream;
use App\Services\Auth\DiscordOAuth;
use App\Services\Auth\FirebaseAuth;
use App\Services\Auth\SocialLogin;
use App\Services\Streams\LiveStreams;
use App\Support\Countries;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request, SocialLogin $social, DiscordOAuth $discord, FirebaseAuth $firebase): Response
    {
        $user = $request->user();

        $stream = UserStream::query()->where('user_id', $user->id)->first();

        return Inertia::render('settings/profile', [
            'stream' => $stream ? app(LiveStreams::class)->card($stream, $request->getHost()) : null,
            'mustVerifyEmail' => $user instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
            'profile' => [
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'username' => $user->username,
                'email' => $user->email,
                'status' => $user->statusExpired() ? null : $user->status,
                'about' => $user->about,
                'city' => $user->city,
                'country' => $user->country,
                'birthday' => $user->birthday?->toDateString(),
                'gender' => $user->gender,
                'website' => $user->website,
                'is_private' => $user->is_private,
                'message_privacy' => $user->message_privacy,
                'email_social' => $user->email_social,
            ],
            'countries' => Countries::options(),
            'connections' => $social->connections($user, [
                'discord' => $discord->configured(),
                'google' => $firebase->configured(),
            ]),
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        // Статус, змінений у налаштуваннях, — постійний: таймер швидкого статусу знімається.
        if ($request->user()->isDirty('status')) {
            $request->user()->status_until = null;
        }

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Профіль оновлено.']);

        return to_route('profile.edit');
    }

    /**
     * Delete the user's profile.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
