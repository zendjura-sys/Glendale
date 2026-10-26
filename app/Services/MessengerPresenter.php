<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\MessageFavorite;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MessengerPresenter
{
    public const PAGE = 40;

    /** @var array<int, User|null> */
    private array $contacts = [];

    /** @var array<int, array{family: Family, members: Collection<int, FamilyMember>}|null> */
    private array $families = [];

    public function load(Message $message): Message
    {
        return $message->loadMissing(['user', 'attachments', 'reactions', 'replyTo.user', 'replyTo.attachments']);
    }

    /**
     * @return array<string, mixed>
     */
    public function message(Message $message, bool $starred = false): array
    {
        $reply = $message->replyTo;
        $meta = $message->meta ?? [];
        $forward = is_array($meta['forward'] ?? null) ? $meta['forward'] : null;

        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'type' => $message->type,
            'body' => $message->body,
            'user' => $this->author($message->conversation_id, $message->user),
            'reply_to' => $reply ? [
                'id' => $reply->id,
                'body' => $reply->trashed() ? null : Str::limit((string) $reply->body, 120),
                'preview' => $reply->trashed() ? null : $this->preview($reply),
                'author' => $this->author($message->conversation_id, $reply->user)['first_name'] ?? null,
                'has_attachments' => ! $reply->trashed() && $reply->attachments->isNotEmpty(),
                'deleted' => $reply->trashed(),
            ] : null,
            'preview' => $this->preview($message),
            'attachments' => $message->attachments->map(fn (MessageAttachment $a) => [
                'id' => $a->id,
                'type' => $a->type,
                'url' => $a->url,
                'width' => $a->width,
                'height' => $a->height,
                'name' => $a->name,
                'mime' => $a->mime,
                'size' => $a->size,
                'duration' => $a->duration,
                'waveform' => $a->meta['waveform'] ?? null,
            ])->all(),
            'sticker' => $message->type === Message::TYPE_STICKER && isset($message->meta['sticker']['path']) ? [
                'id' => $message->meta['sticker']['id'] ?? null,
                'url' => Storage::disk('public')->url($message->meta['sticker']['path']),
                'emoji' => $message->meta['sticker']['emoji'] ?? null,
            ] : null,
            'contact' => $message->type === Message::TYPE_CONTACT ? $this->contact($message)?->toCard() : null,
            'edited_at' => $message->edited_at?->toIso8601String(),
            'publish_at' => $message->publish_at?->isFuture() ? $message->publish_at->toIso8601String() : null,
            'expires_at' => $message->expires_at?->isFuture() ? $message->expires_at->toIso8601String() : null,
            'created_at' => $message->created_at->toIso8601String(),
            'starred' => $starred,
            'reactions' => $this->reactions($message),
            'card' => is_array($meta['card'] ?? null) && is_string($meta['card']['title'] ?? null) && is_string($meta['card']['href'] ?? null) ? [
                'kind' => (string) ($meta['card']['kind'] ?? ''),
                'id' => (int) ($meta['card']['id'] ?? 0),
                'title' => $meta['card']['title'],
                'hint' => (string) ($meta['card']['hint'] ?? ''),
                'href' => $meta['card']['href'],
                'image' => is_string($meta['card']['image'] ?? null) ? $meta['card']['image'] : null,
            ] : null,
            'forward' => is_array($forward) && is_string($forward['name'] ?? null) ? [
                'name' => $forward['name'],
                'username' => is_string($forward['username'] ?? null) ? $forward['username'] : null,
            ] : null,
        ];
    }

    /**
     * Реакції під повідомленням: емодзі, скільки й хто (id — щоб клієнт знав свою; до 30 на емодзі).
     *
     * @return list<array{emoji: string, count: int, user_ids: list<int>}>
     */
    private function reactions(Message $message): array
    {
        if (! $message->relationLoaded('reactions')) {
            return [];
        }
        $groups = [];
        foreach ($message->reactions->sortBy('created_at') as $reaction) {
            $groups[$reaction->emoji] ??= ['emoji' => $reaction->emoji, 'count' => 0, 'user_ids' => []];
            $groups[$reaction->emoji]['count']++;
            if (count($groups[$reaction->emoji]['user_ids']) < 30) {
                $groups[$reaction->emoji]['user_ids'][] = $reaction->user_id;
            }
        }

        return array_values($groups);
    }

    /**
     * Картка автора; у чаті сім’ї — RP-нікнейм [Static ID] і ранг замість справжнього імені.
     *
     * @return array<string, mixed>|null
     */
    public function author(int $conversationId, ?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        $card = $user->toCard();
        $context = $this->familyContext($conversationId);
        $member = $context['members'][$user->id] ?? null;

        if ($context && $member) {
            $card['name'] = $member->displayName();
            $card['first_name'] = $member->rp_nickname;
            $card['family_rank'] = [
                'rank' => $member->rank,
                'title' => $context['family']->rankTitle($member->rank),
                'tag' => $context['family']->tag,
            ];
        }

        return $card;
    }

    /**
     * @return array{family: Family, members: Collection<int, FamilyMember>}|null
     */
    private function familyContext(int $conversationId): ?array
    {
        if (! array_key_exists($conversationId, $this->families)) {
            $family = Family::query()->where('conversation_id', $conversationId)->first();
            $this->families[$conversationId] = $family ? [
                'family' => $family,
                'members' => FamilyMember::query()->where('family_id', $family->id)->get()->keyBy('user_id'),
            ] : null;
        }

        return $this->families[$conversationId];
    }

    /**
     * Короткий текст для списку бесід, відповідей і сповіщень.
     */
    public function preview(Message $message): string
    {
        return match ($message->type) {
            Message::TYPE_STICKER => trim(($message->meta['sticker']['emoji'] ?? '').' Стікер'),
            Message::TYPE_VOICE => 'Голосове повідомлення',
            Message::TYPE_VIDEO_NOTE => 'Відеоповідомлення',
            Message::TYPE_CONTACT => 'Контакт: '.(($contact = $this->contact($message)) instanceof User ? $contact->name : 'видалений акаунт'),
            default => $this->textPreview($message),
        };
    }

    private function textPreview(Message $message): string
    {
        if ($message->body !== null && $message->body !== '') {
            return $message->body;
        }

        $stored = $message->meta ?? [];
        $card = $stored['card'] ?? null;
        if (is_array($card) && is_string($card['title'] ?? null)) {
            return $card['title'];
        }

        $attachments = $message->attachments;
        $file = $attachments->firstWhere('type', MessageAttachment::TYPE_FILE);

        return match (true) {
            $file !== null => 'Файл: '.$file->name,
            $attachments->count() > 1 => 'Фотографії',
            $attachments->isNotEmpty() => 'Фотографія',
            default => 'Повідомлення',
        };
    }

    private function contact(Message $message): ?User
    {
        $id = (int) ($message->meta['contact_id'] ?? 0);

        if (! array_key_exists($id, $this->contacts)) {
            $this->contacts[$id] = User::query()->find($id);
        }

        return $this->contacts[$id];
    }

    /**
     * @param  iterable<Message>  $messages
     */
    private function preloadContacts(iterable $messages): void
    {
        $ids = collect($messages)
            ->filter(fn (Message $m) => $m->type === Message::TYPE_CONTACT)
            ->map(fn (Message $m) => (int) ($m->meta['contact_id'] ?? 0))
            ->reject(fn (int $id) => array_key_exists($id, $this->contacts))
            ->unique();

        if ($ids->isEmpty()) {
            return;
        }

        $found = User::query()->whereIn('id', $ids)->get()->keyBy('id');
        foreach ($ids as $id) {
            $this->contacts[$id] = $found[$id] ?? null;
        }
    }

    /**
     * Останні повідомлення (або старіші за $beforeId) у хронологічному порядку.
     *
     * @return array{messages: list<array<string, mixed>>, has_more: bool}
     */
    public function history(Conversation $conversation, ?int $beforeId = null, ?User $viewer = null): array
    {
        $messages = $conversation->messages()
            ->with(['user', 'attachments', 'reactions', 'replyTo.user', 'replyTo.attachments'])
            ->where(function ($query) use ($viewer) {
                $query->where(fn ($visible) => $visible
                    ->where(fn ($q) => $q->whereNull('publish_at')->orWhere('publish_at', '<=', now()))
                    ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now())));
                if ($viewer) {
                    $query->orWhere(fn ($own) => $own->where('user_id', $viewer->id)->where('publish_at', '>', now()));
                }
            })
            ->when($beforeId, fn ($q, int $id) => $q->where('id', '<', $id))
            ->orderByDesc('id')
            ->limit(self::PAGE + 1)
            ->get();

        $hasMore = $messages->count() > self::PAGE;
        $page = $messages->take(self::PAGE);
        $this->preloadContacts($messages->concat($messages->pluck('replyTo')->filter()));
        $starred = $viewer === null ? [] : array_map('intval', MessageFavorite::query()
            ->where('user_id', $viewer->id)
            ->whereIn('message_id', $page->pluck('id'))
            ->pluck('message_id')
            ->all());

        return [
            'messages' => array_values($page->reverse()->map(fn (Message $m) => $this->message($m, in_array($m->id, $starred, true)))->all()),
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
            ->select('conversations.*', 'me.is_muted as my_muted', 'me.role as my_role', 'me.pinned_at as my_pinned_at', 'me.folder as my_folder', 'me.marked_unread as my_marked_unread')
            ->selectSub(fn ($q) => $messenger->unreadMessages($q->selectRaw('count(*)'), $viewer->id, 'me'), 'unread_count')
            ->withCount('activeParticipants as members_count')
            ->with(['lastMessage' => fn ($q) => $q->with(['user', 'attachments'])])
            ->where(fn ($q) => $q->whereNotNull('conversations.last_message_id')->when($includeId, fn ($q, int $id) => $q->orWhere('conversations.id', $id)))
            ->orderByRaw('case when me.pinned_at is null then 1 else 0 end')
            ->orderByDesc('me.pinned_at')
            ->orderByDesc('conversations.last_message_at')
            ->orderByDesc('conversations.id')
            ->limit(100)
            ->get();

        $peers = $this->peers($conversations, $viewer);
        $this->preloadContacts($conversations->pluck('lastMessage')->filter());

        return array_values($conversations->map(fn (Conversation $c) => $this->summary($c, $viewer, $peers[$c->id] ?? null))->all());
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
            'title' => $conversation->isGroup() ? $conversation->title : ($peer !== null ? $peer->name : 'Видалений акаунт'),
            'avatar_url' => $conversation->isGroup() ? $conversation->avatar_url : $peer?->avatar_url,
            'peer' => $peer?->toCard(),
            'members_count' => (int) ($conversation->members_count ?? 0),
            'unread' => max((int) ($conversation->unread_count ?? 0), $conversation->getAttribute('my_marked_unread') ? 1 : 0),
            'is_muted' => (bool) ($conversation->my_muted ?? false),
            'pinned' => $conversation->getAttribute('my_pinned_at') !== null,
            'folder' => is_string($conversation->getAttribute('my_folder')) && $conversation->getAttribute('my_folder') !== ''
                ? $conversation->getAttribute('my_folder')
                : null,
            'last_message' => $last ? [
                'id' => $last->id,
                'type' => $last->type,
                'body' => $last->body !== null ? Str::limit($last->body, 90) : null,
                'preview' => Str::limit($this->preview($last), 90),
                'author' => $conversation->family_id ? ($this->author($conversation->id, $last->user)['first_name'] ?? null) : $last->user?->first_name,
                'is_own' => $last->user_id === $viewer->id,
                'has_attachments' => $last->relationLoaded('attachments') ? $last->attachments->isNotEmpty() : $last->attachments()->exists(),
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
            'title' => $conversation->isGroup() ? $conversation->title : ($peer !== null ? $peer->name : 'Видалений акаунт'),
            'avatar_url' => $conversation->isGroup() ? $conversation->avatar_url : $peer?->avatar_url,
            'peer' => $peer ? [...$peer->toCard(), 'last_seen_at' => $peer->last_seen_at?->toIso8601String(), 'gender' => $peer->gender] : null,
            'can_write' => $conversation->isGroup() || ($peer !== null && $messenger->canMessage($viewer, $peer)),
            'is_muted' => $me->is_muted,
            'slow_seconds' => (int) $conversation->slow_seconds,
            'share_receipts' => $me->share_receipts,
            'pinned' => $me->pinned_at !== null,
            'folder' => $me->folder,
            'my_role' => $me->role,
            'read_up_to' => (int) $others->filter(fn (ConversationParticipant $participant) => $participant->share_receipts)->max('last_read_message_id'),
            'members' => $conversation->isGroup()
                ? $participants
                    ->sortBy(fn (ConversationParticipant $p) => [$p->role === ConversationParticipant::ROLE_OWNER ? 0 : ($p->role === ConversationParticipant::ROLE_ADMIN ? 1 : 2), $p->user->name])
                    ->map(fn (ConversationParticipant $p) => [...($this->author($conversation->id, $p->user) ?? []), 'role' => $p->role])
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
