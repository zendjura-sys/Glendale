<?php

namespace App\Http\Controllers\Api;

use App\Models\PushDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PushApiController extends ApiController
{
    /**
     * Застосунок реєструє FCM-токен після входу й щоразу, коли Firebase його оновлює.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'min:20', 'max:512'],
            'platform' => ['sometimes', Rule::in(PushDevice::PLATFORMS)],
        ]);

        // Токен належить пристрою: якщо на ньому увійшов інший акаунт, пристрій переходить до нього.
        PushDevice::query()->updateOrCreate(
            ['token' => $data['token']],
            [
                'user_id' => $this->user($request)->id,
                'api_token_id' => $request->attributes->get('api_token_id'),
                'platform' => $data['platform'] ?? 'android',
                'last_used_at' => now(),
            ],
        );

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:512']]);

        PushDevice::query()->where('user_id', $this->user($request)->id)->where('token', $data['token'])->delete();

        return response()->json(['ok' => true]);
    }
}
