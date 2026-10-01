<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class MessengerPresenter
{
    public const PAGE = 40;

    public function load(Message $message): Message
    {
        return $message->loadMissing(['user', 'attachments', 'replyTo.user', 'replyTo.attachments']);
    }

    /**
     * @return array<string, mixed>
     */
    public function message(Message $message): array
    {
        $reply = $message->replyTo;

        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'type' => $message->type,
            'body' => $message->body,
            'user' => $message->user?->toCard(),
            'reply_to' => $reply ? [
                'id' => $reply->id,
                'body' => $reply->trashed() ? null : Str::limit((string) $reply->body, 120),
                'author' => $reply->user?->first_name,
                'has_attachments' => ! $reply->trashed() && $reply->attachments->isNotEmpty(),
                'deleted' => $reply->trashed(),
            ] : null,
            'attachments' => $message->attachments->map(fn (MessageAttachment $a) => [
                'id' => $a->id,
                'url' => $a->url,
                'width' => $a->width,
                'height' => $a->height,
            ])->all(),
            'edited_at' => $message->edited_at?->toIso8601String(),
            'created_at' => $message->created_at->toIso8601String(),
        ];
    }

    /**
     * Останні повідомлення (або старіші за $beforeId) у хронологічному порядку.
     *
     * @return array{messages: list<array<string, mixed>>, has_more: bool}
     */
    public function history(Conversation $conversation, ?int $beforeId = null): array
    {
        $messages = $conversation->messages()
            ->with(['user', 'attachments', 'replyTo.user', 'replyTo.attachments'])
            ->when($beforeId, fn ($q, int $id) => $q->where('id', '<', $id))
            ->orderByDesc('id')
            ->limit(self::PAGE + 1)
            ->get();

        $hasMore = $messages->count() > self::PAGE;

        return [
            'messages' => $messages->take(self::PAGE)->reverse()->map(fn (Message $m) => $this->message($m))->values()->all(),
            'has_more' => $hasMore,
        ];
    }

    /**
     * Список бесід користувача для лівої колонки.
     *
     * @return list<array<string, mixed>>
     */
    public function inbox(User $viewer, Messenger $messenger, ?int $includeId = null): array
    {
        $conversations = Conversation::query()
            ->join('conversation_participants as me', function ($join) use ($viewer) {
                $join->on('me.conversation_id', '=', 'conversations.id')
                    ->where('me.user_id', $viewer->id)
                    ->whereNull('me.left_at');
            })
            ->select('conversations.*', 'me.is_muted as my_muted', 'me.role as my_role')
            ->selectSub(fn ($q) => $messenger->unreadMessages($q->selectRaw('count(*)'), $viewer->id, 'me'), 'unread_count')
            ->withCount('activeParticipants as members_count')
            ->with(['lastMessage' => fn ($q) => $q->with('user')->withCount('attachments')])
            ->where(fn ($q) => $q->whereNotNull('conversations.last_message_id')->when($includeId, fn ($q, int $id) => $q->orWhere('conversations.id', $id)))
            ->orderByDesc('conversations.last_message_at')
            ->orderByDesc('conversations.id')
            ->limit(100)
            ->get();

        $peers = $this->peers($conversations, $viewer);

        return $conversations->map(fn (Conversation $c) => $this->summary($c, $viewer, $peers[$c->id] ?? null))->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function summary(Conversation $conversation, User $viewer, ?User $peer): array
    {
        $last = $conversation->lastMessage;

        return [
            'id' => $conversation->id,
            'type' => $conversation->type,
            'title' => $conversation->isGroup() ? $conversation->title : ($peer?->name ?? 'Видалений акаунт'),
            'avatar_url' => $conversation->isGroup() ? $conversation->avatar_url : $peer?->avatar_url,
            'peer' => $peer?->toCard(),
            'members_count' => (int) ($conversation->members_count ?? 0),
            'unread' => (int) ($conversation->unread_count ?? 0),
            'is_muted' => (bool) ($conversation->my_muted ?? false),
            'last_message' => $last ? [
                'id' => $last->id,
                'type' => $last->type,
                'body' => $last->body !== null ? Str::limit($last->body, 90) : null,
                'author' => $last->user?->first_name,
                'is_own' => $last->user_id === $viewer->id,
                'has_attachments' => ($last->attachments_count ?? 0) > 0,
                'created_at' => $last->created_at->toIso8601String(),
            ] : null,
        ];
    }

    /**
     * Повна інформація про відкриту бесіду: учасники, права глядача, межа прочитаного.
     *
     * @return array<string, mixed>
     */
    public function details(Conversation $conversation, User $viewer, ConversationParticipant $me, Messenger $messenger): array
    {
        $participants = $conversation->activeParticipants()->with('user')->get();
        $peer = $conversation->isGroup() ? null : $participants->firstWhere('user_id', '!=', $viewer->id)?->user;

        $others = $participants->where('user_id', '!=', $viewer->id);

        return [
            'id' => $conversation->id,
            'type' => $conversation->type,
            'title' => $conversation->isGroup() ? $conversation->title : ($peer?->name ?? 'Видалений акаунт'),
            'avatar_url' => $conversation->isGroup() ? $conversation->avatar_url : $peer?->avatar_url,
            'peer' => $peer ? [...$peer->toCard(), 'last_seen_at' => $peer->last_seen_at?->toIso8601String(), 'gender' => $peer->gender] : null,
            'can_write' => $conversation->isGroup() || ($peer !== null && $messenger->canMessage($viewer, $peer)),
            'is_muted' => $me->is_muted,
            'my_role' => $me->role,
            'read_up_to' => (int) $others->max('last_read_message_id'),
            'members' => $conversation->isGroup()
                ? $participants
                    ->sortBy(fn (ConversationParticipant $p) => [$p->role === ConversationParticipant::ROLE_OWNER ? 0 : ($p->role === ConversationParticipant::ROLE_ADMIN ? 1 : 2), $p->user->name])
                    ->map(fn (ConversationParticipant $p) => [...$p->user->toCard(), 'role' => $p->role])
                    ->values()
                    ->all()
                : [],
            'members_count' => $participants->count(),
        ];
    }

    /**
     * Співрозмовники в особистих діалогах.
     *
     * @param  Collection<int, Conversation>  $conversations
     * @return array<int, User>
     */
    private function peers(Collection $conversations, User $viewer): array
    {
        $directIds = $conversations->where('type', Conversation::TYPE_DIRECT)->pluck('id');

        if ($directIds->isEmpty()) {
            return [];
        }

        return ConversationParticipant::query()
            ->with('user')
            ->whereIn('conversation_id', $directIds)
            ->where('user_id', '!=', $viewer->id)
            ->get()
            ->mapWithKeys(fn (ConversationParticipant $p) => [$p->conversation_id => $p->user])
            ->all();
    }
}
