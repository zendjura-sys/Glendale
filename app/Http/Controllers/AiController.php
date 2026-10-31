<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\Conversation;
use App\Services\Ai\AiAssistant;
use App\Services\Ai\AiException;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** ШІ для людей: переписати повідомлення, підсумок чату, опис спільноти. */
class AiController extends Controller
{
    public function __construct(private readonly AiAssistant $assistant) {}

    public function rewrite(Request $request): JsonResponse
    {
        app(Plugins::class)->ensure('ai_writer');
        $data = $request->validate([
            'text' => ['required', 'string', 'max:4000'],
            'mode' => ['required', Rule::in(AiAssistant::MODES)],
        ]);

        return $this->answer(fn () => ['text' => $this->assistant->rewrite($request->user(), $data['text'], $data['mode'])]);
    }

    public function summary(Request $request, Conversation $conversation): JsonResponse
    {
        app(Plugins::class)->ensure('ai_summary');
        abort_if($conversation->participantFor($request->user()) === null, 404);
        abort_unless($conversation->isGroup(), 422, 'Підсумок доступний у групах і каналах.');

        return $this->answer(fn () => ['summary' => $this->assistant->summary($request->user(), $conversation)]);
    }

    public function description(Request $request, Community $community): JsonResponse
    {
        app(Plugins::class)->ensure('ai_community_description');
        abort_unless($community->membershipFor($request->user())?->isAdmin() || $request->user()->isStaff(), 403);
        $data = $request->validate(['hints' => ['nullable', 'string', 'max:500']]);

        return $this->answer(fn () => ['text' => $this->assistant->communityDescription($request->user(), $community, (string) ($data['hints'] ?? ''))]);
    }

    /**
     * @param  callable(): array<string, string>  $work
     */
    private function answer(callable $work): JsonResponse
    {
        try {
            return response()->json($work());
        } catch (AiException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
