<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\Auth\DiscordOAuth;
use App\Services\Auth\FirebaseAuth;
use App\Services\Auth\SocialAuthException;
use App\Services\Auth\SocialLogin;
use App\Services\Auth\SocialProfile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class SocialAuthController extends Controller
{
    public function __construct(
        private readonly SocialLogin $social,
        private readonly DiscordOAuth $discord,
        private readonly FirebaseAuth $firebase,
    ) {}

    public function discordRedirect(Request $request): HttpResponse
    {
        if (! $this->discord->configured()) {
            return $this->fail($request, 'Вхід через Discord ще не налаштовано.');
        }

        $state = Str::random(40);
        $request->session()->put('discord_oauth_state', $state);

        return Inertia::location($this->discord->authorizeUrl($state));
    }

    public function discordCallback(Request $request): RedirectResponse
    {
        $queryState = (string) $request->query('state');
        $expected = $request->session()->pull('discord_oauth_state');
        $fromSession = is_string($expected) && hash_equals($expected, $queryState);

        if (! $fromSession) {
            $cached = Cache::pull('discord.oauth.'.$queryState);
            if (is_array($cached) && hash_equals($queryState, (string) ($cached['state'] ?? ''))) {
                $expected = $queryState;
                if (($cached['client'] ?? null) === 'android') {
                    $request->attributes->set('gamecon_app', true);
                }
            }
        }

        if ($request->filled('error') || ! is_string($expected) || ! hash_equals($expected, $queryState) || ! $request->filled('code')) {
            return $this->fail($request, $request->query('error') === 'access_denied' ? 'Ви скасували вхід через Discord.' : 'Не вдалося увійти через Discord. Спробуйте ще раз.');
        }

        try {
            return $this->complete($request, $this->discord->profile((string) $request->query('code')));
        } catch (SocialAuthException $e) {
            return $this->fail($request, $e->getMessage());
        }
    }

    public function firebase(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'id_token' => ['required_without:google_token', 'nullable', 'string', 'max:8192'],
            'google_token' => ['nullable', 'string', 'max:8192'],
        ]);

        if (! $this->firebase->configured()) {
            return $this->fail($request, 'Вхід через Google ще не налаштовано.');
        }

        try {
            $profile = filled($data['google_token'] ?? null)
                ? $this->firebase->verifyGoogleToken($data['google_token'])
                : $this->firebase->verify((string) $data['id_token']);

            return $this->complete($request, $profile);
        } catch (SocialAuthException $e) {
            return $this->fail($request, $e->getMessage());
        }
    }

    public function unlink(Request $request, string $provider): RedirectResponse
    {
        $this->social->unlink($request->user(), $provider);
        Inertia::flash('toast', ['type' => 'success', 'message' => SocialLogin::PROVIDERS[$provider].' від’єднано.']);

        return back();
    }

    private function complete(Request $request, SocialProfile $profile): RedirectResponse
    {
        if ($current = $request->user()) {
            $this->social->link($current, $profile);
            Inertia::flash('toast', ['type' => 'success', 'message' => $profile->label().' під’єднано — тепер можна входити в один клік.']);

            return to_route('profile.edit');
        }

        return $this->login($request, $this->social->resolve($profile));
    }

    private function login(Request $request, User $user): RedirectResponse
    {
        if ($user->isBanned()) {
            throw new SocialAuthException('Обліковий запис заблоковано'.($user->ban_reason ? ': '.$user->ban_reason : '.'));
        }

        if ($request->attributes->get('gamecon_app') === true) {
            $tokens = app(ApiTokens::class);

            if ($user->two_factor_confirmed_at !== null) {
                return redirect()->away('gamecon://auth?ticket='.$tokens->ticket($user));
            }

            return redirect()->away('gamecon://auth?code='.$tokens->handoff($user));
        }

        if ($user->two_factor_confirmed_at !== null) {
            $request->session()->put(['login.id' => $user->getKey(), 'login.remember' => true]);

            return to_route('two-factor.login');
        }

        Auth::login($user, remember: true);
        $request->session()->regenerate();

        return redirect()->intended('/feed');
    }

    private function fail(Request $request, string $message): RedirectResponse
    {
        if ($request->attributes->get('gamecon_app') === true) {
            return redirect()->away('gamecon://auth?error='.rawurlencode($message));
        }

        Inertia::flash('toast', ['type' => 'error', 'message' => $message]);

        return $request->user() ? to_route('profile.edit') : to_route('login');
    }
}
