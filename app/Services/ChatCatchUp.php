<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * «Поки тебе не було»: коротка зведена непрочитаного в групі без ШІ — за згадками, словами
 * й шаблонами. Що згадали тебе, про що домовились (час, «завтра», «збір»), якими посиланнями
 * поділилися і що найбільше сподобалося.
 */
class ChatCatchUp
{
    /** З якої кількості непрочитаних показуємо зведену. */
    public const MIN_UNREAD = 15;

    /** Скільки останніх непрочитаних переглядаємо. */
    private const SCAN = 500;

    /** Скільки пунктів у кожному розділі. */
    private const PER_SECTION = 3;

    /** Домовленості: час «21:00», «о 9», «завтра», «збір» тощо. */
    private const PLAN = '/(\b([01]?\d|2[0-3])[:.][0-5]\d\b)|(\b(о|об|в|на)\s+([01]?\d|2[0-3])\b)|(завтра|сьогодні|ввечері|зранку|вихідних|домовил|збираєм|збір|зустрічаєм|граємо|гоу|го\b|о котрій|хто буде|хто йде|хто з нами)/iu';

    private const LINK = '~https?://[^\s<>"]+~iu';

    /**
     * @return array{count: int, people: int, first_id: int, sections: list<array{key: string, items: list<array<string, mixed>>}>}|null
     */
    public function for(Conversation $conversation, User $viewer, ?int $lastReadId): ?array
    {
        if (! $conversation->isGroup() || ! app(Plugins::class)->on('chat_catch_up')) {
            return null;
        }
        $base = $conversation->messages()
            ->where('id', '>', $lastReadId ?? 0)
            ->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', '!=', $viewer->id))
            ->where('type', '!=', Message::TYPE_SYSTEM)
            ->where(fn ($q) => $q->whereNull('publish_at')->orWhere('publish_at', '<=', now()))
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
        $count = (clone $base)->count();
        if ($count < self::MIN_UNREAD) {
            return null;
        }

        /** @var Collection<int, Message> $messages */
        $messages = (clone $base)->with('user')->withCount('reactions')->orderByDesc('id')->limit(self::SCAN)->get();
        $used = [];
        $pick = function (callable $match) use ($messages, &$used): array {
            $items = [];
            foreach ($messages as $message) {
                if (count($items) >= self::PER_SECTION) {
                    break;
                }
                if (in_array($message->id, $used, true) || ! $match($message)) {
                    continue;
                }
                $used[] = $message->id;
                $items[] = $this->item($message);
            }

            return array_reverse($items);
        };

        $mention = '@'.mb_strtolower((string) $viewer->username);
        $text = fn (Message $m) => mb_strtolower((string) $m->body);
        $sections = [
            ['key' => 'mentions', 'items' => $pick(fn (Message $m) => str_contains($text($m), $mention))],
            ['key' => 'plans', 'items' => $pick(fn (Message $m) => preg_match(self::PLAN, (string) $m->body) === 1)],
            ['key' => 'popular', 'items' => (function () use ($messages, &$used): array {
                $top = $messages->filter(fn (Message $m) => (int) $m->getAttribute('reactions_count') >= 2 && ! in_array($m->id, $used, true))
                    ->sortByDesc(fn (Message $m) => (int) $m->getAttribute('reactions_count'))->take(self::PER_SECTION)->sortBy('id');
                $used = [...$used, ...$top->pluck('id')->all()];

                return array_values($top->map(fn (Message $m) => $this->item($m))->all());
            })()],
            ['key' => 'links', 'items' => $pick(fn (Message $m) => preg_match(self::LINK, (string) $m->body) === 1)],
        ];

        return [
            'count' => $count,
            'people' => $messages->pluck('user_id')->filter()->unique()->count(),
            'first_id' => (int) (clone $base)->min('id'),
            'sections' => array_values(array_filter($sections, fn (array $section) => $section['items'] !== [])),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function item(Message $message): array
    {
        $body = trim((string) $message->body);
        preg_match(self::LINK, $body, $link);

        return [
            'id' => $message->id,
            'author' => $message->user?->first_name ?: $message->user?->name,
            'text' => $body === '' ? null : Str::limit(preg_replace('/\s+/u', ' ', $body) ?? $body, 120),
            'link' => isset($link[0]) ? (parse_url($link[0], PHP_URL_HOST) ?: null) : null,
            'reactions' => (int) $message->getAttribute('reactions_count'),
            'created_at' => $message->created_at->toIso8601String(),
        ];
    }
}
