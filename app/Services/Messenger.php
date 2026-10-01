<?php

namespace App\Services;

use App\Events\Messenger\ConversationRead;
use App\Events\Messenger\ConversationUpdated;
use App\Events\Messenger\InboxUpdated;
use App\Events\Messenger\MessageDeleted;
use App\Events\Messenger\MessageSent;
use App\Events\Messenger\MessageUpdated;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\Sticker;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
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
        if ($from->is($to) || $to->isBanned()) {
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
     */
    public function send(Conversation $conversation, User $sender, ?string $body, array $images = [], ?int $replyToId = null, array $documents = []): Message
    {
        $body = $body !== null ? trim($body) : null;

        if (($body === null || $body === '') && $images === [] && $documents === []) {
            throw ValidationException::withMessages(['body' => 'Повідомлення порожнє.']);
        }

        return $this->deliver($conversation, $sender, [
            'type' => Message::TYPE_TEXT,
            'body' => $body === '' ? null : $body,
        ], $replyToId, function (Message $message) use ($images, $documents) {
            $position = 0;

            foreach (array_values($images) as $file) {
                $message->attachments()->create([
                    'type' => MessageAttachment::TYPE_IMAGE,
                    ...$this->images->store($file, 'messages'),
                    'position' => $position++,
                ]);
            }

            foreach (array_values($documents) as $file) {
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
                'meta' => ['waveform' => array_values(array_map(fn ($v) => max(0, min(100, (int) $v)), array_slice($waveform, 0, 64)))],
            ]);
        });
    }

    public function sendContact(Conversation $conversation, User $sender, User $contact, ?int $replyToId = null): Message
    {
        return $this->deliver($conversation, $sender, [
            'type' => Message::TYPE_CONTACT,
            'meta' => ['contact_id' => $contact->id],
        ], $replyToId);
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

        $message = DB::transaction(function () use ($conversation, $sender, $attributes, $replyToId, $attach) {
            $message = $conversation->messages()->create([
                ...$attributes,
                'user_id' => $sender->id,
                'reply_to_id' => $replyToId,
            ]);

            if ($attach) {
                $attach($message);
            }

            $this->touch($conversation, $message);
            $conversation->participants()->where('user_id', $sender->id)->update(['last_read_message_id' => $message->id]);

            return $message;
        });

        $this->broadcastNew($conversation, $message);

        return $message;
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

        DB::transaction(function () use ($message, $conversation) {
            $message->delete();

            if ($conversation->last_message_id === $message->id) {
                $previous = $conversation->messages()->latest('id')->first();
                $conversation->update([
                    'last_message_id' => $previous?->id,
                    'last_message_at' => $previous?->created_at ?? $conversation->last_message_at,
                ]);
            }
        });

        $this->broadcast(new MessageDeleted($conversation->id, $message->id));
    }

    public function markRead(Conversation $conversation, User $user, int $messageId): void
    {
        $messageId = min($messageId, (int) $conversation->last_message_id);

        $updated = $conversation->participants()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->where(fn (Builder $q) => $q->whereNull('last_read_message_id')->orWhere('last_read_message_id', '<', $messageId))
            ->update(['last_read_message_id' => $messageId]);

        if ($updated) {
            $this->broadcast(new ConversationRead($conversation->id, $user->id, $messageId));
            $this->broadcast(new InboxUpdated($user->id, $conversation->id, null));
        }
    }

    public function setMuted(Conversation $conversation, User $user, bool $muted): void
    {
        $conversation->participants()->where('user_id', $user->id)->update(['is_muted' => $muted]);
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
            ->whereExists(fn ($q) => $this->unreadMessages($q, $user->id, 'conversation_participants'))
            ->count();
    }

    /**
     * Підзапит непрочитаних повідомлень для рядка учасника з таблиці $participants.
     */
    public function unreadMessages($query, int $userId, string $participants): void
    {
        $query->from('messages')
            ->whereColumn('messages.conversation_id', "{$participants}.conversation_id")
            ->whereRaw("messages.id > coalesce({$participants}.last_read_message_id, 0)")
            ->whereNull('messages.deleted_at')
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
