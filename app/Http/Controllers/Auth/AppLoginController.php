<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\AppLoginRequest;
use App\Services\Auth\AppLogin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** «Увійти через застосунок GameCon» — бік браузера: запит, опитування стану, сторінка з QR-коду. */
class AppLoginController extends Controller
{
    public function __construct(private readonly AppLogin $logins) {}

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['login' => ['nullable', 'string', 'max:255']]);
        [$entry, $secret] = $this->logins->create($request, $data['login'] ?? null);

        return response()->json([
            'id' => $entry->id,
            'secret' => $secret,
            'code' => $entry->code,
            'qr' => rtrim((string) config('app.url'), '/').'/app-login/'.$entry->id,
            'deep_link' => 'gamecon://app-login/'.$entry->id,
            'expires_at' => $entry->expires_at->toIso8601String(),
        ], 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $entry = AppLoginRequest::query()->with('user')->find($id);
        abort_unless($entry instanceof AppLoginRequest && $this->logins->owns($entry, (string) $request->query('secret', '')), 404);

        $status = $this->logins->status($entry);
        if ($status !== 'approved') {
            return response()->json(['status' => $status]);
        }

        if ($this->logins->consume($request, $entry) === null) {
            return response()->json(['status' => $this->logins->status($entry->refresh())]);
        }

        return response()->json([
            'status' => 'approved',
            'redirect' => (string) $request->session()->pull('url.intended', config('fortify.home', '/feed')),
        ]);
    }

    /** Те, що кодує QR: на телефоні із застосунком відкриває застосунок, інакше — підказка. */
    public function open(string $id): Response
    {
        return Inertia::render('auth/app-login', [
            'id' => $id,
            'deepLink' => 'gamecon://app-login/'.$id,
        ]);
    }
}
