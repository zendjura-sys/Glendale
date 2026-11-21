<?php

namespace App\Services\Cards;

use App\Models\Game;
use App\Models\Movie;
use App\Models\User;
use App\Notifications\CardEarned;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Картки за активність: переглянутий фільм, кожні 10 серій (серіал чи аніме до 12 серій — лише
 * після останньої), гра, в якій зараз людина (з автоматичного статусу Steam/Discord, раз на тиждень).
 * Зароблена картка чекає в «Отриманих» — людина відкриває її сама й може докласти кристали.
 */
class CardDrops
{
    /** Серіали до стількох серій дають картку лише після повного перегляду. */
    public const SHORT_SERIES = 12;

    public const EPISODES_STEP = 10;

    public function __construct(private readonly CardCollection $cards) {}

    private function grant(User $user, string $ref, string $source, string $title, ?int $movieId = null, ?int $gameId = null): void
    {
        $inserted = DB::table('card_drops')->insertOrIgnore([
            'user_id' => $user->id, 'ref' => $ref, 'source' => $source, 'title' => mb_substr($title, 0, 160),
            'movie_id' => $movieId, 'game_id' => $gameId, 'created_at' => now(), 'updated_at' => now(),
        ]);
        if ($inserted > 0) {
            $user->notify(new CardEarned($title, $source));
        }
    }

    private function series(Movie $movie): bool
    {
        return in_array($movie->type, ['serial', 'anime', 'documentary'], true) && ($movie->episodes_count ?? 0) > 1;
    }

    /** Статус «Переглянуто»: фільм — картка; серіал — теж (це повне завершення). */
    public function watched(User $user, Movie $movie): void
    {
        $this->grant($user, 'watch:'.$movie->id, 'watch', $movie->title, movieId: $movie->id);
    }

    /** Відмітка серії: кожні 10 серій, а короткий серіал — після останньої серії. */
    public function episodes(User $user, Movie $movie): void
    {
        if (! $this->series($movie)) {
            return;
        }
        $marked = DB::table('movie_episode_marks')->where('user_id', $user->id)->where('movie_id', $movie->id)->count();
        $total = (int) $movie->episodes_count;
        if ($total <= self::SHORT_SERIES) {
            if ($marked >= $total) {
                $this->watched($user, $movie);
            }

            return;
        }
        if ($marked > 0 && $marked % self::EPISODES_STEP === 0) {
            $this->grant($user, 'ep:'.$movie->id.':'.intdiv($marked, self::EPISODES_STEP), 'episodes', $movie->title, movieId: $movie->id);
        }
    }

    /** Гра з автоматичного статусу «Граю в…»: раз на тиждень за кожну гру з карткою. */
    public function playing(User $user, int $gameId): void
    {
        if (! $this->cards->catalog()->has('g'.$gameId)) {
            return;
        }
        $game = Game::query()->find($gameId, ['id', 'name']);
        if ($game) {
            $this->grant($user, 'game:'.$gameId.':'.now()->format('o-W'), 'game', $game->name, gameId: $gameId);
        }
    }

    /**
     * Невідкриті картки людини.
     *
     * @return list<array<string, mixed>>
     */
    public function pending(User $user): array
    {
        return DB::table('card_drops')->where('user_id', $user->id)->whereNull('opened_at')->latest('id')->limit(50)
            ->get(['id', 'source', 'title', 'created_at'])
            ->map(fn ($d) => ['id' => $d->id, 'source' => $d->source, 'title' => $d->title, 'created_at' => (string) $d->created_at])->all();
    }

    /**
     * Відкрити зароблену картку: з персонажів тайтлу (або картка гри), з кристалами — вищий шанс на рідкісну.
     *
     * @return array<string, mixed>
     */
    public function open(User $user, int $dropId, int $crystals): array
    {
        return DB::transaction(function () use ($user, $dropId, $crystals) {
            $drop = DB::table('card_drops')->where('id', $dropId)->where('user_id', $user->id)->lockForUpdate()->first();
            abort_unless($drop !== null, 404);
            if ($drop->opened_at) {
                throw ValidationException::withMessages(['drop' => 'Цю картку вже відкрито.']);
            }
            $catalog = $this->cards->catalog();
            $pool = match (true) {
                // Гра: картка самої гри й персонажі цієї гри.
                $drop->game_id !== null => $catalog->filter(fn ($c) => $c['key'] === 'g'.$drop->game_id || ($c['game_id'] ?? null) === (int) $drop->game_id),
                $drop->movie_id !== null => $catalog->where('movie_id', $drop->movie_id),
                default => collect(),
            };
            // У тайтлу ще немає персонажів — картка з усіх персонажів кіно (або з усього каталогу).
            if ($pool->isEmpty()) {
                $pool = $catalog->where('kind', '!=', 'game');
            }
            if ($pool->isEmpty()) {
                $pool = $catalog;
            }
            $this->cards->spendCrystals($user, $crystals);
            $card = $this->cards->give($user, $this->cards->draw($pool, $crystals));
            DB::table('card_drops')->where('id', $drop->id)->update(['opened_at' => now(), 'card_key' => $card['key'], 'updated_at' => now()]);

            return $card;
        });
    }
}
