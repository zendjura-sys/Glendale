<?php

namespace App\Http\Controllers;

use App\Models\Livecast;
use App\Models\LiveShow;
use App\Services\Ai\AiException;
use App\Services\Ai\StreamCopilot;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ШІ-помічник ефіру для ведучих LiveCast / GameCast.
 */
class StreamAiController extends Controller
{
    public function __construct(private readonly StreamCopilot $copilot) {}

    public function watchShow(Request $request, LiveShow $show): JsonResponse
    {
        try {
            return response()->json($this->copilot->watchGameCast($request->user(), $show));
        } catch (AiException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function promoShow(Request $request, LiveShow $show): JsonResponse
    {
        $data = $request->validate(['hint' => ['nullable', 'string', 'max:300']]);
        try {
            $text = $this->copilot->promo($request->user(), 'gamecast', $show->title, [
                'topics' => $show->topicList(),
                'hint' => $data['hint'] ?? null,
            ]);

            return response()->json(['promo' => $text]);
        } catch (AiException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function watchLiveCast(Request $request, Livecast $livecast): JsonResponse
    {
        try {
            return response()->json($this->copilot->watchLiveCast($request->user(), $livecast));
        } catch (AiException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function promoLiveCast(Request $request, Livecast $livecast): JsonResponse
    {
        $data = $request->validate(['hint' => ['nullable', 'string', 'max:300']]);
        try {
            $text = $this->copilot->promo($request->user(), 'livecast', $livecast->title, [
                'category' => $livecast->category,
                'hint' => $data['hint'] ?? null,
            ]);

            return response()->json(['promo' => $text]);
        } catch (AiException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
