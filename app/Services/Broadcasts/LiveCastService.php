<?php

namespace App\Services\Broadcasts;

use App\Models\Livecast;
use App\Models\LivecastMessage;
use App\Models\User;
use App\Services\Voice\LiveKit;
use Illuminate\Support\Facades\Cache;

/**
 * LiveCast — нативна стрім-площадка на LiveKit (окремо від GameCast).
 * Ведучий публікує камеру/екран; глядачі лише дивляться й пишуть у чат.
 */
class LiveCastService
{
    /** Глядача вважаємо онлайн, якщо заходив у state за цей час. */
    private const SEEN_SECONDS = 45;

    public function __construct(private readonly LiveKit $livekit) {}

    public function start(User $host, string $title, ?string $category = null): Livecast
    {
        abort_unless($this->livekit->configured(), 503, 'Голосовий сервер не налаштовано.');
        abort_if(
            Livecast::query()->where('host_id', $host->id)->where('status', Livecast::LIVE)->exists(),
            422,
            'У вас уже є стрім LiveCast — завершіть його спершу.',
        );

        $stream = Livecast::query()->create([
            'host_id' => $host->id,
            'title' => $title,
            'category' => $category,
            'status' => Livecast::LIVE,
            'started_at' => now(),
            'viewers' => 0,
            'peak_viewers' => 0,
        ]);
        Cache::forget('livecast.pulse');

        return $stream;
    }

    /**
     * Токен LiveKit: ведучий — камера/екран/мікрофон; глядач — лише підписка.
     *
     * @return array{url: string, token: string, identity: string, broadcast: array<string, mixed>}
     */
    public function join(Livecast $livecast, User $user): array
    {
        abort_unless($livecast->isLive(), 422, 'Стрім уже завершено.');
        abort_unless($this->livekit->configured(), 503, 'Голосовий сервер не налаштовано.');

        $host = $livecast->host_id === $user->id;
        $identity = 'u'.$user->id;
        $this->touch($livecast, $user);
        Cache::forget('livecast.pulse');

        return [
            'url' => (string) $this->livekit->url(),
            'token' => $this->livekit->token(
                $identity,
                $user->name,
                $livecast->livekitName(),
                $host
                    ? ['canPublishSources' => LiveKit::BROADCAST_SOURCES]
                    : ['canPublish' => false, 'canPublishSources' => []],
                (string) json_encode(['user_id' => $user->id, 'role' => $host ? 'host' : 'viewer']),
            ),
            'identity' => $identity,
            'broadcast' => $this->card($livecast),
        ];
    }

    public function end(Livecast $livecast, User $actor): void
    {
        abort_unless(
            $livecast->host_id === $actor->id || $actor->isStaff(),
            403,
            'Лише ведучий може завершити стрім.',
        );
        if (! $livecast->isLive()) {
            return;
        }
        $livecast->update(['status' => Livecast::ENDED, 'ended_at' => now(), 'viewers' => 0]);
        $this->livekit->deleteRoom($livecast->livekitName());
        Cache::forget('livecast.pulse');
    }

    public function leave(Livecast $livecast, User $user): void
    {
        $key = $this->viewersKey($livecast);
        /** @var array<int|string, int> $ids */
        $ids = Cache::get($key, []);
        unset($ids[$user->id]);
        Cache::put($key, $ids, self::SEEN_SECONDS + 15);
        if ($livecast->host_id === $user->id && $livecast->isLive()) {
            $this->end($livecast, $user);
        }
    }

    public function chat(Livecast $livecast, User $user, string $body): LivecastMessage
    {
        abort_unless($livecast->isLive(), 422, 'Стрім уже завершено.');
        $body = trim($body);
        abort_if($body === '', 422, 'Порожнє повідомлення.');

        return LivecastMessage::query()->create([
            'livecast_id' => $livecast->id,
            'user_id' => $user->id,
            'body' => mb_substr($body, 0, 280),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function card(Livecast $livecast): array
    {
        $livecast->loadMissing('host');

        return [
            'id' => $livecast->id,
            'title' => $livecast->title,
            'category' => $livecast->category,
            'status' => $livecast->status,
            'started_at' => $livecast->started_at?->toIso8601String(),
            'ended_at' => $livecast->ended_at?->toIso8601String(),
            'viewers' => $livecast->isLive() ? $this->countViewers($livecast) : 0,
            'peak_viewers' => $livecast->peak_viewers,
            'host' => $livecast->host?->toCard(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function state(Livecast $livecast, ?User $viewer): array
    {
        if ($viewer !== null && $livecast->isLive()) {
            $this->touch($livecast, $viewer);
        }
        $viewers = $livecast->isLive() ? $this->countViewers($livecast) : 0;
        if ($viewers > $livecast->peak_viewers) {
            $livecast->update(['peak_viewers' => $viewers, 'viewers' => $viewers]);
        } elseif ($livecast->viewers !== $viewers) {
            $livecast->update(['viewers' => $viewers]);
        }

        $messages = LivecastMessage::query()
            ->with('user')
            ->where('livecast_id', $livecast->id)
            ->latest('id')
            ->limit(80)
            ->get()
            ->reverse()
            ->values()
            ->map(fn (LivecastMessage $m) => [
                'id' => $m->id,
                'body' => $m->body,
                'created_at' => $m->created_at?->toIso8601String(),
                'user' => $m->user?->toCard(),
            ]);

        return [
            'broadcast' => $this->card($livecast->fresh()),
            'messages' => $messages,
            'me' => $viewer ? [
                'is_host' => $livecast->host_id === $viewer->id,
                'can_publish' => $livecast->host_id === $viewer->id && $livecast->isLive(),
            ] : null,
            'can_manage' => $viewer !== null && ($livecast->host_id === $viewer->id || $viewer->isStaff()),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function live(int $limit = 40): array
    {
        return Livecast::query()
            ->with('host')
            ->where('status', Livecast::LIVE)
            ->latest('started_at')
            ->limit($limit)
            ->get()
            ->map(fn (Livecast $b) => $this->card($b))
            ->all();
    }

    /** @return array{live: int, viewers: int} */
    public function pulse(): array
    {
        return Cache::remember('livecast.pulse', 20, function () {
            $live = Livecast::query()->where('status', Livecast::LIVE)->get();
            $viewers = $live->sum(fn (Livecast $b) => $this->countViewers($b));

            return ['live' => $live->count(), 'viewers' => $viewers];
        });
    }

    private function touch(Livecast $livecast, User $user): void
    {
        $key = $this->viewersKey($livecast);
        /** @var array<int|string, int> $ids */
        $ids = Cache::get($key, []);
        $ids[$user->id] = time();
        $cutoff = time() - self::SEEN_SECONDS;
        $ids = array_filter($ids, static fn (int $at) => $at >= $cutoff);
        Cache::put($key, $ids, self::SEEN_SECONDS + 15);
    }

    private function countViewers(Livecast $livecast): int
    {
        /** @var array<int|string, int> $ids */
        $ids = Cache::get($this->viewersKey($livecast), []);
        $cutoff = time() - self::SEEN_SECONDS;
        $ids = array_filter($ids, static fn (int $at) => $at >= $cutoff);

        return max(count($ids), $livecast->isLive() ? 1 : 0);
    }

    private function viewersKey(Livecast $livecast): string
    {
        return 'livecast:'.$livecast->id.':viewers';
    }
}
