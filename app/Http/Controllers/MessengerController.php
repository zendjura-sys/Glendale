<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\MessageFavorite;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\ImageStorage;
use App\Services\Messenger;
use App\Services\MessengerPresenter;
use App\Services\Voice\Calls;
use App\Support\Plugins\Plugins;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MessengerController extends Controller
{
    public function __construct(
        private readonly Messenger $messenger,
        private readonly MessengerPresenter $presenter,
        private readonly FriendshipService $friendships,
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render('messages/index', [
            'conversations' => $this->presenter->inbox($request->user(), $this->messenger),
            'active' => null,
            'history' => null,
            'draft' => null,
        ]);
    }

    public function show(Request $request, Conversation $conversation, Calls $calls): Response
    {
        $user = $request->user();
        $me = $this->participant($conversation, $user);

        $draft = trim((string) $request->query('text', ''));

        return Inertia::render('messages/index', [
            'conversations' => $this->presenter->inbox($user, $this->messenger, $conversation->id),
            'active' => [...$this->presenter->details($conversation, $user, $me, $this->messenger), ...$calls->forViewer($conversation, $user)],
            'history' => $this->presenter->history($conversation, viewer: $user),
            'draft' => $draft === '' ? null : mb_substr($draft, 0, 120),
        ]);
    }

    public function history(Request $request, Conversation $conversation): JsonResponse
    {
        $this->participant($conversation, $request->user());
        $before = $request->integer('before') ?: null;

        return response()->json($this->presenter->history($conversation, $before, $request->user()));
    }

    public function saved(Request $request): Response
    {
        $user = $request->user();
        $items = MessageFavorite::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->limit(50)
            ->with(['message.user', 'message.attachments', 'message.conversation'])
            ->get()
            ->map(function (MessageFavorite $row) use ($user): ?array {
                $message = $row->message;
                if ($message === null || $message->trashed() || $message->conversation?->participantFor($user) === null) {
                    return null;
                }
                $card = $this->presenter->message($message, true);

                return [
                    'id' => $message->id,
                    'body' => $card['body'],
                    'preview' => $card['preview'],
                    'author' => $message->user?->first_name,
                    'created_at' => $card['created_at'],
                    'href' => '/messages/'.$message->conversation_id,
                ];
            })
            ->filter()
            ->values()
            ->all();

        return Inertia::render('messages/saved', ['items' => $items]);
    }

    public function direct(Request $request, User $user): RedirectResponse
    {
        $viewer = $request->user();
        abort_if($viewer->is($user), 404);

        $existing = Conversation::query()->where('direct_key', Conversation::directKey($viewer->id, $user->id))->first();

        if (! $existing && ! $this->messenger->canMessage($viewer, $user)) {
            Inertia::flash('toast', ['type' => 'error', 'message' => "{$user->first_name} приймає повідомлення лише від друзів."]);

            return back();
        }

        $conversation = $existing ?? $this->messenger->direct($viewer, $user);
        $text = trim((string) $request->query('text', ''));
        if ($text === '') {
            return to_route('messages.show', $conversation);
        }

        return to_route('messages.show', [
            'conversation' => $conversation,
            'text' => mb_substr($text, 0, 120),
        ]);
    }

    public function storeGroup(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:80'],
            'user_ids' => ['required', 'array', 'min:1', 'max:'.(Conversation::MAX_MEMBERS - 1)],
            'user_ids.*' => ['integer'],
        ]);

        $conversation = $this->messenger->createGroup($request->user(), trim($data['title']), $data['user_ids']);

        return to_route('messages.show', $conversation);
    }

    public function update(Request $request, Conversation $conversation, ImageStorage $images): RedirectResponse
    {
        $me = $this->participant($conversation, $request->user());
        abort_unless($conversation->isGroup() && $me->canManage(), 403);

        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:80'],
            'avatar' => ['sometimes', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);

        if (isset($data['title'])) {
            $this->messenger->rename($conversation, $request->user(), trim($data['title']));
        }

        if ($request->hasFile('avatar')) {
            $images->delete($conversation->avatar_path);
            $conversation->update(['avatar_path' => $images->store($request->file('avatar'), 'conversations', cover: [256, 256])['path']]);
        }

        return back();
    }

    public function addMembers(Request $request, Conversation $conversation): RedirectResponse
    {
        $this->participant($conversation, $request->user());
        $data = $request->validate(['user_ids' => ['required', 'array', 'min:1'], 'user_ids.*' => ['integer']]);

        $added = $this->messenger->addMembers($conversation, $request->user(), $data['user_ids']);
        Inertia::flash('toast', ['type' => 'success', 'message' => $added ? 'Учасників додано.' : 'Нових учасників немає.']);

        return back();
    }

    public function removeMember(Request $request, Conversation $conversation, User $user): RedirectResponse
    {
        $this->messenger->removeMember($conversation, $request->user(), $user);

        return $request->user()->is($user) ? to_route('messages.index') : back();
    }

    public function mute(Request $request, Conversation $conversation): RedirectResponse
    {
        $me = $this->participant($conversation, $request->user());
        $this->messenger->setMuted($conversation, $request->user(), ! $me->is_muted);

        return back();
    }

    public function slow(Request $request, Conversation $conversation): RedirectResponse
    {
        app(Plugins::class)->ensure('slow_mode');
        $data = $request->validate(['seconds' => ['required', 'integer', 'in:0,10,30,60']]);
        $this->messenger->setSlow($conversation, $request->user(), (int) $data['seconds']);

        return back();
    }

    public function automod(Request $request, Conversation $conversation): RedirectResponse
    {
        app(Plugins::class)->ensure('group_automod');
        $data = $request->validate([
            'links' => ['required', 'boolean'],
            'caps' => ['required', 'boolean'],
            'flood' => ['required', 'boolean'],
            'words' => ['nullable', 'string', 'max:2000'],
        ]);
        $words = preg_split('/[\n,]+/u', (string) ($data['words'] ?? '')) ?: [];
        $this->messenger->setAutomod($conversation, $request->user(), [
            'links' => (bool) $data['links'], 'caps' => (bool) $data['caps'], 'flood' => (bool) $data['flood'], 'words' => $words,
        ]);

        return back();
    }

    public function memberRole(Request $request, Conversation $conversation, User $user): RedirectResponse
    {
        app(Plugins::class)->ensure('chat_roles');
        $data = $request->validate(['role' => ['required', 'in:admin,member']]);
        $this->messenger->setMemberRole($conversation, $request->user(), $user, $data['role']);

        return back();
    }

    public function markUnread(Request $request, Conversation $conversation): RedirectResponse
    {
        app(Plugins::class)->ensure('mark_unread');
        $this->participant($conversation, $request->user());
        $this->messenger->markUnread($conversation, $request->user());

        return to_route('messages.index');
    }

    public function receipts(Request $request, Conversation $conversation): RedirectResponse
    {
        app(Plugins::class)->ensure('read_receipts');
        $me = $this->participant($conversation, $request->user());
        $me->forceFill(['share_receipts' => ! $me->share_receipts])->save();

        return back();
    }

    public function pin(Request $request, Conversation $conversation): RedirectResponse
    {
        $me = $this->participant($conversation, $request->user());
        $me->forceFill(['pinned_at' => $me->pinned_at ? null : now()])->save();

        return back();
    }

    public function folder(Request $request, Conversation $conversation): RedirectResponse
    {
        app(Plugins::class)->ensure('chat_folders');
        $me = $this->participant($conversation, $request->user());
        $data = $request->validate(['folder' => ['nullable', 'string', 'max:24']]);
        $name = trim((string) ($data['folder'] ?? ''));
        $me->forceFill(['folder' => $name === '' ? null : $name])->save();

        return back();
    }

    public function read(Request $request, Conversation $conversation): JsonResponse
    {
        $this->participant($conversation, $request->user());
        $data = $request->validate(['message_id' => ['required', 'integer', 'min:1']]);

        $this->messenger->markRead($conversation, $request->user(), $data['message_id']);

        return response()->json(['unread_total' => $this->messenger->unreadConversations($request->user())]);
    }

    /**
     * Друзі та співрозмовники для діалогу «Нове повідомлення».
     */
    public function contacts(Request $request): JsonResponse
    {
        $viewer = $request->user();
        $term = trim((string) $request->query('q', ''));
        $site = $request->query('scope') === 'site' && mb_strlen($term) >= 2;
        $friendIds = $this->friendships->friendIds($viewer);

        $users = ($site ? User::query()->whereNull('banned_at')->whereNull('frozen_at')->whereKeyNot($viewer->id) : $this->friendships->friendsQuery($viewer))
            ->when($term !== '', fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->where('name', 'like', "%{$term}%")
                ->orWhere('username', 'like', "%{$term}%")))
            ->orderByDesc('last_seen_at')
            ->limit(30)
            ->get()
            ->sortByDesc(fn (User $u) => in_array($u->id, $friendIds))
            ->map(fn (User $u) => [...$u->toCard(), 'is_friend' => in_array($u->id, $friendIds)])
            ->values();

        return response()->json(['users' => $users]);
    }

    private function participant(Conversation $conversation, User $user): ConversationParticipant
    {
        $row = $conversation->participantFor($user);
        abort_if($row === null, 404);

        return $row;
    }
}
