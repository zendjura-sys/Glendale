<?php

namespace App\Services\Cards;

use App\Models\Game;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Колекційні картки: кожна опублікована гра — картка. Рідкість — за популярністю в каталозі
 * (найпопулярніші — легендарні). Раз на добу безкоштовний набір; дублікати розбираються на
 * уламки, з уламків можна створити картку, якої бракує. Набори альбому — за першим жанром гри.
 */
class CardCollection
{
    public const RARITIES = ['common', 'rare', 'epic', 'legendary'];

    /** Частка каталогу за рідкістю (від найпопулярніших): легендарні 10%, епічні 20%, рідкісні 30%. */
    private const SHARE = ['legendary' => 0.1, 'epic' => 0.2, 'rare' => 0.3];

    /** Шанс випадіння рідкості в наборі (сума 100). */
    public const DROP = ['common' => 66, 'rare' => 24, 'epic' => 8, 'legendary' => 2];

    /** Скільки уламків дає дублікат і скільки коштує створення. */
    public const DUST = ['common' => 5, 'rare' => 15, 'epic' => 40, 'legendary' => 100];

    public const CRAFT = ['common' => 40, 'rare' => 100, 'epic' => 250, 'legendary' => 600];

    public const PACK_SIZE = 3;

    public const SHOWCASE_MAX = 3;

    /**
     * Каталог карток: game_id → картка (кеш на годину).
     *
     * @return Collection<int, array{id: int, slug: string, name: string, cover: string|null, rarity: string, set: string}>
     */
    public function catalog(): Collection
    {
        $rows = Cache::remember('cards.catalog', 3600, function () {
            $games = Game::query()->where('is_published', true)->orderByDesc('popularity')->orderBy('id')
                ->get(['id', 'slug', 'name', 'cover', 'genres']);
            $n = max(1, $games->count());
            $out = [];
            foreach ($games->values() as $i => $g) {
                $share = $i / $n;
                $rarity = $share < self::SHARE['legendary'] ? 'legendary'
                    : ($share < self::SHARE['legendary'] + self::SHARE['epic'] ? 'epic'
                        : ($share < self::SHARE['legendary'] + self::SHARE['epic'] + self::SHARE['rare'] ? 'rare' : 'common'));
                $genres = is_array($g->genres) ? $g->genres : [];
                $out[$g->id] = ['id' => $g->id, 'slug' => $g->slug, 'name' => $g->name, 'cover' => $g->cover,
                    'rarity' => $rarity, 'set' => (string) ($genres[0] ?? 'Інше')];
            }

            return $out;
        });

        return collect($rows);
    }

    /** Скинути очікування набору (бонус календаря входу): наступний набір можна відкрити одразу. */
    public function grantPack(User $user): void
    {
        DB::table('card_wallets')->upsert(
            [['user_id' => $user->id, 'pack_at' => null, 'shards' => 0, 'packs_opened' => 0, 'created_at' => now(), 'updated_at' => now()]],
            ['user_id'],
            ['pack_at' => null, 'updated_at' => now()],
        );
    }

    public function packSize(User $user): int
    {
        return self::PACK_SIZE + ($user->isPlus() ? 1 : 0);
    }

    /** Коли можна відкрити наступний безкоштовний набір (null — вже можна). */
    public function nextPackAt(User $user): ?string
    {
        $at = DB::table('card_wallets')->where('user_id', $user->id)->value('pack_at');
        if (! $at) {
            return null;
        }
        $next = now()->parse($at)->addDay();

        return $next->isFuture() ? $next->toIso8601String() : null;
    }

    /**
     * Відкрити щоденний набір: випадкові картки з урахуванням шансів рідкості.
     *
     * @return list<array<string, mixed>>
     */
    public function openPack(User $user): array
    {
        $catalog = $this->catalog();
        if ($catalog->isEmpty()) {
            throw ValidationException::withMessages(['pack' => 'Каталог ігор поки порожній.']);
        }

        return DB::transaction(function () use ($user, $catalog) {
            $wallet = DB::table('card_wallets')->where('user_id', $user->id)->lockForUpdate()->first();
            if ($wallet && $wallet->pack_at && now()->parse($wallet->pack_at)->addDay()->isFuture()) {
                throw ValidationException::withMessages(['pack' => 'Наступний набір буде доступний пізніше.']);
            }
            $byRarity = $catalog->groupBy('rarity');
            $owned = DB::table('user_cards')->where('user_id', $user->id)->pluck('copies', 'game_id');
            $drawn = [];
            for ($i = 0; $i < $this->packSize($user); $i++) {
                $rarity = $this->rollRarity();
                $pool = $byRarity->get($rarity) ?? $catalog;
                $card = $pool->random();
                $isNew = ! isset($owned[$card['id']]);
                $owned[$card['id']] = ($owned[$card['id']] ?? 0) + 1;
                DB::table('user_cards')->upsert(
                    [['user_id' => $user->id, 'game_id' => $card['id'], 'copies' => 1, 'created_at' => now(), 'updated_at' => now()]],
                    ['user_id', 'game_id'],
                    ['copies' => DB::raw('user_cards.copies + 1'), 'updated_at' => now()],
                );
                $drawn[] = [...$card, 'new' => $isNew];
            }
            DB::table('card_wallets')->upsert(
                [['user_id' => $user->id, 'pack_at' => now(), 'packs_opened' => 1, 'shards' => 0, 'created_at' => now(), 'updated_at' => now()]],
                ['user_id'],
                ['pack_at' => now(), 'packs_opened' => DB::raw('card_wallets.packs_opened + 1'), 'updated_at' => now()],
            );
            Log::info('cards: pack opened', ['user' => $user->id, 'cards' => array_column($drawn, 'id')]);

            return $drawn;
        });
    }

    private function rollRarity(): string
    {
        $roll = random_int(1, 100);
        foreach (array_reverse(self::DROP, true) as $rarity => $chance) {
            if ($roll <= $chance) {
                return $rarity;
            }
            $roll -= $chance;
        }

        return 'common';
    }

    /** Розібрати всі дублікати (лишається по одній картці). Повертає отримані уламки. */
    public function dustDuplicates(User $user): int
    {
        $catalog = $this->catalog();

        return DB::transaction(function () use ($user, $catalog) {
            $rows = DB::table('user_cards')->where('user_id', $user->id)->where('copies', '>', 1)->lockForUpdate()->get(['id', 'game_id', 'copies']);
            $gain = 0;
            foreach ($rows as $row) {
                $rarity = $catalog->get($row->game_id)['rarity'] ?? 'common';
                $gain += ($row->copies - 1) * self::DUST[$rarity];
            }
            if ($gain > 0) {
                DB::table('user_cards')->whereIn('id', $rows->pluck('id'))->update(['copies' => 1, 'updated_at' => now()]);
                $this->addShards($user, $gain);
            }

            return $gain;
        });
    }

    /** Створити картку з уламків (лише якої ще немає). */
    public function craft(User $user, int $gameId): void
    {
        $card = $this->catalog()->get($gameId);
        abort_unless($card !== null, 404);
        DB::transaction(function () use ($user, $card) {
            $shards = (int) DB::table('card_wallets')->where('user_id', $user->id)->lockForUpdate()->value('shards');
            $cost = self::CRAFT[$card['rarity']];
            if (DB::table('user_cards')->where('user_id', $user->id)->where('game_id', $card['id'])->exists()) {
                throw ValidationException::withMessages(['card' => 'Ця картка вже є у вашій колекції.']);
            }
            if ($shards < $cost) {
                throw ValidationException::withMessages(['card' => 'Бракує уламків.']);
            }
            DB::table('card_wallets')->where('user_id', $user->id)->decrement('shards', $cost);
            DB::table('user_cards')->insert(['user_id' => $user->id, 'game_id' => $card['id'], 'copies' => 1, 'created_at' => now(), 'updated_at' => now()]);
        });
    }

    /** Вітрина профілю: до трьох карток. */
    public function toggleShowcase(User $user, int $gameId): void
    {
        $row = DB::table('user_cards')->where('user_id', $user->id)->where('game_id', $gameId)->first(['id', 'showcase']);
        abort_unless($row !== null, 404);
        if (! $row->showcase && DB::table('user_cards')->where('user_id', $user->id)->where('showcase', true)->count() >= self::SHOWCASE_MAX) {
            throw ValidationException::withMessages(['card' => 'На вітрині вже три картки — спершу приберіть одну.']);
        }
        DB::table('user_cards')->where('id', $row->id)->update(['showcase' => ! $row->showcase, 'updated_at' => now()]);
    }

    public function addShards(User $user, int $amount): void
    {
        DB::table('card_wallets')->upsert(
            [['user_id' => $user->id, 'shards' => $amount, 'packs_opened' => 0, 'created_at' => now(), 'updated_at' => now()]],
            ['user_id'],
            ['shards' => DB::raw('card_wallets.shards + '.$amount), 'updated_at' => now()],
        );
    }

    /**
     * Альбом людини: усі картки з позначкою «є / немає», набори з прогресом.
     *
     * @return array<string, mixed>
     */
    public function album(User $user): array
    {
        $owned = DB::table('user_cards')->where('user_id', $user->id)->get(['game_id', 'copies', 'showcase'])->keyBy('game_id');
        $cards = $this->catalog()->map(fn (array $c) => [
            ...$c,
            'copies' => (int) ($owned[$c['id']]->copies ?? 0),
            'showcase' => (bool) ($owned[$c['id']]->showcase ?? false),
        ])->values();
        $sets = $cards->groupBy('set')->map(fn (Collection $g, string $name) => [
            'name' => $name, 'total' => $g->count(), 'owned' => $g->where('copies', '>', 0)->count(),
        ])->sortByDesc('total')->values();
        $wallet = DB::table('card_wallets')->where('user_id', $user->id)->first();

        return [
            'cards' => $cards,
            'sets' => $sets,
            'shards' => (int) ($wallet->shards ?? 0),
            'packs_opened' => (int) ($wallet->packs_opened ?? 0),
            'next_pack_at' => $this->nextPackAt($user),
            'pack_size' => $this->packSize($user),
            'duplicates' => (int) $cards->sum(fn ($c) => max(0, $c['copies'] - 1)),
            'dust' => self::DUST,
            'craft' => self::CRAFT,
            'drop' => self::DROP,
        ];
    }

    /**
     * Вітрина для профілю: обрані картки (або три найрідкісніші) і скільки зібрано.
     *
     * @return array{cards: list<array<string, mixed>>, owned: int, total: int}|null
     */
    public function showcase(User $user): ?array
    {
        $rows = DB::table('user_cards')->where('user_id', $user->id)->get(['game_id', 'showcase']);
        if ($rows->isEmpty()) {
            return null;
        }
        $catalog = $this->catalog();
        $order = array_flip(array_reverse(self::RARITIES));
        $picked = $rows->where('showcase', true)->pluck('game_id');
        if ($picked->isEmpty()) {
            $picked = $rows->pluck('game_id')->sortBy(fn ($id) => $order[$catalog->get($id)['rarity'] ?? 'common'])->take(self::SHOWCASE_MAX);
        }

        return [
            'cards' => $picked->map(fn ($id) => $catalog->get($id))->filter()->values()->all(),
            'owned' => $rows->count(),
            'total' => $catalog->count(),
        ];
    }
}
