<?php

namespace App\Services\Communities;

use App\Models\Community;
use App\Models\CommunityChannel;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Services\CommunityWall;
use App\Services\Messenger;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Гості без акаунта: перегляд відкритої спільноти й її відкритих каналів (лише читання)
 * і гостьовий чат — один канал, куди гість пише під своїм іменем. Посилання гостям заборонені,
 * заборонені слова спільноти діють, частоту обмежує маршрут.
 */
class CommunityGuests
{
    public const HISTORY = 50;

    public function __construct(
        private readonly Messenger $messenger,
        private readonly CommunityWall $wall,
    ) {}

    public function canView(Community $community): bool
    {
        return $community->guest_view && ! $community->isClosed() && app(Plugins::class)->on('community_access');
    }

    /**
     * Канали, які бачить гість: відкриті текстові й «Оголошення».
     *
     * @return Collection<int, CommunityChannel>
     */
    public function channels(Community $community): Collection
    {
        return $community->channels()->where('is_private', false)->whereNotNull('conversation_id')
            ->where('type', '!=', CommunityChannel::VOICE)
            ->orderBy('position')->orderBy('id')->get();
    }

    /** Канал гостьового чату, якщо він увімкнений і досі відкритий. */
    public function chatChannel(Community $community): ?CommunityChannel
    {
        if ($community->guest_chat_channel_id === null || ! $this->canView($community) || ! app(Plugins::class)->on('community_guest_chat')) {
            return null;
        }
        $channel = $community->channels()->whereKey($community->guest_chat_channel_id)->first();

        return $channel !== null && $this->isChatCapable($channel) ? $channel : null;
    }

    public function isChatCapable(CommunityChannel $channel): bool
    {
        return $channel->type === CommunityChannel::TEXT && ! $channel->is_private && $channel->conversation_id !== null;
    }

    /**
     * Останні повідомлення каналу для гостя — лише текст, автор і фото.
     *
     * @return list<array<string, mixed>>
     */
    public function history(CommunityChannel $channel): array
    {
        return array_values(Message::query()
            ->with(['user', 'attachments'])
            ->where('conversation_id', $channel->conversation_id)
            ->whereNull('publish_at')
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->latest('id')->limit(self::HISTORY)->get()
            ->reverse()
            ->map(fn (Message $m) => [
                'id' => $m->id,
                'type' => $m->type,
                'body' => $m->body,
                'created_at' => $m->created_at->toIso8601String(),
                'author' => $m->user ? ['name' => $m->user->name, 'username' => $m->user->username, 'avatar_url' => $m->user->avatar_url] : null,
                'guest' => is_array($m->meta['guest'] ?? null) ? (string) ($m->meta['guest']['name'] ?? 'Гість') : null,
                'bot' => is_array($m->meta['bot'] ?? null) ? (string) ($m->meta['bot']['name'] ?? 'Бот') : null,
                'images' => array_values($m->attachments->where('type', MessageAttachment::TYPE_IMAGE)->map(fn (MessageAttachment $a) => $a->url)->all()),
            ])->all());
    }

    public function post(Community $community, CommunityChannel $channel, string $name, string $body, string $ip): Message
    {
        $chat = $this->chatChannel($community);
        abort_unless($chat !== null && $chat->id === $channel->id, 403, 'Гості не можуть писати в цьому каналі.');
        if (preg_match('~https?://|www\.|\b[\p{L}\p{N}-]+\.(com|net|org|ru|ua|io|gg|me|xyz|top|ly|link|site|online)\b~iu', $body) === 1) {
            throw ValidationException::withMessages(['body' => 'Гості не можуть надсилати посилання. Увійдіть, щоб ділитися посиланнями.']);
        }
        if ($this->wall->bannedWord($community, $name.' '.$body) !== null) {
            throw ValidationException::withMessages(['body' => 'Повідомлення містить заборонені в спільноті слова.']);
        }

        return $this->messenger->sendAsGuest($channel->conversation, $name, $body, hash('sha256', $ip.'|'.config('app.key')));
    }
}
