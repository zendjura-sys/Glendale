<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Services\Ai\AiClient;
use App\Services\Ai\AiException;
use App\Services\Families\FamilyAi;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ШІ-помічник сім’ї: чернетки статуту, назв рангів і звіту. Зберігає людина звичайними
 * формами (там права й журнал аудиту), тут лише готуємо текст.
 */
class FamilyAiController extends FamilyBaseController
{
    public function charter(Request $request, Family $family, FamilyAi $ai): JsonResponse
    {
        $this->ready();
        $this->member($request, $family, 'settings.manage');
        $data = $request->validate(['brief' => ['nullable', 'string', 'max:1500']]);

        return $this->run(fn () => $ai->charter($family, (string) ($data['brief'] ?? '')));
    }

    public function ranks(Request $request, Family $family, FamilyAi $ai): JsonResponse
    {
        $this->ready();
        $this->member($request, $family, 'settings.manage');
        $data = $request->validate(['style' => ['required', 'string', 'min:3', 'max:500']]);

        return $this->run(fn () => ['ranks' => $ai->ranks($family, $data['style'])]);
    }

    public function report(Request $request, Family $family, FamilyAi $ai): JsonResponse
    {
        $this->ready();
        $this->member($request, $family);
        $data = $request->validate(['text' => ['required', 'string', 'min:3', 'max:800']]);

        return $this->run(fn () => $ai->report($family, $data['text']));
    }

    private function ready(): void
    {
        app(Plugins::class)->ensure('family_ai');
        abort_unless(app(AiClient::class)->configured(), 503, 'ШІ ще не підключено адміністрацією сайту.');
    }

    /**
     * @param  callable(): array<string, mixed>  $fn
     */
    private function run(callable $fn): JsonResponse
    {
        try {
            return response()->json($fn());
        } catch (AiException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
