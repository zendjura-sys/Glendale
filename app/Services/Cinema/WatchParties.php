<?php

namespace App\Services\Cinema;

use App\Events\WatchPartyUpdated;
use App\Models\Movie;
use App\Models\User;
use App\Models\WatchParty;
use App\Models\WatchPartyMember;
use App\Models\WatchPartyMessage;
use App\Services\Messenger;
use App\Services\Voice\LiveKit;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Спільний перегляд: ведучий керує плеєром, гості підлаштовуються під його позицію.
 * Сайт отримує зміни через Reverb, застосунок — опитуванням стану; чат і хто в кімнаті — тут же.
 */
class WatchParties
{
    /** Скільки останніх реплік чату віддаємо. */
    public const CHAT_LIMIT = 60;

    public function __construct(
        private readonly LiveKit $livekit,
        private readonly Messenger $messenger,
    ) {}

    public function create(Movie $movie, User $host, ?string $playerKey): WatchParty
    {
        $party = WatchParty::query()->create([
            'code' => Str::lower(Str::random(10)),
            'movie_id' => $movie->id,
            'host_id' => $host->id,
            'player_key' => $playerKey,
            'state_ms' => $this->now(),
        ]);
        $this->touch($party, $host);

        return $party;
    }

    /** Людина на сторінці: позначаємо онлайн, а новеньких показуємо іншим. */
    public function touch(WatchParty $party, User $user): void
    {
        $member = WatchPartyMember::query()->where('watch_party_id', $party->id)->where('user_id', $user->id)->first();
        $returning = $member && $member->last_seen_at->gt(now()->subSeconds(WatchParty::ONLINE_SECONDS));
        WatchPartyMember::query()->updateOrCreate(
            ['watch_party_id' => $party->id, 'user_id' => $user->id],
            ['last_seen_at' => now()],
        );
        if (! $returning) {
            $this->broadcast($party, ['members' => $this->members($party)]);
        }
    }

    public function isMember(WatchParty $party, User $user): bool
    {
        return WatchPartyMember::query()->where('watch_party_id', $party->id)->where('user_id', $user->id)->exists();
    }

    /**
     * Ведучий (або всі, якщо керування спільне) змінив стан плеєра.
     */
    public function control(WatchParty $party, User $user, bool $playing, float $position, ?string $playerKey): void
    {
        if (! $party->canControl($user)) {
            abort(403, 'Плеєром керує ведучий.');
        }
        $party->update([
            'playing' => $playing,
            'position' => max(0, $position),
            'state_ms' => $this->now(),
            'player_key' => $playerKey ?? $party->player_key,
        ]);
        $this->broadcast($party, ['state' => $this->playback($party), 'by' => $user->id]);
    }

    public function setSharedControl(WatchParty $party, User $user, bool $shared): void
    {
        abort_unless($user->id === $party->host_id, 403, 'Лише ведучий змінює керування.');
        $party->update(['shared_control' => $shared]);
        $this->broadcast($party, ['state' => $this->playback($party)]);
    }

    public function say(WatchParty $party, User $user, string $body): WatchPartyMessage
    {
        $message = WatchPartyMessage::query()->create([
            'watch_party_id' => $party->id,
            'user_id' => $user->id,
            'body' => $body,
            'created_at' => now(),
        ]);
        $message->setRelation('user', $user);
        $this->broadcast($party, ['message' => $this->message($message)]);

        return $message;
    }

    public function end(WatchParty $party, User $user): void
    {
        abort_unless($user->id === $party->host_id, 403, 'Завершити перегляд може лише ведучий.');
        $party->update(['ended_at' => now(), 'playing' => false]);
        $this->livekit->deleteRoom($party->livekitName());
        $this->broadcast($party, ['ended' => true]);
    }

    /**
     * Запросити друзів: кожному — повідомлення в особистий чат із посиланням.
     *
     * @param  list<int>  $userIds
     */
    public function invite(WatchParty $party, User $user, array $userIds): int
    {
        $movie = $party->movie;
        $sent = 0;
        foreach (User::query()->whereIn('id', $userIds)->whereKeyNot($user->id)->limit(20)->get() as $friend) {
            if (! $this->messenger->canMessage($user, $friend)) {
                continue;
            }
            $conversation = $this->messenger->direct($user, $friend);
            $this->messenger->send($conversation, $user, "🎬 Запрошую дивитися разом «{$movie?->title}»: ".url('/watch/'.$party->code));
            $sent++;
        }
        if ($sent === 0) {
            throw ValidationException::withMessages(['user_ids' => 'Нікого не вдалося запросити.']);
        }

        return $sent;
    }

    /**
     * Голос під час перегляду: окрема кімната LiveKit.
     *
     * @return array{url: string, token: string, room: string, identity: string}
     */
    public function voice(WatchParty $party, User $user): array
    {
        return [
            'url' => (string) $this->livekit->url(),
            'token' => $this->livekit->token('u'.$user->id, $user->name, $party->livekitName(), [], (string) json_encode(['user_id' => $user->id, 'avatar_url' => $user->avatar_url])),
            'room' => $party->livekitName(),
            'identity' => 'u'.$user->id,
        ];
    }

    /**
     * Повний стан для сторінки й застосунку.
     *
     * @return array<string, mixed>
     */
    public function state(WatchParty $party, User $viewer, int $afterMessage = 0): array
    {
        $messages = $party->messages()->with('user')
            ->when($afterMessage > 0, fn ($q) => $q->where('id', '>', $afterMessage))
            ->latest('id')->limit(self::CHAT_LIMIT)->get()->reverse()->values();

        return [
            'id' => $party->id,
            'code' => $party->code,
            'url' => url('/watch/'.$party->code),
            'host' => $party->host?->toCard(),
            'is_host' => $viewer->id === $party->host_id,
            'can_control' => $party->canControl($viewer),
            'ended' => ! $party->isLive(),
            'voice_enabled' => $this->livekit->configured(),
            'state' => $this->playback($party),
            'members' => $this->members($party),
            'messages' => $messages->map(fn (WatchPartyMessage $m) => $this->message($m))->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function playback(WatchParty $party): array
    {
        return [
            'playing' => $party->playing,
            'position' => round($party->position, 2),
            'state_ms' => $party->state_ms,
            'server_ms' => $this->now(),
            'player_key' => $party->player_key,
            'shared_control' => $party->shared_control,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function members(WatchParty $party): array
    {
        return array_values($party->members()->with('user')
            ->where('last_seen_at', '>=', now()->subSeconds(WatchParty::ONLINE_SECONDS))
            ->orderBy('id')
            ->get()
            ->map(fn (WatchPartyMember $m) => $m->user ? [...$m->user->toCard(), 'is_host' => $m->user_id === $party->host_id] : null)
            ->filter()
            ->values()
            ->all());
    }

    /**
     * @return array<string, mixed>
     */
    private function message(WatchPartyMessage $message): array
    {
        return [
            'id' => $message->id,
            'body' => $message->body,
            'user' => $message->user?->toCard(),
            'created_at' => $message->created_at->toIso8601String(),
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function broadcast(WatchParty $party, array $payload): void
    {
        rescue(fn () => broadcast(new WatchPartyUpdated($party->id, $payload)), report: false);
    }

    private function now(): int
    {
        return (int) floor(microtime(true) * 1000);
    }
}
