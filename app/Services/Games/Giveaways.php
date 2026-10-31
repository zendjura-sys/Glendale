<?php

namespace App\Services\Games;

use App\Models\Game;
use App\Models\GameGiveaway;
use App\Models\GameWishlist;
use App\Models\User;
use App\Notifications\GameDealNotice;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Роздачі ігор в Epic Games Store, Steam і GOG — публічний API GamerPower (без ключа).
 * Нова роздача → сповіщення тим, хто підписався (pref giveaways), і власникам цієї гри в бажаному.
 */
class Giveaways
{
    public const API = 'https://www.gamerpower.com/api/filter';

    /** Підписка на сповіщення про нові роздачі. */
    public const PREF = 'giveaways';

    /**
     * @return array{new: int, active: int}|null
     */
    public function sync(): ?array
    {
        try {
            $response = Http::timeout(15)->connectTimeout(5)->acceptJson()
                ->get(self::API, ['platform' => 'epic-games-store.steam.gog', 'type' => 'game']);
        } catch (ConnectionException|RequestException) {
            return null;
        }
        $rows = $response->successful() ? $response->json() : null;
        // Порожньо GamerPower відповідає об'єктом {status: 0} — тоді роздач немає, але й нічого не чіпаємо.
        if (! is_array($rows) || ! array_is_list($rows)) {
            return null;
        }
        $seen = [];
        $fresh = [];
        foreach ($rows as $row) {
            if (! is_array($row) || ! is_numeric($row['id'] ?? null) || ! is_string($row['title'] ?? null)) {
                continue;
            }
            $id = (int) $row['id'];
            $seen[] = $id;
            $title = trim((string) preg_replace('/\s*\((Epic Games|Steam|GOG)[^)]*\)\s*Giveaway$|\s+Giveaway$/i', '', $row['title']));
            $attrs = [
                'title' => mb_substr($title, 0, 200),
                'store' => self::store((string) ($row['platforms'] ?? '')),
                'worth' => is_string($row['worth'] ?? null) && $row['worth'] !== 'N/A' ? mb_substr($row['worth'], 0, 20) : null,
                'image' => is_string($row['image'] ?? null) ? mb_substr($row['image'], 0, 500) : null,
                'description' => is_string($row['description'] ?? null) ? mb_substr($row['description'], 0, 2000) : null,
                'url' => mb_substr((string) ($row['open_giveaway_url'] ?? $row['gamerpower_url'] ?? ''), 0, 500),
                'game_id' => $this->matchGame($title),
                'active' => true,
                'published_at' => self::date($row['published_date'] ?? null),
                'ends_at' => self::date($row['end_date'] ?? null),
            ];
            $giveaway = GameGiveaway::query()->where('external_id', $id)->first();
            if ($giveaway === null) {
                $fresh[] = GameGiveaway::query()->create(['external_id' => $id, ...$attrs]);
            } else {
                $giveaway->update($attrs);
            }
        }
        // Чого вже немає у списку — роздача скінчилась.
        GameGiveaway::query()->where('active', true)->whereNotIn('external_id', $seen)->update(['active' => false]);
        GameGiveaway::query()->where('active', true)->whereNotNull('ends_at')->where('ends_at', '<', now())->update(['active' => false]);

        foreach ($fresh as $giveaway) {
            $this->announce($giveaway);
        }

        return ['new' => count($fresh), 'active' => count($seen)];
    }

    /**
     * Роздачі, що тривають: спершу ті, що скоро закінчаться.
     *
     * @return EloquentCollection<int, GameGiveaway>
     */
    public function active(int $limit = 60): EloquentCollection
    {
        return GameGiveaway::query()->with('game')->where('active', true)
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', now()))
            ->orderByRaw('ends_at is null')->orderBy('ends_at')->orderByDesc('published_at')
            ->limit($limit)->get();
    }

    private function announce(GameGiveaway $giveaway): void
    {
        $text = 'Безкоштовно в '.(GameGiveaway::STORES[$giveaway->store] ?? $giveaway->store).': '.$giveaway->title;
        $notified = [];
        if ($giveaway->game_id !== null) {
            GameWishlist::query()->with('user')->where('game_id', $giveaway->game_id)->get()
                ->each(function (GameWishlist $wish) use ($text, &$notified) {
                    $wish->user->notify(new GameDealNotice('giveaway', $text.' — гра з вашого списку бажаного', 'Забрати до кінця роздачі', '/games/deals'));
                    $notified[$wish->user_id] = true;
                });
        }
        User::query()->where('preferences->'.self::PREF, true)->whereNotIn('id', array_keys($notified))
            ->chunkById(500, function ($users) use ($text, $giveaway) {
                foreach ($users as $user) {
                    $user->notify(new GameDealNotice('giveaway', $text, $giveaway->worth !== null ? 'Звичайна ціна '.$giveaway->worth : 'Роздача гри', '/games/deals'));
                }
            });
        Log::info('games: giveaway', ['id' => $giveaway->external_id, 'title' => $giveaway->title]);
    }

    private function matchGame(string $title): ?int
    {
        $id = Game::query()->published()->where('name', $title)->value('id');

        return is_numeric($id) ? (int) $id : null;
    }

    public static function store(string $platforms): string
    {
        $p = strtolower($platforms);

        return match (true) {
            str_contains($p, 'epic') => 'epic',
            str_contains($p, 'steam') => 'steam',
            str_contains($p, 'gog') => 'gog',
            default => 'other',
        };
    }

    private static function date(mixed $value): ?Carbon
    {
        if (! is_string($value) || $value === '' || $value === 'N/A') {
            return null;
        }
        try {
            return Carbon::parse($value, 'UTC');
        } catch (\Throwable) {
            return null;
        }
    }
}
