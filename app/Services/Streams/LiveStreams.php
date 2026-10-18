<?php

namespace App\Services\Streams;

use App\Models\User;
use App\Models\UserStream;
use App\Notifications\StreamLive;
use App\Services\FriendshipService;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * «Зараз у стрімі»: канал Twitch чи YouTube у профілі, перевірка ефіру й сповіщення друзям.
 * Twitch — через Helix (ключі в адмінці), YouTube — за сторінкою каналу /live (без ключа).
 */
class LiveStreams
{
    /** Ручна позначка «Я в ефірі» тримається до 6 годин. */
    private const MANUAL_HOURS = 6;

    private const YOUTUBE_BATCH = 40;

    public function __construct(private readonly SiteSettings $settings, private readonly FriendshipService $friendships) {}

    /**
     * Розбирає те, що людина вставила: посилання на канал або сам логін / @handle.
     *
     * @return array{platform: string, channel: string}
     */
    public function parse(string $platform, string $input): array
    {
        $input = trim($input);
        if ($platform === 'twitch') {
            $login = preg_match('~twitch\.tv/([A-Za-z0-9_]{3,25})~i', $input, $m) === 1 ? $m[1] : ltrim($input, '@');
            if (preg_match('/^[A-Za-z0-9_]{3,25}$/', $login) !== 1) {
                throw ValidationException::withMessages(['channel' => 'Вкажіть логін Twitch або посилання twitch.tv/…']);
            }

            return ['platform' => 'twitch', 'channel' => strtolower($login)];
        }
        if (preg_match('~youtube\.com/channel/(UC[\w-]{22})~i', $input, $m) === 1 || preg_match('/^(UC[\w-]{22})$/', $input, $m) === 1) {
            return ['platform' => 'youtube', 'channel' => $m[1]];
        }
        $handle = preg_match('~youtube\.com/(@[\w.\-]{3,100})~i', $input, $m) === 1 ? $m[1] : '@'.ltrim($input, '@');
        if (preg_match('/^@[\w.\-]{3,100}$/u', $handle) !== 1) {
            throw ValidationException::withMessages(['channel' => 'Вкажіть @канал YouTube або посилання youtube.com/@…']);
        }

        return ['platform' => 'youtube', 'channel' => $handle];
    }

    public function save(User $user, string $platform, string $input): UserStream
    {
        $data = $this->parse($platform, $input);

        $stream = UserStream::query()->updateOrCreate(['user_id' => $user->id], [...$data, 'is_live' => false, 'video_id' => null, 'checked_at' => null]);
        $this->checkOne($stream);

        return $stream->refresh();
    }

    public function manual(User $user, bool $on): ?UserStream
    {
        $stream = UserStream::query()->where('user_id', $user->id)->first();
        if (! $stream instanceof UserStream) {
            return null;
        }
        $stream->update(['manual_until' => $on ? now()->addHours(self::MANUAL_HOURS) : null]);
        if ($on) {
            $this->wentLive($stream);
        }

        return $stream;
    }

    /**
     * Перевіряє всі канали: Twitch — пакетами по 100, YouTube — по черзі (найдавніше перевірені).
     *
     * @return array{twitch: int, youtube: int, live: int}
     */
    public function check(): array
    {
        $twitch = UserStream::query()->where('platform', 'twitch')->get();
        foreach ($twitch->chunk(100) as $chunk) {
            $this->checkTwitch(array_values($chunk->all()));
        }
        $youtube = UserStream::query()->where('platform', 'youtube')->orderByRaw('checked_at is not null')->orderBy('checked_at')->limit(self::YOUTUBE_BATCH)->get();
        foreach ($youtube as $stream) {
            $this->checkYoutube($stream);
        }

        return ['twitch' => $twitch->count(), 'youtube' => $youtube->count(), 'live' => UserStream::query()->where('is_live', true)->count()];
    }

    public function checkOne(UserStream $stream): void
    {
        $stream->platform === 'twitch' ? $this->checkTwitch([$stream]) : $this->checkYoutube($stream);
    }

    /**
     * Друзі, які зараз в ефірі.
     *
     * @return list<array<string, mixed>>
     */
    public function friendsLive(User $user, string $host): array
    {
        $ids = $this->friendships->friendIds($user);
        if ($ids === []) {
            return [];
        }

        return array_values(UserStream::query()->with('user')->whereIn('user_id', $ids)
            ->where(fn ($q) => $q->where('is_live', true)->orWhere('manual_until', '>', now()))
            ->orderByDesc('viewers')->limit(8)->get()
            ->map(fn (UserStream $s) => $this->card($s, $host))->all());
    }

    /**
     * @return array<string, mixed>
     */
    public function card(UserStream $stream, string $host): array
    {
        return [
            'platform' => $stream->platform,
            'platform_label' => UserStream::PLATFORMS[$stream->platform] ?? $stream->platform,
            'channel' => $stream->channel,
            'url' => $stream->url(),
            'live' => $stream->live(),
            'manual' => $stream->manual_until !== null && $stream->manual_until->isFuture(),
            'title' => $stream->title,
            'game' => $stream->game,
            'viewers' => $stream->viewers,
            'embed' => $stream->live() ? $stream->embed($host) : null,
            'user' => $stream->relationLoaded('user') ? $stream->user->toCard() : null,
        ];
    }

    /**
     * @param  list<UserStream>  $streams
     */
    private function checkTwitch(array $streams): void
    {
        $token = $this->twitchToken();
        $clientId = $this->settings->get('twitch_client_id');
        if ($token === null || ! is_string($clientId) || $streams === []) {
            return;
        }
        try {
            $query = implode('&', array_map(fn (UserStream $s) => 'user_login='.rawurlencode($s->channel), $streams));
            $rows = Http::withHeaders(['Client-Id' => $clientId, 'Authorization' => 'Bearer '.$token])->timeout(10)
                ->get(rtrim((string) config('services.twitch.api_url', 'https://api.twitch.tv'), '/').'/helix/streams?'.$query.'&first=100')
                ->json('data');
        } catch (Throwable) {
            return;
        }
        $live = collect(is_array($rows) ? $rows : [])->keyBy(fn ($row) => strtolower((string) ($row['user_login'] ?? '')));
        foreach ($streams as $stream) {
            $row = $live->get($stream->channel);
            $this->apply($stream, is_array($row), is_array($row) ? [
                'title' => mb_substr((string) ($row['title'] ?? ''), 0, 200) ?: null,
                'game' => mb_substr((string) ($row['game_name'] ?? ''), 0, 120) ?: null,
                'viewers' => (int) ($row['viewer_count'] ?? 0),
            ] : []);
        }
    }

    private function checkYoutube(UserStream $stream): void
    {
        try {
            $html = Http::timeout(8)->withHeaders(['Accept-Language' => 'uk,en;q=0.8', 'User-Agent' => 'Mozilla/5.0 (compatible; GameConBot/1.0)'])
                ->get($stream->url())->body();
        } catch (Throwable) {
            $stream->forceFill(['checked_at' => now()])->save();

            return;
        }
        $live = str_contains($html, '"isLiveNow":true') || str_contains($html, '"isLive":true');
        $video = preg_match('~<link rel="canonical" href="https://www\.youtube\.com/watch\?v=([\w-]{11})"~', $html, $m) === 1 ? $m[1] : null;
        $title = preg_match('~<meta property="og:title" content="([^"]{1,200})"~', $html, $t) === 1 ? html_entity_decode($t[1], ENT_QUOTES | ENT_HTML5) : null;
        $this->apply($stream, $live && $video !== null, ['title' => $title, 'video_id' => $video, 'viewers' => null]);
    }

    /**
     * @param  array<string, mixed>  $details
     */
    private function apply(UserStream $stream, bool $live, array $details): void
    {
        $was = $stream->is_live;
        $stream->forceFill([
            ...($live ? $details : ['viewers' => null]),
            'is_live' => $live,
            'started_at' => $live ? ($was ? $stream->started_at : now()) : null,
            'checked_at' => now(),
        ])->save();
        if ($live && ! $was) {
            $this->wentLive($stream);
        }
    }

    /** Друзям — одне сповіщення на ефір (не частіше разу на 3 години). */
    private function wentLive(UserStream $stream): void
    {
        if ($stream->notified_at !== null && $stream->notified_at->gt(now()->subHours(3))) {
            return;
        }
        $stream->forceFill(['notified_at' => now()])->save();
        $user = $stream->user;
        $friends = User::query()->whereIn('id', $this->friendships->friendIds($user))->get();
        foreach ($friends as $friend) {
            $friend->notify(new StreamLive($user, $stream));
        }
    }

    private function twitchToken(): ?string
    {
        $clientId = $this->settings->get('twitch_client_id');
        $secret = $this->settings->secret('twitch_client_secret');
        if (! is_string($clientId) || $clientId === '' || $secret === null) {
            return null;
        }

        return Cache::remember('twitch.app_token.'.md5($clientId), now()->addHours(12), function () use ($clientId, $secret) {
            try {
                $token = Http::asForm()->timeout(10)->post(rtrim((string) config('services.twitch.auth_url', 'https://id.twitch.tv'), '/').'/oauth2/token', [
                    'client_id' => $clientId,
                    'client_secret' => $secret,
                    'grant_type' => 'client_credentials',
                ])->json('access_token');
            } catch (Throwable) {
                return null;
            }

            return is_string($token) ? $token : null;
        }) ?: null;
    }

    public function testTwitch(): bool
    {
        Cache::forget('twitch.app_token.'.md5((string) $this->settings->get('twitch_client_id')));

        return $this->twitchToken() !== null;
    }
}
