<?php

namespace App\Http\Controllers\Api;

use App\Models\AppLoginRequest;
use App\Services\Auth\AppLogin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** «Увійти через застосунок GameCon» — бік застосунку: деталі запиту, підтвердження, відмова. */
class AppLoginApiController extends ApiController
{
    public function __construct(private readonly AppLogin $logins) {}

    public function show(string $id): JsonResponse
    {
        $entry = $this->find($id);
        abort_unless($this->logins->open($entry), 410, 'Запит на вхід застарів.');

        return response()->json($this->logins->details($entry));
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'size:2']]);
        $this->logins->approve($this->find($id), $this->user($request), $data['code']);

        return response()->json(['ok' => true]);
    }

    public function deny(Request $request, string $id): JsonResponse
    {
        $this->logins->deny($this->find($id), $this->user($request));

        return response()->json(['ok' => true]);
    }

    private function find(string $id): AppLoginRequest
    {
        $entry = AppLoginRequest::query()->find($id);
        abort_unless($entry instanceof AppLoginRequest, 404, 'Запит на вхід не знайдено.');

        return $entry;
    }
}
