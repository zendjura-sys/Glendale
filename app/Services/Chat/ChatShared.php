<?php

namespace App\Services\Chat;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use Illuminate\Database\Eloquent\Builder;

/**
 * «Матеріали чату»: усі фото й кружки, файли, посилання й голосові з бесіди — сторінками,
 * найновіші першими. Кожен елемент веде до свого повідомлення в історії.
 */
class ChatShared
{
    public const KINDS = ['media', 'files', 'links', 'voice'];

    private const PAGE = 40;

    private const URL = '~https?://[^\s<>"\']+~iu';

    /**
     * @return array{items: list<array<string, mixed>>, next: int|null}
     */
    public function page(Conversation $conversation, string $kind, ?int $before = null): array
    {
        return $kind === 'links' ? $this->links($conversation, $before) : $this->attachments($conversation, $kind, $before);
    }

    /**
     * Скільки чого є — для вкладок.
     *
     * @return array<string, int>
     */
    public function counts(Conversation $conversation): array
    {
        $base = fn (array $types) => MessageAttachment::query()->whereIn('type', $types)
            ->whereHas('message', fn (Builder $q) => $this->visible($q->where('conversation_id', $conversation->id)))->count();

        return [
            'media' => $base([MessageAttachment::TYPE_IMAGE, MessageAttachment::TYPE_VIDEO_NOTE]),
            'files' => $base([MessageAttachment::TYPE_FILE]),
            'voice' => $base([MessageAttachment::TYPE_VOICE]),
            'links' => $this->visible(Message::query()->where('conversation_id', $conversation->id))->where('body', 'like', '%http%')->count(),
        ];
    }

    /**
     * @return array{items: list<array<string, mixed>>, next: int|null}
     */
    private function attachments(Conversation $conversation, string $kind, ?int $before): array
    {
        $types = match ($kind) {
            'files' => [MessageAttachment::TYPE_FILE],
            'voice' => [MessageAttachment::TYPE_VOICE],
            default => [MessageAttachment::TYPE_IMAGE, MessageAttachment::TYPE_VIDEO_NOTE],
        };
        $rows = MessageAttachment::query()->with('message.user')
            ->whereIn('type', $types)
            ->whereHas('message', fn (Builder $q) => $this->visible($q->where('conversation_id', $conversation->id)))
            ->when($before, fn (Builder $q, int $id) => $q->where('id', '<', $id))
            ->orderByDesc('id')->limit(self::PAGE + 1)->get();
        $more = $rows->count() > self::PAGE;
        $rows = $rows->take(self::PAGE);

        return [
            'items' => array_values($rows->map(fn (MessageAttachment $a) => [
                'id' => $a->id,
                'message_id' => $a->message_id,
                'type' => $a->type,
                'url' => $a->url,
                'preview' => $a->type === MessageAttachment::TYPE_FILE ? MessageAttachment::previewKind($a->mime, $a->name) : null,
                'name' => $a->name,
                'mime' => $a->mime,
                'size' => $a->size,
                'duration' => $a->duration,
                'author' => $a->message?->user?->name,
                'created_at' => $a->message?->created_at->toIso8601String(),
            ])->all()),
            'next' => $more ? $rows->last()?->id : null,
        ];
    }

    /**
     * @return array{items: list<array<string, mixed>>, next: int|null}
     */
    private function links(Conversation $conversation, ?int $before): array
    {
        $rows = $this->visible(Message::query()->with('user')->where('conversation_id', $conversation->id))
            ->where('body', 'like', '%http%')
            ->when($before, fn (Builder $q, int $id) => $q->where('id', '<', $id))
            ->orderByDesc('id')->limit(self::PAGE + 1)->get();
        $more = $rows->count() > self::PAGE;
        $rows = $rows->take(self::PAGE);
        $items = [];
        foreach ($rows as $message) {
            preg_match_all(self::URL, (string) $message->body, $found);
            foreach (array_unique($found[0]) as $url) {
                $url = rtrim($url, '.,!?)»');
                $items[] = [
                    'id' => $message->id.'-'.md5($url),
                    'message_id' => $message->id,
                    'url' => $url,
                    'host' => (string) (parse_url($url, PHP_URL_HOST) ?: $url),
                    'author' => $message->user?->name,
                    'created_at' => $message->created_at->toIso8601String(),
                ];
            }
        }

        return ['items' => $items, 'next' => $more ? $rows->last()?->id : null];
    }

    /**
     * Лише опубліковані, не прострочені й не видалені повідомлення.
     *
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function visible(Builder $query): Builder
    {
        return $query
            ->where(fn ($q) => $q->whereNull('publish_at')->orWhere('publish_at', '<=', now()))
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }
}
