<?php

namespace App\Services\Cards;

use App\Models\CardCharacter;
use App\Models\Game;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Колекційні картки: ігри каталогу й персонажі аніме, фільмів і серіалів. Ранг — за популярністю
 * в межах свого виду (16 рангів від N до U). Раз на добу безкоштовний набір; дублікати
 * розбираються на уламки, з уламків можна створити картку, якої бракує.
 * Ключ картки: g12 — гра #12, c5 — персонаж #5.
 */
class CardCollection
{
    /** Ранги від найнижчого до найвищого. */
    public const RARITIES = ['N', 'G', 'F', 'E', 'D', 'C', 'B', 'A', 'R', 'SR', 'SSR', 'S', 'SS', 'SSS', 'EX', 'U'];

    /** Частка каталогу (від найпопулярніших), що отримує ранг — від U вниз; решта — N. */
    private const SHARE = [
        'U' => 0.01, 'EX' => 0.015, 'SSS' => 0.02, 'SS' => 0.025, 'S' => 0.03, 'SSR' => 0.04, 'SR' => 0.05, 'R' => 0.07,
        'A' => 0.08, 'B' => 0.09, 'C' => 0.1, 'D' => 0.1, 'E' => 0.1, 'F' => 0.09, 'G' => 0.08,
    ];

    /** Шанс рангу в наборі, у тисячних (сума 1000). */
    public const DROP = [
        'N' => 200, 'G' => 160, 'F' => 140, 'E' => 120, 'D' => 100, 'C' => 80, 'B' => 60, 'A' => 45,
        'R' => 35, 'SR' => 25, 'SSR' => 15, 'S' => 9, 'SS' => 5, 'SSS' => 3, 'EX' => 2, 'U' => 1,
    ];

    public const PACK_SIZE = 3;

    public const SHOWCASE_MAX = 3;

    /** Уламки за дублікат рангу. */
    public function dust(string $rarity): int
    {
        $i = array_search($rarity, self::RARITIES, true);

        return (int) round(3 * 1.45 ** ($i === false ? 0 : $i));
    }

    /** Ціна створення картки рангу. */
    public function craftCost(string $rarity): int
    {
        return $this->dust($rarity) * 8;
    }

    /**
     * Каталог карток: ключ → картка (кеш на годину).
     *
     * @return Collection<string, array{key: string, kind: string, name: string, cover: string|null, rarity: string, set: string, href: string|null}>
     */
    public function catalog(): Collection
    {
        $rows = Cache::remember('cards.catalog', 3600, function () {
            $out = [];
            $games = Game::query()->where('is_published', true)->orderByDesc('popularity')->orderBy('id')
                ->get(['id', 'slug', 'name', 'cover', 'genres']);
            foreach ($games->values() as $i => $g) {
                $genres = is_array($g->genres) ? $g->genres : [];
                $out['g'.$g->id] = ['key' => 'g'.$g->id, 'kind' => 'game', 'name' => $g->name, 'cover' => $g->cover,
                    'rarity' => $this->rankAt($i, $games->count()), 'set' => (string) ($genres[0] ?? 'Інше'), 'href' => '/games/'.$g->slug];
            }
            $characters = CardCharacter::query()->with('movie:id,slug,title,type,watchers_count,is_published,poster_url,poster_path')
                ->where('is_hidden', false)->whereHas('movie', fn ($q) => $q->where('is_published', true))->get()
                // Популярність персонажа: роль × глядачі тайтлу.
                ->sortByDesc(fn (CardCharacter $c) => $c->popularity * (1 + (int) $c->movie->watchers_count))->values();
            foreach ($characters as $i => $c) {
                $out['c'.$c->id] = ['key' => 'c'.$c->id, 'kind' => $c->movie->type === 'anime' ? 'anime' : ($c->movie->type === 'serial' ? 'serial' : 'movie'),
                    'name' => $c->name, 'cover' => $c->image_url ?: $c->movie->poster, 'rarity' => $this->rankAt($i, $characters->count()),
                    'set' => $c->movie->title, 'href' => '/cinema/'.$c->movie->slug];
            }

            return $out;
        });

        return collect($rows);
    }

    /** Ранг за місцем у списку популярності. */
    private function rankAt(int $index, int $total): string
    {
        $share = $index / max(1, $total);
        $edge = 0.0;
        foreach (self::SHARE as $rarity => $part) {
            $edge += $part;
            // Найпопулярніша картка виду завжди має найвищий ранг.
            if ($share < $edge || ($index === 0 && $rarity === 'U')) {
                return $rarity;
            }
        }

        return 'N';
    }

    public function packSize(User $user): int
    {
        return self::PACK_SIZE + ($user->isPlus() ? 1 : 0);
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
     * Відкрити щоденний набір: випадкові картки з урахуванням шансів рангу.
     *
     * @return list<array<string, mixed>>
     */
    public function openPack(User $user): array
    {
        $catalog = $this->catalog();
        if ($catalog->isEmpty()) {
            throw ValidationException::withMessages(['pack' => 'Каталог карток поки порожній.']);
        }

        return DB::transaction(function () use ($user, $catalog) {
            $wallet = DB::table('card_wallets')->where('user_id', $user->id)->lockForUpdate()->first();
            if ($wallet && $wallet->pack_at && now()->parse($wallet->pack_at)->addDay()->isFuture()) {
                throw ValidationException::withMessages(['pack' => 'Наступний набір буде доступний пізніше.']);
            }
            $byRarity = $catalog->groupBy('rarity');
            $owned = DB::table('user_cards')->where('user_id', $user->id)->pluck('copies', 'card_key');
            $drawn = [];
            for ($i = 0; $i < $this->packSize($user); $i++) {
                $card = $this->pool($byRarity, $this->rollRarity())->random();
                $isNew = ! isset($owned[$card['key']]);
                $owned[$card['key']] = ($owned[$card['key']] ?? 0) + 1;
                DB::table('user_cards')->upsert(
                    [['user_id' => $user->id, 'card_key' => $card['key'], 'game_id' => $card['kind'] === 'game' ? (int) substr($card['key'], 1) : null, 'copies' => 1, 'created_at' => now(), 'updated_at' => now()]],
                    ['user_id', 'card_key'],
                    ['copies' => DB::raw('user_cards.copies + 1'), 'updated_at' => now()],
                );
                $drawn[] = [...$card, 'new' => $isNew];
            }
            DB::table('card_wallets')->upsert(
                [['user_id' => $user->id, 'pack_at' => now(), 'packs_opened' => 1, 'shards' => 0, 'created_at' => now(), 'updated_at' => now()]],
                ['user_id'],
                ['pack_at' => now(), 'packs_opened' => DB::raw('card_wallets.packs_opened + 1'), 'updated_at' => now()],
            );
            Log::info('cards: pack opened', ['user' => $user->id, 'cards' => array_column($drawn, 'key')]);

            return $drawn;
        });
    }

    /**
     * Картки рангу; якщо таких немає — найближчий нижчий ранг з картками (потім вищий).
     *
     * @param  Collection<string, Collection<int, array<string, mixed>>>  $byRarity
     * @return Collection<int, array<string, mixed>>
     */
    private function pool(Collection $byRarity, string $rarity): Collection
    {
        $i = (int) array_search($rarity, self::RARITIES, true);
        for ($j = $i; $j >= 0; $j--) {
            if ($byRarity->has(self::RARITIES[$j])) {
                return $byRarity->get(self::RARITIES[$j]);
            }
        }
        for ($j = $i + 1; $j < count(self::RARITIES); $j++) {
            if ($byRarity->has(self::RARITIES[$j])) {
                return $byRarity->get(self::RARITIES[$j]);
            }
        }

        return $byRarity->flatten(1);
    }

    private function rollRarity(): string
    {
        $roll = random_int(1, 1000);
        foreach (array_reverse(self::DROP, true) as $rarity => $chance) {
            if ($roll <= $chance) {
                return $rarity;
            }
            $roll -= $chance;
        }

        return 'N';
    }

    /** Розібрати всі дублікати (лишається по одній картці). Повертає отримані уламки. */
    public function dustDuplicates(User $user): int
    {
        $catalog = $this->catalog();

        return DB::transaction(function () use ($user, $catalog) {
            $rows = DB::table('user_cards')->where('user_id', $user->id)->where('copies', '>', 1)->lockForUpdate()->get(['id', 'card_key', 'copies']);
            $gain = 0;
            foreach ($rows as $row) {
                $gain += ($row->copies - 1) * $this->dust($catalog->get($row->card_key)['rarity'] ?? 'N');
            }
            if ($gain > 0) {
                DB::table('user_cards')->whereIn('id', $rows->pluck('id'))->update(['copies' => 1, 'updated_at' => now()]);
                $this->addShards($user, $gain);
            }

            return $gain;
        });
    }

    /** Створити картку з уламків (лише якої ще немає). */
    public function craft(User $user, string $key): void
    {
        $card = $this->catalog()->get($key);
        abort_unless($card !== null, 404);
        DB::transaction(function () use ($user, $card) {
            $shards = (int) DB::table('card_wallets')->where('user_id', $user->id)->lockForUpdate()->value('shards');
            $cost = $this->craftCost($card['rarity']);
            if (DB::table('user_cards')->where('user_id', $user->id)->where('card_key', $card['key'])->exists()) {
                throw ValidationException::withMessages(['card' => 'Ця картка вже є у вашій колекції.']);
            }
            if ($shards < $cost) {
                throw ValidationException::withMessages(['card' => 'Бракує уламків.']);
            }
            DB::table('card_wallets')->where('user_id', $user->id)->decrement('shards', $cost);
            DB::table('user_cards')->insert(['user_id' => $user->id, 'card_key' => $card['key'], 'game_id' => $card['kind'] === 'game' ? (int) substr($card['key'], 1) : null, 'copies' => 1, 'created_at' => now(), 'updated_at' => now()]);
        });
    }

    /** Вітрина профілю: до трьох карток. */
    public function toggleShowcase(User $user, string $key): void
    {
        $row = DB::table('user_cards')->where('user_id', $user->id)->where('card_key', $key)->first(['id', 'showcase']);
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
        $owned = DB::table('user_cards')->where('user_id', $user->id)->get(['card_key', 'copies', 'showcase'])->keyBy('card_key');
        $cards = $this->catalog()->map(fn (array $c) => [
            ...$c,
            'copies' => (int) ($owned[$c['key']]->copies ?? 0),
            'showcase' => (bool) ($owned[$c['key']]->showcase ?? false),
        ])->values();
        $sets = $cards->groupBy(fn ($c) => $c['kind'].'|'.$c['set'])->map(fn (Collection $g) => [
            'kind' => $g->first()['kind'], 'name' => $g->first()['set'], 'total' => $g->count(), 'owned' => $g->where('copies', '>', 0)->count(),
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
            'ranks' => array_map(fn (string $r) => ['rank' => $r, 'drop' => self::DROP[$r] / 10, 'dust' => $this->dust($r), 'craft' => $this->craftCost($r)], self::RARITIES),
        ];
    }

    /**
     * Вітрина для профілю: обрані картки (або три найрідкісніші) і скільки зібрано.
     *
     * @return array{cards: list<array<string, mixed>>, owned: int, total: int}|null
     */
    public function showcase(User $user): ?array
    {
        $rows = DB::table('user_cards')->where('user_id', $user->id)->get(['card_key', 'showcase']);
        if ($rows->isEmpty()) {
            return null;
        }
        $catalog = $this->catalog();
        $order = array_flip(self::RARITIES);
        $picked = $rows->where('showcase', true)->pluck('card_key');
        if ($picked->isEmpty()) {
            $picked = $rows->pluck('card_key')->sortByDesc(fn ($key) => $order[$catalog->get($key)['rarity'] ?? 'N'])->take(self::SHOWCASE_MAX);
        }

        return [
            'cards' => $picked->map(fn ($key) => $catalog->get($key))->filter()->values()->all(),
            'owned' => $rows->count(),
            'total' => $catalog->count(),
        ];
    }
}
