<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\MessageController;
use App\Models\Conversation;
use App\Models\MessageAttachment;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Messenger;
use App\Services\MessengerPresenter;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChatApiController extends ApiController
{
    public function __construct(
        private readonly Messenger $messenger,
        private readonly MessengerPresenter $presenter,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $this->user($request);

        return response()->json([
            'conversations' => $this->presenter->inbox($user, $this->messenger),
            'unread' => $this->messenger->unreadConversations($user),
        ]);
    }

    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $this->user($request);
        $me = $conversation->participantFor($user);
        abort_if($me === null, 404);

        return response()->json([
            'conversation' => $this->presenter->details($conversation, $user, $me, $this->messenger),
            'history' => $this->presenter->history($conversation),
        ]);
    }

    public function history(Request $request, Conversation $conversation): JsonResponse
    {
        abort_if($conversation->participantFor($this->user($request)) === null, 404);
        $before = $request->integer('before') ?: null;

        return response()->json($this->presenter->history($conversation, $before));
    }

    public function direct(Request $request, User $user): JsonResponse
    {
        $viewer = $this->user($request);
        abort_if($viewer->is($user), 404);

        $existing = Conversation::query()->where('direct_key', Conversation::directKey($viewer->id, $user->id))->first();

        if (! $existing && ! $this->messenger->canMessage($viewer, $user)) {
            abort(403, "{$user->first_name} приймає повідомлення лише від друзів.");
        }

        $conversation = $existing ?? $this->messenger->direct($viewer, $user);

        return response()->json(['id' => $conversation->id]);
    }

    public function group(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:80'],
            'user_ids' => ['required', 'array', 'min:1', 'max:'.(Conversation::MAX_MEMBERS - 1)],
            'user_ids.*' => ['integer'],
        ]);

        $conversation = $this->messenger->createGroup($this->user($request), trim($data['title']), $data['user_ids']);

        return response()->json(['id' => $conversation->id], 201);
    }

    public function send(Request $request, Conversation $conversation, MessageController $messages): JsonResponse
    {
        return $messages->store($request, $conversation, app(SiteSettings::class));
    }

    public function read(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate(['message_id' => ['required', 'integer']]);
        $this->messenger->markRead($conversation, $this->user($request), $data['message_id']);

        return response()->json(['ok' => true]);
    }

    public function mute(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate(['muted' => ['required', 'boolean']]);
        $this->messenger->setMuted($conversation, $this->user($request), $data['muted']);

        return response()->json(['ok' => true]);
    }

    public function stickers(MessageController $messages): JsonResponse
    {
        return $messages->stickers();
    }

    public function download(Request $request, MessageAttachment $attachment, MessageController $messages): StreamedResponse
    {
        return $messages->download($request, $attachment);
    }

    public function contacts(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $friendships = app(FriendshipService::class);

        return response()->json([
            'users' => User::query()->whereIn('id', $friendships->friendIds($user))->orderBy('name')->limit(100)->get()->map->toCard()->values(),
        ]);
    }
}
