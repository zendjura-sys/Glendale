<?php

namespace App\Http\Controllers;

use App\Models\ChatAutomation;
use App\Models\Conversation;
use App\Services\Chat\ChatBots;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Боти бесіди: «Привітання» й «Автопости» (керують адміністратори групи чи каналу). */
class ChatBotController extends Controller
{
    public function __construct(private readonly ChatBots $bots) {}

    public function index(Request $request, Conversation $conversation): JsonResponse
    {
        $this->bots->authorize($conversation, $request->user());

        return response()->json([
            ...$this->bots->overview($conversation),
            'welcome_on' => app(Plugins::class)->on('chat_welcome_bot'),
            'posts_on' => app(Plugins::class)->on('chat_autoposter'),
        ]);
    }

    public function welcome(Request $request, Conversation $conversation): JsonResponse
    {
        app(Plugins::class)->ensure('chat_welcome_bot');
        $this->bots->authorize($conversation, $request->user());
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'body' => ['required', 'string', 'max:1000'],
            'bot_name' => ['nullable', 'string', 'max:40'],
        ]);
        $this->bots->saveWelcome($conversation, $request->user(), $data);

        return response()->json($this->bots->overview($conversation));
    }

    public function store(Request $request, Conversation $conversation): JsonResponse
    {
        app(Plugins::class)->ensure('chat_autoposter');
        $this->bots->authorize($conversation, $request->user());
        $data = $request->validate([
            'body' => ['required', 'string', 'max:1000'],
            'bot_name' => ['nullable', 'string', 'max:40'],
            'repeat' => ['required', Rule::in(ChatAutomation::REPEATS)],
            'at' => ['required_if:repeat,once', 'nullable', 'date'],
            'time' => ['required_unless:repeat,once', 'nullable', 'string'],
            'weekdays' => ['required_if:repeat,weekly', 'nullable', 'array'],
            'weekdays.*' => ['integer', 'between:1,7'],
        ]);
        $this->bots->addPost($conversation, $request->user(), $data);

        return response()->json($this->bots->overview($conversation), 201);
    }

    public function update(Request $request, Conversation $conversation, ChatAutomation $automation): JsonResponse
    {
        $this->bots->authorize($conversation, $request->user());
        abort_unless($automation->conversation_id === $conversation->id, 404);
        $data = $request->validate(['enabled' => ['required', 'boolean']]);
        $this->bots->toggle($automation, $data['enabled']);

        return response()->json($this->bots->overview($conversation));
    }

    public function destroy(Request $request, Conversation $conversation, ChatAutomation $automation): JsonResponse
    {
        $this->bots->authorize($conversation, $request->user());
        abort_unless($automation->conversation_id === $conversation->id, 404);
        $automation->delete();

        return response()->json($this->bots->overview($conversation));
    }
}
