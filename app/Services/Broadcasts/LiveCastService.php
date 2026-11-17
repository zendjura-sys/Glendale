<?php

namespace App\Services\Broadcasts;

use App\Models\Livecast;
use App\Models\LivecastIntegration;
use App\Models\LivecastMessage;
use App\Models\User;
use App\Services\Ai\StreamCopilot;
use App\Services\Voice\LiveKit;
use App\Support\LiveCast\DonationPresets;
use App\Support\LiveCast\StreamGifts;
use Illuminate\Support\Facades\Cache;

/**
 * LiveCast — нативна стрім-площадка на LiveKit (окремо від GameCast).
 * Вихід в ефір — лише з застосунку; веб — перегляд, чат, подарунки й донат-лінки.
 */
class LiveCastService
{
    /** Глядача вважаємо онлайн, якщо заходив у state за цей час. */
    private const SEEN_SECONDS = 45;

    public function __construct(private readonly LiveKit $livekit) {}

    /**
     * @param  list<array{provider?: string, key?: string, url?: string}>|null  $donations
     */
    public function start(User $host, string $title, ?string $category = null, ?array $donations = null): Livecast
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
            'donations' => $this->donationLinksFor($host, $donations),
            'status' => Livecast::LIVE,
            'started_at' => now(),
            'viewers' => 0,
            'peak_viewers' => 0,
        ]);
        $this->forgetCaches();

        return $stream;
    }

    /**
     * Токен LiveKit. Публікувати (камера/екран) може лише ведучий із застосунку.
     *
     * @return array{url: string, token: string, identity: string, broadcast: array<string, mixed>}
     */
    public function join(Livecast $livecast, User $user, bool $canPublish = false): array
    {
        abort_unless($livecast->isLive(), 422, 'Стрім уже завершено.');
        abort_unless($this->livekit->configured(), 503, 'Голосовий сервер не налаштовано.');

        $host = $livecast->host_id === $user->id;
        $publish = $host && $canPublish;
        $identity = 'u'.$user->id;
        $this->touch($livecast, $user);
        $this->forgetCaches();

        return [
            'url' => (string) $this->livekit->url(),
            'token' => $this->livekit->token(
                $identity,
                $user->name,
                $livecast->livekitName(),
                $publish
                    ? ['canPublishSources' => LiveKit::BROADCAST_SOURCES]
                    : ['canPublish' => false, 'canPublishSources' => []],
                (string) json_encode(['user_id' => $user->id, 'role' => $publish ? 'host' : 'viewer']),
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
        $this->forgetCaches();
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

    /**
     * @param  list<array{provider?: string, key?: string, url?: string}>  $donations
     */
    public function updateDonations(Livecast $livecast, User $actor, array $donations): Livecast
    {
        abort_unless($livecast->host_id === $actor->id || $actor->isStaff(), 403, 'Лише ведучий.');
        $livecast->update(['donations' => DonationPresets::sanitize($donations)]);

        return $livecast->fresh();
    }

    public function chat(Livecast $livecast, User $user, string $body): LivecastMessage
    {
        abort_unless($livecast->isLive(), 422, 'Стрім уже завершено.');
        $body = trim($body);
        abort_if($body === '', 422, 'Порожнє повідомлення.');

        return LivecastMessage::query()->create([
            'livecast_id' => $livecast->id,
            'user_id' => $user->id,
            'kind' => LivecastMessage::CHAT,
            'gift_key' => null,
            'body' => mb_substr($body, 0, 280),
        ]);
    }

    public function gift(Livecast $livecast, User $user, string $giftKey, ?string $note = null): LivecastMessage
    {
        abort_unless($livecast->isLive(), 422, 'Стрім уже завершено.');
        $gift = StreamGifts::find($giftKey);
        abort_unless($gift !== null, 422, 'Невідомий подарунок.');
        $note = trim((string) $note);
        $body = $gift['emoji'].' '.$gift['label'];
        if ($note !== '') {
            $body .= ' — '.mb_substr($note, 0, 120);
        }

        return LivecastMessage::query()->create([
            'livecast_id' => $livecast->id,
            'user_id' => $user->id,
            'kind' => LivecastMessage::GIFT,
            'gift_key' => $gift['key'],
            'body' => $body,
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
            'donations' => array_values($livecast->donations ?? []),
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
    public function state(Livecast $livecast, ?User $viewer, bool $fromApp = false): array
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
            ->map(fn (LivecastMessage $m) => $this->messageCard($m));

        $isHost = $viewer !== null && $livecast->host_id === $viewer->id;

        return [
            'broadcast' => $this->card($livecast->fresh()),
            'messages' => $messages,
            'gifts' => StreamGifts::all(),
            'donation_presets' => DonationPresets::all(),
            'me' => $viewer ? [
                'is_host' => $isHost,
                // Публікувати відео можна лише з застосунку.
                'can_publish' => $isHost && $fromApp && $livecast->isLive(),
            ] : null,
            'can_manage' => $viewer !== null && ($isHost || $viewer->isStaff()),
            'go_live_on_app' => true,
            'ai' => [
                'available' => app(StreamCopilot::class)->available('livecast')
                    && $viewer !== null
                    && ($isHost || $viewer->isStaff()),
            ],
        ];
    }

    /**
     * Підставити лінки Donatik/Donatello з інтеграцій ведучого, якщо в start() їх не передали.
     *
     * @return list<array{provider: string, name: string, url: string}>
     */
    public function donationLinksFor(User $host, ?array $donations = null): array
    {
        $given = DonationPresets::sanitize($donations ?? []);
        if ($given !== []) {
            return $given;
        }

        $fromIntegrations = [];
        foreach (LivecastIntegration::query()->where('user_id', $host->id)->whereNotNull('page_url')->get() as $row) {
            foreach (DonationPresets::sanitize([['provider' => $row->provider, 'url' => $row->page_url]]) as $link) {
                $fromIntegrations[] = $link;
            }
        }

        return $fromIntegrations;
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

    /**
     * @return array{live: list<array<string, mixed>>, pulse: array{live: int, viewers: int}, gifts: list<array<string, mixed>>, donation_presets: list<array<string, mixed>>, go_live_on_app: bool}
     */
    public function catalog(): array
    {
        return [
            'live' => $this->live(),
            'pulse' => $this->pulse(),
            'gifts' => StreamGifts::all(),
            'donation_presets' => DonationPresets::all(),
            'go_live_on_app' => true,
        ];
    }

    /** @return array<string, mixed> */
    private function messageCard(LivecastMessage $m): array
    {
        $gift = $m->gift_key ? StreamGifts::find($m->gift_key) : null;

        return [
            'id' => $m->id,
            'kind' => $m->kind ?: LivecastMessage::CHAT,
            'gift_key' => $m->gift_key,
            'gift' => $gift,
            'meta' => $m->meta,
            'body' => $m->body,
            'created_at' => $m->created_at?->toIso8601String(),
            'user' => $m->user?->toCard(),
        ];
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

    private function forgetCaches(): void
    {
        Cache::forget('livecast.pulse');
        Cache::forget('widgets:livecast');
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
