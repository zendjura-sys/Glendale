<?php

namespace App\Http\Controllers\OAuth;

use App\Http\Controllers\Controller;
use App\Services\Servers\ServerOAuth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Публічні кінцеві точки OAuth для серверів: токен, профіль гравця й синхронізація. */
class TokenController extends Controller
{
    public function __construct(private readonly ServerOAuth $oauth) {}

    public function token(Request $request): JsonResponse
    {
        [$clientId, $secret] = $this->credentials($request);
        if (($request->input('grant_type') ?? '') !== 'authorization_code' || ! is_string($request->input('code'))) {
            return response()->json(['error' => 'unsupported_grant_type'], 400);
        }

        return response()->json($this->oauth->exchange(
            $clientId,
            $secret,
            $request->input('code'),
            (string) $request->input('redirect_uri', ''),
            is_string($request->input('code_verifier')) ? $request->input('code_verifier') : null,
        ))->header('Cache-Control', 'no-store');
    }

    public function userinfo(Request $request): JsonResponse
    {
        return response()->json($this->oauth->userinfo($this->oauth->token($request->bearerToken())));
    }

    public function sync(Request $request): JsonResponse
    {
        [$clientId, $secret] = $this->credentials($request);
        $client = $this->oauth->client($clientId, $secret);
        $data = $request->validate([
            'online' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'max' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'players' => ['nullable', 'array', 'max:5000'],
            'players.*.user_id' => ['required', 'integer'],
            'players.*.nickname' => ['nullable', 'string', 'max:60'],
            'players.*.online' => ['nullable', 'boolean'],
        ]);

        return response()->json($this->oauth->sync($client, $data));
    }

    /**
     * Дані клієнта: заголовок Basic або поля client_id і client_secret.
     *
     * @return array{0: string, 1: string|null}
     */
    private function credentials(Request $request): array
    {
        if ($request->getUser() !== null) {
            return [(string) $request->getUser(), $request->getPassword()];
        }

        return [(string) $request->input('client_id', ''), is_string($request->input('client_secret')) ? $request->input('client_secret') : null];
    }
}
