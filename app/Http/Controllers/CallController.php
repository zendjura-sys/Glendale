<?php

namespace App\Http\Controllers;

use App\Models\Call;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Voice\Calls;
use App\Services\Voice\LiveKit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Дзвінки в бесідах (JSON для сайту й застосунку): почати, приєднатися, відхилити, покласти слухавку.
 */
class CallController extends Controller
{
    public function __construct(
        private readonly Calls $calls,
        private readonly LiveKit $livekit,
    ) {}

    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        abort_if($conversation->participantFor($this->user($request)) === null, 404);

        return response()->json(['call' => $this->calls->stateFor($conversation)]);
    }

    public function start(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $this->user($request);
        abort_if($conversation->participantFor($user) === null, 404);
        abort_unless($this->calls->canCall($conversation, $user), 403, 'Ви не можете зателефонувати цьому користувачу.');
        abort_unless($this->livekit->configured(), 503, 'Дзвінки ще не налаштовані адміністратором.');

        return response()->json($this->calls->start($conversation, $user));
    }

    public function join(Request $request, Call $call): JsonResponse
    {
        $user = $this->live($request, $call);
        abort_unless($this->livekit->configured(), 503, 'Дзвінки ще не налаштовані адміністратором.');

        return response()->json($this->calls->join($call, $user));
    }

    public function decline(Request $request, Call $call): JsonResponse
    {
        $this->calls->decline($call, $this->live($request, $call));

        return response()->json(['ok' => true]);
    }

    public function leave(Request $request, Call $call): JsonResponse
    {
        $user = $this->user($request);
        abort_if($call->conversation?->participantFor($user) === null, 404);
        $this->calls->leave($call, $user);

        return response()->json(['ok' => true]);
    }

    /** Учасник бесіди, а дзвінок ще триває. */
    private function live(Request $request, Call $call): User
    {
        $user = $this->user($request);
        abort_if($call->conversation?->participantFor($user) === null, 404);
        abort_unless($call->isLive(), 410, 'Дзвінок уже завершено.');

        return $user;
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
