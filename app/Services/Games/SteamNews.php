<?php

namespace App\Services\Games;

use App\Models\Follow;
use App\Models\Game;
use App\Models\GameBacklog;
use App\Models\GameNews;
use App\Models\User;
use App\Notifications\GamePatchReleased;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Новини й патчноути ігор із публічного Steam API (ISteamNews, без ключа): лише офіційні
 * оголошення розробників. Про свіжий патч сповіщаємо тих, хто зараз грає чи стежить за грою.
 */
class SteamNews
{
    public const URL = 'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/';

    /** Як часто оновлювати одну гру. */
    public const STALE_HOURS = 3;

    /** Патч старший за це — уже не новина, не сповіщаємо. */
    private const FRESH_DAYS = 3;

    /**
     * Останні новини гри для сторінки (оновлює, якщо дані застарі).
     *
     * @return list<array<string, mixed>>
     */
    public function forGame(Game $game, int $limit = 6): array
    {
        if ($game->steamAppId() !== null && ($game->news_checked_at === null || $game->news_checked_at->lt(now()->subHours(self::STALE_HOURS)))) {
            $this->refresh($game);
        }

        return array_values(GameNews::query()->where('game_id', $game->id)->latest('published_at')->limit($limit)->get()
            ->map(fn (GameNews $news) => $news->toCard())->all());
    }

    /**
     * Підтягує новини зі Steam. Повертає нові патчі (лише якщо гру вже перевіряли раніше —
     * при першій перевірці старі новини не вважаються свіжими).
     *
     * @return Collection<int, GameNews>
     */
    public function refresh(Game $game): Collection
    {
        $appId = $game->steamAppId();
        $first = $game->news_checked_at === null;
        $game->forceFill(['news_checked_at' => now()])->saveQuietly();
        if ($appId === null) {
            return collect();
        }
        try {
            $response = Http::timeout(8)->connectTimeout(4)->acceptJson()->get(self::URL, [
                'appid' => $appId,
                'count' => 10,
                'maxlength' => 400,
                'feeds' => 'steam_community_announcements',
            ]);
        } catch (ConnectionException|RequestException) {
            return collect();
        }
        $items = $response->successful() ? $response->json('appnews.newsitems') : null;
        if (! is_array($items)) {
            return collect();
        }

        $fresh = collect();
        foreach ($items as $item) {
            if (! is_array($item) || ! isset($item['gid'], $item['title'], $item['url'], $item['date'])) {
                continue;
            }
            $news = GameNews::query()->firstOrNew(['gid' => (string) $item['gid']]);
            $isNew = ! $news->exists;
            $news->fill([
                'game_id' => $game->id,
                'title' => Str::limit(trim((string) $item['title']), 250, '…'),
                'url' => Str::limit((string) $item['url'], 495, ''),
                'excerpt' => self::excerpt((string) ($item['contents'] ?? '')),
                'is_patch' => self::isPatch($item),
                'published_at' => CarbonImmutable::createFromTimestamp((int) $item['date']),
            ])->save();
            if ($isNew && ! $first && $news->is_patch && $news->published_at->gt(now()->subDays(self::FRESH_DAYS))) {
                $fresh->push($news);
            }
        }

        return $fresh;
    }

    /** Сповістити гравців і підписників гри про свіжий патч (кожного — раз на патч). */
    public function notify(GameNews $news): int
    {
        $game = $news->game;
        $ids = GameBacklog::query()->where('game_id', $game->id)->where('status', GameBacklog::PLAYING)->pluck('user_id')
            ->merge(Follow::query()->where('kind', Follow::GAME)->where('subject_id', $game->id)->pluck('user_id'))
            ->unique()->values();
        $sent = 0;
        User::query()->whereIn('id', $ids)->whereNull('banned_at')->chunkById(200, function ($users) use ($news, &$sent) {
            foreach ($users as $user) {
                $user->notify(new GamePatchReleased($news));
                $sent++;
            }
        });

        return $sent;
    }

    /**
     * Ігри, які варто перевірити: у когось «граю» чи підписка, є Steam, давно не перевіряли.
     *
     * @return Collection<int, Game>
     */
    public function due(int $limit = 40): Collection
    {
        $ids = GameBacklog::query()->where('status', GameBacklog::PLAYING)->distinct()->pluck('game_id')
            ->merge(Follow::query()->where('kind', Follow::GAME)->distinct()->pluck('subject_id'))
            ->unique()->values();

        return Game::query()->whereIn('id', $ids)
            ->where(fn ($q) => $q->whereNull('news_checked_at')->orWhere('news_checked_at', '<', now()->subHours(self::STALE_HOURS)))
            ->orderByRaw('news_checked_at is not null')->orderBy('news_checked_at')
            ->limit($limit * 3)->get()
            ->filter(fn (Game $game) => $game->steamAppId() !== null)
            ->take($limit)->values();
    }

    /**
     * Патчноут: тег Steam «patchnotes» або слово в заголовку.
     *
     * @param  array<string, mixed>  $item
     */
    public static function isPatch(array $item): bool
    {
        $tags = array_map('strval', (array) ($item['tags'] ?? []));
        if (in_array('patchnotes', $tags, true)) {
            return true;
        }

        return preg_match('/\b(patch|hotfix|update|release notes|changelog)\b|патч|оновлення|исправлени/iu', (string) ($item['title'] ?? '')) === 1;
    }

    /** Текст новини без BBCode, HTML і посилань на картинки. */
    public static function excerpt(string $contents): ?string
    {
        $text = (string) preg_replace('/\{STEAM_CLAN_IMAGE\}\S*|\[img[^\]]*\].*?\[\/img\]/is', ' ', $contents);
        $text = (string) preg_replace('/\[\/?[a-z0-9*]+(?:=[^\]]*)?\]/i', ' ', $text);
        $text = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5);
        $text = trim((string) preg_replace('/\s+/u', ' ', $text));

        return $text === '' ? null : Str::limit($text, 300);
    }
}
