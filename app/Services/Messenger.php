<?php

namespace App\Services;

use App\Events\Messenger\ConversationRead;
use App\Events\Messenger\ConversationUpdated;
use App\Events\Messenger\InboxUpdated;
use App\Events\Messenger\MessageDeleted;
use App\Events\Messenger\MessageSent;
use App\Events\Messenger\MessageUpdated;
use App\Models\CommunityChannel;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\MessageReaction;
use App\Models\Sticker;
use App\Models\User;
use App\Models\UserBlock;
use App\Services\Communities\CommunityChannels;
use App\Services\Push\PushNotifier;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class Messenger
{
    public function __construct(
        private readonly FriendshipService $friendships,
        private readonly ImageStorage $images,
        private readonly MessengerPresenter $presenter,
    ) {}

    public function canMessage(User $from, User $to): bool
    {
        if ($from->is($to) || $to->isBanned() || UserBlock::either($from, $to)) {
            return false;
        }

        if ($to->message_privacy === User::MESSAGES_FRIENDS) {
            return $this->friendships->status($from, $to) === FriendshipService::FRIENDS;
        }

        return true;
    }

    /**
     * Особистий діалог пари користувачів; створюється при першому зверненні.
     */
    public function direct(User $a, User $b): Conversation
    {
        $key = Conversation::directKey($a->id, $b->id);

        if ($existing = Conversation::query()->where('direct_key', $key)->first()) {
            return $existing;
        }

        try {
            return DB::transaction(function () use ($a, $b, $key) {
                $conversation = Conversation::query()->create(['type' => Conversation::TYPE_DIRECT, 'direct_key' => $key]);

                foreach ([$a, $b] as $user) {
                    $conversation->participants()->create([
                        'user_id' => $user->id,
                        'role' => ConversationParticipant::ROLE_MEMBER,
                        'joined_at' => now(),
                    ]);
                }

                return $conversation;
            });
        } catch (QueryException) {
            return Conversation::query()->where('direct_key', $key)->firstOrFail();
        }
    }

    /**
     * @param  list<int>  $userIds
     */
    public function createGroup(User $owner, string $title, array $userIds): Conversation
    {
        $members = $this->invitableFriends($owner, $userIds);

        if ($members === []) {
            throw ValidationException::withMessages(['user_ids' => 'Додайте хоча б одного друга.']);
        }

        return DB::transaction(function () use ($owner, $title, $members) {
            $conversation = Conversation::query()->create([
                'type' => Conversation::TYPE_GROUP,
                'title' => $title,
                'owner_id' => $owner->id,
            ]);

            $conversation->participants()->create([
                'user_id' => $owner->id,
                'role' => ConversationParticipant::ROLE_OWNER,
                'joined_at' => now(),
            ]);

            foreach ($members as $id) {
                $conversation->participants()->create([
                    'user_id' => $id,
                    'role' => ConversationParticipant::ROLE_MEMBER,
                    'joined_at' => now(),
                ]);
            }

            $this->system($conversation, $owner, $this->verb($owner, 'створив', 'створила')." бесіду «{$title}»");

            return $conversation;
        });
    }

    /**
     * @param  list<int>  $userIds
     */
    public function addMembers(Conversation $conversation, User $actor, array $userIds): int
    {
        $this->ensureGroup($conversation);

        $alreadyIn = $conversation->activeParticipants()->pluck('user_id')->all();
        $ids = array_values(array_diff($this->invitableFriends($actor, $userIds), $alreadyIn));
        // Виключених на час не можна повернути, доки строк не мине.
        $banned = $conversation->participants()->whereIn('user_id', $ids)->where('banned_until', '>', now())->pluck('user_id')->all();
        if ($banned !== [] && count($banned) === count($ids)) {
            throw ValidationException::withMessages(['user_ids' => 'Цю людину виключено з бесіди на час — додати її можна буде пізніше.']);
        }
        $ids = array_values(array_diff($ids, $banned));

        if (count($alreadyIn) + count($ids) > Conversation::MAX_MEMBERS) {
            throw ValidationException::withMessages(['user_ids' => 'У бесіді може бути не більше '.Conversation::MAX_MEMBERS.' учасників.']);
        }

        if ($ids === []) {
            return 0;
        }

        DB::transaction(function () use ($conversation, $actor, $ids) {
            foreach ($ids as $id) {
                ConversationParticipant::query()->updateOrCreate(
                    ['conversation_id' => $conversation->id, 'user_id' => $id],
                    ['role' => ConversationParticipant::ROLE_MEMBER, 'joined_at' => now(), 'left_at' => null, 'last_read_message_id' => $conversation->last_message_id],
                );
            }

            $names = User::query()->whereIn('id', $ids)->pluck('name')->implode(', ');
            $this->system($conversation, $actor, $this->verb($actor, 'додав', 'додала')." {$names}");
        });

        $this->broadcastUpdated($conversation);

        return count($ids);
    }

    public function removeMember(Conversation $conversation, User $actor, User $target): void
    {
        $this->ensureGroup($conversation);

        $actorRow = $conversation->participantFor($actor);
        $targetRow = $conversation->participantFor($target);
        abort_if($actorRow === null || $targetRow === null, 404);

        $leaving = $actor->is($target);
        abort_unless($leaving || ($actorRow->canManage() && $targetRow->role !== ConversationParticipant::ROLE_OWNER), 403);

        DB::transaction(function () use ($conversation, $actor, $target, $targetRow, $leaving) {
            $targetRow->update(['left_at' => now(), 'role' => ConversationParticipant::ROLE_MEMBER]);

            if ($conversation->owner_id === $target->id) {
                $heir = $conversation->activeParticipants()
                    ->orderByRaw("case when role = 'admin' then 0 else 1 end")
                    ->orderBy('joined_at')
                    ->first();

                $heir?->update(['role' => ConversationParticipant::ROLE_OWNER]);
                $conversation->update(['owner_id' => $heir?->user_id]);
            }

            $this->system(
                $conversation,
                $actor,
                $leaving
                    ? $this->verb($actor, 'вийшов', 'вийшла').' з бесіди'
                    : $this->verb($actor, 'виключив', 'виключила')." {$target->name}",
            );
        });

        $this->broadcastUpdated($conversation);
    }

    public function rename(Conversation $conversation, User $actor, string $title): void
    {
        $this->ensureGroup($conversation);

        if ($conversation->title === $title) {
            return;
        }

        $conversation->update(['title' => $title]);
        $this->system($conversation, $actor, $this->verb($actor, 'змінив', 'змінила')." назву на «{$title}»");
        $this->broadcastUpdated($conversation);
    }

    /**
     * @param  list<UploadedFile>  $images
     * @param  list<UploadedFile>  $documents
     * @param  array{kind: string, id: int, title: string, hint: string, href: string, image: string|null}|null  $card
     */
    public function send(Conversation $conversation, User $sender, ?string $body, array $images = [], ?int $replyToId = null, array $documents = [], ?CarbonInterface $publishAt = null, ?CarbonInterface $expiresAt = null, ?array $card = null): Message
    {
        $body = $body !== null ? trim($body) : null;

        if (($body === null || $body === '') && $images === [] && $documents === [] && $card === null) {
            throw ValidationException::withMessages(['body' => 'Повідомлення порожнє.']);
        }

        $attributes = [
            'type' => Message::TYPE_TEXT,
            'body' => $body === '' ? null : $body,
        ];
        if ($card !== null) {
            $attributes['meta'] = ['card' => $card];
        }
        if ($publishAt?->isFuture()) {
            $attributes['publish_at'] = $publishAt;
        }
        if ($expiresAt?->isFuture()) {
            $attributes['expires_at'] = $expiresAt;
        }

        return $this->deliver($conversation, $sender, $attributes, $replyToId, function (Message $message) use ($images, $documents) {
            $position = 0;

            foreach ($images as $file) {
                $message->attachments()->create([
                    'type' => MessageAttachment::TYPE_IMAGE,
                    ...$this->images->store($file, 'messages'),
                    'position' => $position++,
                ]);
            }

            foreach ($documents as $file) {
                $message->attachments()->create([
                    'type' => MessageAttachment::TYPE_FILE,
                    'disk' => MessageAttachment::PRIVATE_DISK,
                    'path' => $file->store('message-files/'.now()->format('Y/m'), MessageAttachment::PRIVATE_DISK),
                    'name' => Str::limit($this->cleanName($file->getClientOriginalName()), 180, ''),
                    'mime' => Str::limit((string) $file->getClientMimeType(), 64, ''),
                    'size' => $file->getSize(),
                    'position' => $position++,
                ]);
            }
        });
    }

    /**
     * Повідомлення гостя без акаунта (гостьовий чат каналу спільноти): без автора, з іменем у meta.
     * Відбиток IP — лише хеш, щоб адміністрація могла відсікти спамера.
     */
    public function sendAsGuest(Conversation $conversation, string $name, string $body, string $ipHash): Message
    {
        $message = DB::transaction(function () use ($conversation, $name, $body, $ipHash) {
            $message = $conversation->messages()->create([
                'type' => Message::TYPE_TEXT,
                'body' => trim($body),
                'user_id' => null,
                'meta' => ['guest' => ['name' => $name, 'ip' => $ipHash]],
            ]);
            $this->touch($conversation, $message);

            return $message;
        });
        $this->broadcastNew($conversation, $message);

        return $message;
    }

    public function sendSticker(Conversation $conversation, User $sender, Sticker $sticker, ?int $replyToId = null): Message
    {
        return $this->deliver($conversation, $sender, [
            'type' => Message::TYPE_STICKER,
            'meta' => ['sticker' => ['id' => $sticker->id, 'path' => $sticker->path, 'emoji' => $sticker->emoji]],
        ], $replyToId);
    }

    /**
     * @param  list<int>  $waveform  Нормалізовані піки 0–100 для відмальовування хвилі.
     */
    public function sendVoice(Conversation $conversation, User $sender, UploadedFile $audio, int $duration, array $waveform, ?int $replyToId = null): Message
    {
        $extension = match (true) {
            str_contains((string) $audio->getMimeType(), 'ogg') => 'ogg',
            str_contains((string) $audio->getMimeType(), 'mp4'), str_contains((string) $audio->getMimeType(), 'm4a') => 'm4a',
            str_contains((string) $audio->getMimeType(), 'mpeg') => 'mp3',
            default => 'webm',
        };

        return $this->deliver($conversation, $sender, ['type' => Message::TYPE_VOICE], $replyToId, function (Message $message) use ($audio, $duration, $waveform, $extension) {
            $message->attachments()->create([
                'type' => MessageAttachment::TYPE_VOICE,
                'path' => $audio->storeAs('voice/'.now()->format('Y/m'), Str::random(32).'.'.$extension, 'public'),
                'mime' => Str::limit((string) $audio->getMimeType(), 64, ''),
                'size' => $audio->getSize(),
                'duration' => $duration,
                'meta' => ['waveform' => array_map(fn ($v) => max(0, min(100, (int) $v)), array_slice($waveform, 0, 64))],
            ]);
        });
    }

    /** Відеоповідомлення-кружок (до хвилини, з камери). */
    public function sendVideoNote(Conversation $conversation, User $sender, UploadedFile $video, int $duration, ?int $replyToId = null): Message
    {
        $extension = str_contains((string) $video->getMimeType(), 'mp4') ? 'mp4' : 'webm';

        return $this->deliver($conversation, $sender, ['type' => Message::TYPE_VIDEO_NOTE], $replyToId, function (Message $message) use ($video, $duration, $extension) {
            $message->attachments()->create([
                'type' => MessageAttachment::TYPE_VIDEO_NOTE,
                'path' => $video->storeAs('video-notes/'.now()->format('Y/m'), Str::random(32).'.'.$extension, 'public'),
                'mime' => Str::limit((string) $video->getMimeType(), 64, ''),
                'size' => $video->getSize(),
                'duration' => $duration,
            ]);
        });
    }

    /**
     * Реакція на повідомлення: одна на людину; та сама ще раз — прибрати. Усім у бесіді — оновлене повідомлення.
     */
    public function react(Message $message, User $user, ?string $emoji): Message
    {
        $current = MessageReaction::query()->where('message_id', $message->id)->where('user_id', $user->id)->value('emoji');
        MessageReaction::query()->where('message_id', $message->id)->where('user_id', $user->id)->delete();
        if ($emoji !== null && $emoji !== $current) {
            MessageReaction::query()->create(['message_id' => $message->id, 'user_id' => $user->id, 'emoji' => $emoji, 'created_at' => now()]);
        }
        $message->unsetRelation('reactions');
        $payload = $this->presenter->message($this->presenter->load($message));
        $this->broadcast(new MessageUpdated($message->conversation_id, $payload));

        return $message;
    }

    public function sendContact(Conversation $conversation, User $sender, User $contact, ?int $replyToId = null): Message
    {
        return $this->deliver($conversation, $sender, [
            'type' => Message::TYPE_CONTACT,
            'meta' => ['contact_id' => $contact->id],
        ], $replyToId);
    }

    public function forward(Conversation $target, User $sender, Message $source): Message
    {
        $source->loadMissing(['user', 'attachments']);
        $meta = $source->meta ?? [];
        $meta['forward'] = [
            'name' => $source->user->name ?? 'GameCon',
            'username' => $source->user?->username,
        ];

        return $this->deliver($target, $sender, [
            'type' => $source->type,
            'body' => $source->body,
            'meta' => $meta,
        ], null, function (Message $copy) use ($source): void {
            foreach ($source->attachments as $attachment) {
                $copy->attachments()->create($attachment->only([
                    'type', 'disk', 'path', 'name', 'mime', 'width', 'height', 'size', 'duration', 'meta', 'position',
                ]));
            }
        });
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  (callable(Message): void)|null  $attach
     */
    private function deliver(Conversation $conversation, User $sender, array $attributes, ?int $replyToId, ?callable $attach = null): Message
    {
        if ($replyToId !== null && ! $conversation->messages()->whereKey($replyToId)->exists()) {
            $replyToId = null;
        }

        $publishAt = $attributes['publish_at'] ?? null;
        $scheduled = $publishAt instanceof CarbonInterface && $publishAt->isFuture();

        $message = DB::transaction(function () use ($conversation, $sender, $attributes, $replyToId, $attach, $scheduled) {
            $message = $conversation->messages()->create([
                ...$attributes,
                'user_id' => $sender->id,
                'reply_to_id' => $replyToId,
            ]);

            if ($attach) {
                $attach($message);
            }

            if (! $scheduled) {
                $this->touch($conversation, $message);
                $conversation->participants()->where('user_id', $sender->id)->update(['last_read_message_id' => $message->id]);
            }

            return $message;
        });

        if (! $scheduled) {
            $this->broadcastNew($conversation, $message);
        }

        return $message;
    }

    public function publishDue(): int
    {
        $count = 0;
        Message::query()
            ->whereNotNull('publish_at')
            ->where('publish_at', '<=', now())
            ->orderBy('id')
            ->limit(100)
            ->get()
            ->each(function (Message $message) use (&$count): void {
                $when = $message->publish_at ?? now();
                $message->forceFill(['publish_at' => null, 'created_at' => $when])->save();
                $conversation = $message->conversation;
                $this->touch($conversation, $message);
                if ($message->user_id) {
                    $conversation->participants()->where('user_id', $message->user_id)->update(['last_read_message_id' => $message->id]);
                }
                $this->broadcastNew($conversation, $message);
                $count++;
            });

        return $count;
    }

    public function expireDue(): int
    {
        $count = 0;
        Message::query()
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->orderBy('id')
            ->limit(100)
            ->get()
            ->each(function (Message $message) use (&$count): void {
                if (! $message->trashed()) {
                    $this->remove($message);
                    $count++;
                }
            });

        return $count;
    }

    private function cleanName(string $name): string
    {
        $name = preg_replace('/[\x00-\x1F\x7F\/\\\\]+/u', '', $name) ?? '';

        return trim($name) !== '' ? trim($name) : 'file';
    }

    public function edit(Message $message, User $user, string $body): Message
    {
        abort_unless($message->isEditableBy($user), 403, 'Редагувати можна лише власні повідомлення протягом доби.');

        $message->update(['body' => trim($body), 'edited_at' => now()]);

        $payload = $this->presenter->message($this->presenter->load($message));
        $this->broadcast(new MessageUpdated($message->conversation_id, $payload));

        return $message;
    }

    public function delete(Message $message, User $user): void
    {
        $conversation = $message->conversation;
        $row = $conversation->participantFor($user);

        abort_unless(
            $message->type !== Message::TYPE_SYSTEM && ($message->user_id === $user->id || ($conversation->isGroup() && $row?->canManage())),
            403,
        );

        $this->remove($message);
    }

    /** Видалення модератором за скаргою: без перевірки прав учасника. */
    public function moderatorDelete(Message $message): void
    {
        if (! $message->trashed()) {
            $this->remove($message);
        }
    }

    private function remove(Message $message): void
    {
        $conversation = $message->conversation;

        DB::transaction(function () use ($message, $conversation) {
            $message->delete();

            if ($conversation->last_message_id === $message->id) {
                $previous = $conversation->messages()
                    ->where(fn ($query) => $query->whereNull('publish_at')->orWhere('publish_at', '<=', now()))
                    ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
                    ->latest('id')
                    ->first();
                $conversation->update([
                    'last_message_id' => $previous?->id,
                    'last_message_at' => $previous !== null ? $previous->created_at : $conversation->last_message_at,
                ]);
            }
        });

        $this->broadcast(new MessageDeleted($conversation->id, $message->id));
    }

    public function markRead(Conversation $conversation, User $user, int $messageId): void
    {
        $messageId = min($messageId, (int) $conversation->last_message_id);
        $me = $conversation->participantFor($user);

        $conversation->participants()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->update(['marked_unread' => false]);

        $updated = $conversation->participants()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->where(fn (Builder $q) => $q->whereNull('last_read_message_id')->orWhere('last_read_message_id', '<', $messageId))
            ->update(['last_read_message_id' => $messageId]);

        if ($updated) {
            if ($me?->share_receipts !== false) {
                $this->broadcast(new ConversationRead($conversation->id, $user->id, $messageId));
            }
            $this->broadcast(new InboxUpdated($user->id, $conversation->id, null));
        }
    }

    public function markUnread(Conversation $conversation, User $user): void
    {
        $conversation->participants()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->update(['marked_unread' => true]);
    }

    public function setMuted(Conversation $conversation, User $user, bool $muted): void
    {
        $conversation->participants()->where('user_id', $user->id)->update(['is_muted' => $muted]);
    }

    public function setSlow(Conversation $conversation, User $actor, int $seconds): void
    {
        $this->ensureGroup($conversation);
        abort_unless($conversation->participantFor($actor)?->canManage(), 403);
        abort_unless(in_array($seconds, [0, 10, 30, 60], true), 422);
        $conversation->forceFill(['slow_seconds' => $seconds])->save();
    }

    /**
     * Автомодерація групи (керують власник і адміни): посилання, капс, флуд, свої заборонені слова.
     *
     * @param  array{links?: bool, caps?: bool, flood?: bool, words?: list<string>}  $settings
     */
    public function setAutomod(Conversation $conversation, User $actor, array $settings): void
    {
        $this->ensureGroup($conversation);
        abort_unless($conversation->participantFor($actor)?->canManage(), 403);
        $words = array_values(array_unique(array_filter(array_map(
            fn ($w) => mb_strtolower(trim((string) $w)),
            array_slice($settings['words'] ?? [], 0, 50),
        ), fn (string $w) => $w !== '' && mb_strlen($w) <= 40)));
        $conversation->forceFill(['automod' => [
            'links' => (bool) ($settings['links'] ?? false),
            'caps' => (bool) ($settings['caps'] ?? false),
            'flood' => (bool) ($settings['flood'] ?? false),
            'words' => $words,
        ]])->save();
    }

    public function setMemberRole(Conversation $conversation, User $actor, User $target, string $role): void
    {
        $this->ensureGroup($conversation);
        abort_unless($conversation->participantFor($actor)?->role === ConversationParticipant::ROLE_OWNER, 403);
        abort_unless(in_array($role, [ConversationParticipant::ROLE_ADMIN, ConversationParticipant::ROLE_MEMBER], true), 422);
        $row = $conversation->participantFor($target);
        abort_if($row === null || $row->role === ConversationParticipant::ROLE_OWNER || $actor->is($target), 422);
        $row->forceFill(['role' => $role])->save();
    }

    public function assertCanSend(Conversation $conversation, User $user): void
    {
        // Канал спільноти: «Оголошення» — лише адміністратори, приватний — лише ті, хто має доступ.
        if ($conversation->community_channel_id !== null) {
            $channel = CommunityChannel::query()->with('community')->find($conversation->community_channel_id);
            abort_unless($channel !== null && app(CommunityChannels::class)->canPost($channel, $user), 403, 'У цьому каналі пишуть лише адміністратори.');
        }
        // Тайм-аут від адміністраторів: читати можна, писати — ні до вказаного часу.
        $me = $conversation->participantFor($user);
        if ($me?->timedOut() && $me->timeout_until !== null) {
            abort(403, 'Вам тимчасово заборонено писати тут — до '.$me->timeout_until->timezone('Europe/Kyiv')->format('d.m H:i').'.');
        }
        $seconds = (int) $conversation->slow_seconds;
        if ($seconds <= 0 || ! $conversation->isGroup()) {
            return;
        }
        if ($conversation->participantFor($user)?->canManage()) {
            return;
        }
        $last = $conversation->messages()->where('user_id', $user->id)->latest('id')->first();
        if ($last && $last->created_at->gt(now()->subSeconds($seconds))) {
            throw ValidationException::withMessages(['body' => 'Повільний режим: зачекайте перед наступним повідомленням.']);
        }
    }

    /**
     * Кількість бесід з непрочитаними повідомленнями (без вимкнених сповіщень).
     */
    public function unreadConversations(User $user): int
    {
        return ConversationParticipant::query()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->where('is_muted', false)
            ->whereIn('conversation_id', Conversation::query()->whereNull('community_channel_id')->select('id'))
            ->where(fn ($query) => $query
                ->where('marked_unread', true)
                ->orWhereExists(fn ($q) => $this->unreadMessages($q, $user->id, 'conversation_participants')))
            ->count();
    }

    /**
     * Підзапит непрочитаних повідомлень для рядка учасника з таблиці $participants.
     */
    public function unreadMessages(QueryBuilder $query, int $userId, string $participants): void
    {
        $query->from('messages')
            ->whereColumn('messages.conversation_id', $participants === 'me' ? 'me.conversation_id' : 'conversation_participants.conversation_id')
            ->whereRaw($participants === 'me'
                ? 'messages.id > coalesce(me.last_read_message_id, 0)'
                : 'messages.id > coalesce(conversation_participants.last_read_message_id, 0)')
            ->whereNull('messages.deleted_at')
            ->where(fn ($q) => $q->whereNull('messages.publish_at')->orWhere('messages.publish_at', '<=', now()))
            ->where(fn ($q) => $q->whereNull('messages.expires_at')->orWhere('messages.expires_at', '>', now()))
            ->where(fn ($q) => $q->whereNull('messages.user_id')->orWhere('messages.user_id', '!=', $userId));
    }

    /**
     * @param  list<int>  $userIds
     * @return list<int>
     */
    private function invitableFriends(User $actor, array $userIds): array
    {
        $friendIds = $this->friendships->friendIds($actor);

        return array_values(array_unique(array_map('intval', array_intersect($userIds, $friendIds))));
    }

    private function ensureGroup(Conversation $conversation): void
    {
        abort_unless($conversation->isGroup(), 422, 'Дія доступна лише в груповій бесіді.');
        abort_if($conversation->isFamily(), 422, 'Учасниками чату сім’ї керує сама сім’я.');
    }

    /**
     * Системне повідомлення без автора (бот сім’ї, тижневі звіти).
     *
     * @param  array<string, mixed>  $meta
     */
    public function announce(Conversation $conversation, string $text, array $meta = []): Message
    {
        $message = $conversation->messages()->create([
            'user_id' => null,
            'type' => Message::TYPE_SYSTEM,
            'body' => $text,
            'meta' => $meta ?: null,
        ]);

        $this->touch($conversation, $message);
        DB::afterCommit(fn () => $this->broadcastNew($conversation, $message));

        return $message;
    }

    /** Службовий рядок у бесіді від імені людини («… обмежив …») і оновлення бесіди в усіх. */
    public function noticeBy(Conversation $conversation, User $actor, string $text): Message
    {
        $message = DB::transaction(fn () => $this->system($conversation, $actor, $text));
        $this->broadcastUpdated($conversation);

        return $message;
    }

    public function genderVerb(User $user, string $male, string $female): string
    {
        return $this->verb($user, $male, $female);
    }

    private function system(Conversation $conversation, User $actor, string $text): Message
    {
        $message = $conversation->messages()->create([
            'user_id' => null,
            'type' => Message::TYPE_SYSTEM,
            'body' => "{$actor->name} {$text}",
            'meta' => ['actor_id' => $actor->id],
        ]);

        $this->touch($conversation, $message);
        $conversation->participants()->where('user_id', $actor->id)->update(['last_read_message_id' => $message->id]);

        DB::afterCommit(fn () => $this->broadcastNew($conversation, $message));

        return $message;
    }

    private function touch(Conversation $conversation, Message $message): void
    {
        $conversation->forceFill(['last_message_id' => $message->id, 'last_message_at' => $message->created_at])->save();
    }

    private function verb(User $user, string $male, string $female): string
    {
        return match ($user->gender) {
            'female' => $female,
            'male' => $male,
            default => "{$male}(-ла)",
        };
    }

    private function broadcastNew(Conversation $conversation, Message $message): void
    {
        $payload = $this->presenter->message($this->presenter->load($message));
        $this->broadcast(new MessageSent($conversation->id, $payload));

        $conversation->activeParticipants()->pluck('user_id')->each(
            fn (int $userId) => $this->broadcast(new InboxUpdated($userId, $conversation->id, $payload)),
        );

        // Push у застосунок — як і реальний час, не має ламати відправку повідомлення.
        rescue(fn () => app(PushNotifier::class)->message($conversation, $message, $payload), report: true);
    }

    private function broadcastUpdated(Conversation $conversation): void
    {
        $this->broadcast(new ConversationUpdated($conversation->id));
    }

    /**
     * Реальний час — бонус: якщо Reverb недоступний, повідомлення все одно зберігається.
     */
    private function broadcast(object $event): void
    {
        rescue(fn () => broadcast($event), report: true);
    }
}
