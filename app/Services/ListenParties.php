<?php

namespace App\Services;

use App\Events\ListenPartyUpdated;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\ListenParty;
use App\Models\ListenPartyMember;
use App\Models\RadioStation;
use App\Models\Track;
use App\Models\User;
use App\Services\Music\ListenRooms;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Спільне прослуховування: ведучий керує плеєром, слухачі підлаштовуються під його позицію,
 * черга спільна. Сайт отримує зміни через Reverb, застосунок — опитуванням стану.
 * Та сама схема, що й у спільному перегляді кіно (WatchParties).
 */
class ListenParties
{
    public function __construct(private readonly Messenger $messenger) {}

    public function create(User $host, ?Track $track): ListenParty
    {
        $party = ListenParty::query()->create([
            'code' => Str::lower(Str::random(10)),
            'host_id' => $host->id,
            'track_id' => $track?->id,
            'queue' => [],
            'playing' => $track !== null,
            'state_ms' => $this->now(),
        ]);
        $this->touch($party, $host);

        return $party;
    }

    /** Людина на сторінці: позначаємо онлайн, а новеньких показуємо іншим. */
    public function touch(ListenParty $party, User $user): void
    {
        $member = ListenPartyMember::query()->where('listen_party_id', $party->id)->where('user_id', $user->id)->first();
        $returning = $member && $member->last_seen_at->gt(now()->subSeconds(ListenParty::ONLINE_SECONDS));
        ListenPartyMember::query()->updateOrCreate(
            ['listen_party_id' => $party->id, 'user_id' => $user->id],
            ['last_seen_at' => now()],
        );
        if (! $returning) {
            $this->broadcast($party, ['members' => $this->members($party)]);
        }
    }

    public function isMember(ListenParty $party, User $user): bool
    {
        return ListenPartyMember::query()->where('listen_party_id', $party->id)->where('user_id', $user->id)->whereNull('kicked_at')->exists();
    }

    /** Плей, пауза, перемотка або інший трек — від ведучого (чи будь-кого, якщо керування спільне). */
    public function control(ListenParty $party, User $user, bool $playing, float $position, ?Track $track = null, ?RadioStation $station = null): void
    {
        abort_unless($party->canControl($user), 403, 'Плеєром керує ведучий.');
        $party->update([
            'track_id' => $station ? null : ($track->id ?? $party->track_id),
            'station_id' => $track ? null : ($station->id ?? $party->station_id),
            'playing' => $playing,
            'position' => max(0, $position),
            'state_ms' => $this->now(),
        ]);
        $party->unsetRelation('track')->unsetRelation('station');
        $this->broadcast($party, ['state' => $this->playback($party), 'by' => $user->id]);
    }

    /**
     * Додати трек (або радіостанцію) у чергу може кожен слухач; якщо нічого не грає — одразу стає поточним.
     * У кімнаті з погодженням слухач лише пропонує — вирішує діджей.
     */
    public function enqueue(ListenParty $party, User $user, Track|RadioStation $item, ?int $by = null): void
    {
        if ($by === null && $party->moderated && ! $party->canControl($user)) {
            app(ListenRooms::class)->suggest($party, $user, $item);

            return;
        }
        $by ??= $user->id;
        $entry = $item instanceof Track ? ['track_id' => $item->id] : ['station_id' => $item->id];
        if ($party->track_id === null && $party->station_id === null) {
            $party->update([
                'track_id' => $entry['track_id'] ?? null,
                'station_id' => $entry['station_id'] ?? null,
                'playing' => true, 'position' => 0, 'state_ms' => $this->now(),
            ]);
            $party->unsetRelation('track')->unsetRelation('station');
            $this->broadcast($party, ['state' => $this->playback($party), 'queue' => $this->queue($party), 'by' => $user->id]);

            return;
        }
        $queue = $party->queue ?? [];
        if (count($queue) >= ListenParty::QUEUE_LIMIT) {
            throw ValidationException::withMessages(['track_id' => 'Черга заповнена.']);
        }
        $queue[] = [...$entry, 'by' => $by];
        $party->update(['queue' => $queue]);
        $this->broadcast($party, ['queue' => $this->queue($party), 'by' => $user->id]);
    }

    /** Прибрати з черги: ведучий (або при спільному керуванні) — будь-який трек, решта — лише свій. */
    public function dequeue(ListenParty $party, User $user, int $index): void
    {
        $queue = $party->queue ?? [];
        $item = $queue[$index] ?? null;
        abort_if($item === null, 404, 'Такого треку в черзі немає.');
        abort_unless($party->canControl($user) || $item['by'] === $user->id, 403, 'Прибрати можна лише свій трек.');
        array_splice($queue, $index, 1);
        $party->update(['queue' => $queue]);
        $this->broadcast($party, ['queue' => $this->queue($party)]);
    }

    /**
     * Наступний трек із черги. Ведучий — будь-коли; слухач — лише коли поточний уже дограв
     * (якщо ведучий відійшов, музика не зупиняється).
     */
    public function next(ListenParty $party, User $user): void
    {
        // Радіо не «дограє»: перемикає лише той, хто керує.
        $finished = $party->station_id === null
            && ($party->track === null || $party->currentPosition() >= max(0, $party->track->duration - 2));
        abort_unless($party->canControl($user) || $finished, 403, 'Перемикає ведучий.');
        if ($party->repeat && $finished && $party->track_id !== null && app(Plugins::class)->on('listen_repeat')) {
            $party->update(['playing' => true, 'position' => 0, 'state_ms' => $this->now()]);
            $this->broadcast($party, ['state' => $this->playback($party), 'by' => $user->id]);

            return;
        }
        $queue = $party->queue ?? [];
        $nextItem = array_shift($queue);
        $party->update([
            'track_id' => $nextItem['track_id'] ?? null,
            'station_id' => $nextItem['station_id'] ?? null,
            'queue' => $queue,
            'playing' => $nextItem !== null,
            'position' => 0,
            'state_ms' => $this->now(),
        ]);
        $party->unsetRelation('track')->unsetRelation('station');
        $this->broadcast($party, ['state' => $this->playback($party), 'queue' => $this->queue($party), 'by' => $user->id]);
    }

    public function setRepeat(ListenParty $party, User $user, bool $repeat): void
    {
        app(Plugins::class)->ensure('listen_repeat');
        abort_unless($user->id === $party->host_id, 403, 'Лише ведучий вмикає повтор.');
        $party->update(['repeat' => $repeat]);
        $this->broadcast($party, ['state' => $this->playback($party)]);
    }

    public function setSharedControl(ListenParty $party, User $user, bool $shared): void
    {
        abort_unless($user->id === $party->host_id, 403, 'Лише ведучий змінює керування.');
        $party->update(['shared_control' => $shared]);
        $this->broadcast($party, ['state' => $this->playback($party)]);
    }

    public function end(ListenParty $party, User $user): void
    {
        abort_unless($user->id === $party->host_id || app(ListenRooms::class)->canManage($party, $user), 403, 'Завершити може лише ведучий.');
        $party->update(['ended_at' => now(), 'playing' => false]);
        $this->broadcast($party, ['ended' => true]);
    }

    /**
     * Запросити друзів: кожному — повідомлення в особистий чат із посиланням.
     *
     * @param  list<int>  $userIds
     */
    public function invite(ListenParty $party, User $user, array $userIds): int
    {
        $sent = 0;
        foreach (User::query()->whereIn('id', $userIds)->whereKeyNot($user->id)->limit(20)->get() as $friend) {
            if (! $this->messenger->canMessage($user, $friend)) {
                continue;
            }
            $this->messenger->send($this->messenger->direct($user, $friend), $user, $this->inviteText($party));
            $sent++;
        }
        if ($sent === 0) {
            throw ValidationException::withMessages(['user_ids' => 'Нікого не вдалося запросити.']);
        }

        return $sent;
    }

    /** Покликати в груповий чат (наприклад, чат сім’ї): повідомлення з посиланням. */
    public function share(ListenParty $party, User $user, Conversation $conversation): void
    {
        $inChat = ConversationParticipant::query()->where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)->whereNull('left_at')->exists();
        abort_unless($inChat, 403, 'Ви не учасник цього чату.');
        $this->messenger->send($conversation, $user, $this->inviteText($party));
    }

    /**
     * Повний стан для сторінки й застосунку.
     *
     * @return array<string, mixed>
     */
    public function state(ListenParty $party, User $viewer): array
    {
        return [
            'id' => $party->id,
            'code' => $party->code,
            'url' => url('/listen/'.$party->code),
            'host' => $party->host?->toCard(),
            'is_host' => $viewer->id === $party->host_id,
            'can_control' => $party->canControl($viewer),
            'ended' => ! $party->isLive(),
            'state' => $this->playback($party),
            'queue' => $this->queue($party),
            'members' => $this->members($party),
            'room' => $party->isGroupRoom() || $party->moderated ? app(ListenRooms::class)->extras($party, $viewer) : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function playback(ListenParty $party): array
    {
        $track = $party->track;
        // Радіостанція — така сама картка, як трек (duration 0, live), тож грає тим самим плеєром.
        $card = $track?->toCard() ?? $party->station?->toCard();

        return [
            'track' => $card,
            'playing' => $party->playing && $card !== null,
            'position' => round($party->position, 2),
            'state_ms' => $party->state_ms,
            'server_ms' => $this->now(),
            'shared_control' => $party->shared_control,
            'repeat' => $party->repeat && app(Plugins::class)->on('listen_repeat'),
        ];
    }

    /**
     * Черга з картками треків і тим, хто додав.
     *
     * @return list<array<string, mixed>>
     */
    public function queue(ListenParty $party): array
    {
        return $this->cards($party->queue ?? []);
    }

    /**
     * Картки для черги чи пропозицій: трек або радіостанція й хто додав.
     *
     * @param  list<array{track_id?: int, station_id?: int, by: int}>  $items
     * @return list<array<string, mixed>>
     */
    public function cards(array $items): array
    {
        $tracks = Track::query()->whereIn('id', array_filter(array_column($items, 'track_id')))->get()->keyBy('id');
        $stations = RadioStation::query()->whereIn('id', array_filter(array_column($items, 'station_id')))->get()->keyBy('id');
        $users = User::query()->whereIn('id', array_column($items, 'by'))->get()->keyBy('id');
        $out = [];
        foreach ($items as $index => $item) {
            $card = isset($item['station_id']) ? $stations->get($item['station_id'])?->toCard() : $tracks->get($item['track_id'] ?? 0)?->toCard();
            if ($card !== null) {
                $out[] = ['index' => $index, 'track' => $card, 'by' => $users->get($item['by'])?->toCard()];
            }
        }

        return $out;
    }

    private function inviteText(ListenParty $party): string
    {
        $track = $party->track;
        $what = $track ? "«{$track->artist} — {$track->title}»" : 'музику';

        return "🎧 Слухаймо разом {$what}: ".url('/listen/'.$party->code);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function members(ListenParty $party): array
    {
        return array_values($party->members()->with('user')
            ->where('last_seen_at', '>=', now()->subSeconds(ListenParty::ONLINE_SECONDS))
            ->whereNull('kicked_at')
            ->orderBy('id')
            ->get()
            ->map(fn (ListenPartyMember $m) => $m->user ? [...$m->user->toCard(), 'is_host' => $m->user_id === $party->host_id] : null)
            ->filter()
            ->values()
            ->all());
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function broadcast(ListenParty $party, array $payload): void
    {
        rescue(fn () => broadcast(new ListenPartyUpdated($party->id, $payload)), report: false);
    }

    public function now(): int
    {
        return (int) floor(microtime(true) * 1000);
    }
}
