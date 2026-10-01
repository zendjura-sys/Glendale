<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use App\Services\Messenger;
use App\Services\MessengerPresenter;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public const MAX_LENGTH = 4096;

    public const MAX_IMAGES = 10;

    public function __construct(
        private readonly Messenger $messenger,
        private readonly MessengerPresenter $presenter,
    ) {}

    public function store(Request $request, Conversation $conversation, SiteSettings $settings): JsonResponse
    {
        $user = $request->user();
        abort_if($conversation->participantFor($user) === null, 404);

        if (! $conversation->isGroup()) {
            $peer = $conversation->activeParticipants()->where('user_id', '!=', $user->id)->with('user')->first()?->user;
            abort_unless($peer && $this->messenger->canMessage($user, $peer), 403, 'Ви не можете написати цьому користувачу.');
        }

        $maxKb = (int) $settings->get('max_upload_mb') * 1024;

        $data = $request->validate([
            'body' => ['nullable', 'string', 'max:'.self::MAX_LENGTH],
            'reply_to_id' => ['nullable', 'integer'],
            'images' => ['nullable', 'array', 'max:'.self::MAX_IMAGES],
            'images.*' => ['image', 'mimes:jpg,jpeg,png,webp,gif', 'max:'.$maxKb],
        ]);

        $message = $this->messenger->send(
            $conversation,
            $user,
            $data['body'] ?? null,
            $request->file('images', []),
            isset($data['reply_to_id']) ? (int) $data['reply_to_id'] : null,
        );

        return response()->json(['message' => $this->presenter->message($this->presenter->load($message))], 201);
    }

    public function update(Request $request, Conversation $conversation, Message $message): JsonResponse
    {
        abort_unless($message->conversation_id === $conversation->id, 404);
        $data = $request->validate(['body' => ['required', 'string', 'max:'.self::MAX_LENGTH]]);

        $this->messenger->edit($message, $request->user(), $data['body']);

        return response()->json(['message' => $this->presenter->message($this->presenter->load($message->refresh()))]);
    }

    public function destroy(Request $request, Conversation $conversation, Message $message): JsonResponse
    {
        abort_unless($message->conversation_id === $conversation->id, 404);

        $this->messenger->delete($message, $request->user());

        return response()->json(['deleted' => true]);
    }
}
