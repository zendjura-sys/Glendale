<?php

namespace App\Services\Quests;

use App\Models\QuestClaim;
use App\Models\Season;
use App\Models\SeasonPassClaim;
use App\Models\StickerPack;
use App\Models\User;
use App\Models\UserCosmetic;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Сезонний пропуск: очки сезону (з щоденних завдань) заповнюють рівні місяця, за рівні — нагороди
 * на двох доріжках: безкоштовній і GameCon+ (лише з активною підпискою). Нагороди косметичні:
 * рамка аватара, колір ніку, значок, ефект шапки профілю, набір стікерів або разовий досвід.
 * Отримане лягає в інвентар, звідки людина вдягає косметику (users.cosmetics).
 */
class SeasonPass
{
    public const TRACKS = ['free', 'plus'];

    /** Що можна вдягнути (решта діє одразу: досвід, стікери). */
    public const EQUIPPABLE = ['frame', 'name', 'badge', 'header'];

    public const TYPES = ['frame', 'name', 'badge', 'header', 'stickers', 'xp'];

    public function __construct(private readonly DailyQuests $quests) {}

    public function maxLevel(): int
    {
        return max(1, (int) config('season_pass.levels', 30));
    }

    public function currentKey(): string
    {
        return $this->quests->season();
    }

    /** Сезон за ключем Y-m (без запису — з типовими значеннями). */
    public function find(?string $key = null): Season
    {
        $key ??= $this->currentKey();

        return Season::query()->where('key', $key)->first() ?? new Season([
            'key' => $key,
            'title' => 'Сезон '.$key,
            'theme' => array_key_first((array) config('season_pass.themes')) ?? 'neon',
        ]);
    }

    /**
     * Скільки очок треба на кожен рівень.
     *
     * @return list<int>
     */
    public function costs(Season $season): array
    {
        $default = max(1, (int) config('season_pass.points_per_level', 50));
        $levels = is_array($season->levels) ? array_values($season->levels) : [];
        $out = [];
        for ($i = 0; $i < $this->maxLevel(); $i++) {
            $out[] = max(1, (int) ($levels[$i] ?? $default));
        }

        return $out;
    }

    /**
     * Рівень за очками: скільки рівнів пройдено, скільки очок уже в наступному і скільки на нього треба.
     *
     * @param  list<int>  $costs
     * @return array{level: int, into: int, need: int}
     */
    public function levelFor(int $points, array $costs): array
    {
        $level = 0;
        $left = max(0, $points);
        foreach ($costs as $cost) {
            if ($left < $cost) {
                return ['level' => $level, 'into' => $left, 'need' => $cost];
            }
            $left -= $cost;
            $level++;
        }

        return ['level' => $level, 'into' => 0, 'need' => 0];
    }

    public function points(User $user, string $key): int
    {
        return (int) QuestClaim::query()->where('user_id', $user->id)->where('season', $key)->sum('xp');
    }

    /**
     * Нагорода з каталогу (null — немає такої).
     *
     * @param  array<string, mixed>|null  $raw
     * @return array{type: string, value: string, name: string, colors?: list<string>, icon?: string, color?: string, xp?: int}|null
     */
    public function reward(?array $raw): ?array
    {
        $type = $raw['type'] ?? null;
        $value = $raw['value'] ?? null;
        if (! is_string($type) || ! is_string($value) || ! in_array($type, self::TYPES, true)) {
            return null;
        }
        if ($type === 'stickers') {
            $name = StickerPack::query()->where('slug', $value)->value('name');

            return is_string($name) ? ['type' => $type, 'value' => $value, 'name' => $name] : null;
        }
        $item = config("season_pass.cosmetics.{$type}.{$value}");
        if (! is_array($item)) {
            return null;
        }
        $out = ['type' => $type, 'value' => $value, 'name' => (string) ($item['name'] ?? $value)];
        if (isset($item['colors']) && is_array($item['colors'])) {
            $out['colors'] = array_values(array_map('strval', $item['colors']));
        }
        if (isset($item['icon'])) {
            $out['icon'] = (string) $item['icon'];
            $out['color'] = (string) ($item['color'] ?? '#6366f1');
        }
        if (isset($item['xp'])) {
            $out['xp'] = (int) $item['xp'];
        }

        return $out;
    }

    /**
     * @return array{type: string, value: string, name: string, colors?: list<string>, icon?: string, color?: string, xp?: int}|null
     */
    public function rewardAt(Season $season, int $level, string $track): ?array
    {
        $raw = $season->rewards[$level][$track] ?? null;

        return is_array($raw) ? $this->reward($raw) : null;
    }

    /**
     * Сторінка пропуску: сезон, рівень, доріжки, інвентар.
     *
     * @return array<string, mixed>
     */
    public function board(User $user): array
    {
        $season = $this->find();
        $costs = $this->costs($season);
        $points = $this->points($user, $season->key);
        $claimed = SeasonPassClaim::query()->where('user_id', $user->id)->where('season', $season->key)
            ->get(['level', 'track'])->map(fn (SeasonPassClaim $c) => $c->level.':'.$c->track)->all();

        return [
            ...$this->seasonCard($season),
            'points' => $points,
            ...$this->levelFor($points, $costs),
            'plus' => $user->isPlus(),
            'levels' => $this->track($season, $costs, $claimed),
            'inventory' => $this->inventory($user),
        ];
    }

    /**
     * Шапка сезону: назва, тема, межі місяця.
     *
     * @return array{season: array{key: string, title: string, theme: string, colors: list<string>, starts_at: string, ends_at: string}, max_level: int}
     */
    public function seasonCard(Season $season): array
    {
        $themes = (array) config('season_pass.themes');
        $theme = array_key_exists($season->theme, $themes) ? $season->theme : (string) array_key_first($themes);
        $start = Carbon::createFromFormat('Y-m', $season->key, 'Europe/Kyiv')->startOfMonth();

        return [
            'season' => [
                'key' => $season->key,
                'title' => $season->title,
                'theme' => $theme,
                'colors' => array_values(array_map('strval', (array) ($themes[$theme]['colors'] ?? ['#1e1b4b', '#4338ca']))),
                'starts_at' => $start->toIso8601String(),
                'ends_at' => $start->copy()->endOfMonth()->toIso8601String(),
            ],
            'max_level' => $this->maxLevel(),
        ];
    }

    /**
     * Рівні з нагородами обох доріжок.
     *
     * @param  list<int>  $costs
     * @param  array<int, string>  $claimed  «рівень:доріжка»
     * @return list<array<string, mixed>>
     */
    public function track(Season $season, array $costs, array $claimed = []): array
    {
        $rows = [];
        $total = 0;
        foreach ($costs as $i => $cost) {
            $level = $i + 1;
            $total += $cost;
            $rows[] = [
                'level' => $level,
                'cost' => $cost,
                'total' => $total,
                'free' => $this->rewardAt($season, $level, 'free'),
                'plus' => $this->rewardAt($season, $level, 'plus'),
                'free_claimed' => in_array("{$level}:free", $claimed, true),
                'plus_claimed' => in_array("{$level}:plus", $claimed, true),
            ];
        }

        return $rows;
    }

    /**
     * Забрати нагороду рівня. Повторний виклик нічого не видає вдруге.
     *
     * @return array{reward: array<string, mixed>, fresh: bool}
     */
    public function claim(User $user, int $level, string $track): array
    {
        if (! in_array($track, self::TRACKS, true) || $level < 1 || $level > $this->maxLevel()) {
            throw ValidationException::withMessages(['level' => 'Такого рівня немає.']);
        }
        $season = $this->find();
        $reward = $this->rewardAt($season, $level, $track);
        if ($reward === null) {
            throw ValidationException::withMessages(['level' => 'На цьому рівні немає нагороди.']);
        }
        if ($track === 'plus' && ! $user->isPlus()) {
            throw ValidationException::withMessages(['level' => 'Нагороди цієї доріжки — з GameCon+.']);
        }
        if ($this->levelFor($this->points($user, $season->key), $this->costs($season))['level'] < $level) {
            throw ValidationException::withMessages(['level' => 'Рівень ще не досягнуто.']);
        }

        $fresh = DB::transaction(function () use ($user, $season, $level, $track, $reward) {
            $claim = SeasonPassClaim::query()->firstOrCreate(
                ['user_id' => $user->id, 'season' => $season->key, 'level' => $level, 'track' => $track],
                ['type' => $reward['type'], 'value' => $reward['value'], 'xp' => $reward['xp'] ?? 0],
            );
            if ($claim->wasRecentlyCreated && $reward['type'] !== 'xp') {
                UserCosmetic::query()->firstOrCreate(
                    ['user_id' => $user->id, 'type' => $reward['type'], 'value' => $reward['value']],
                    ['source' => 'season:'.$season->key],
                );
            }

            return $claim->wasRecentlyCreated;
        });
        if ($fresh && $reward['type'] === 'xp') {
            Cache::forget("achievements.{$user->id}");
        }
        if ($fresh && $reward['type'] === 'stickers') {
            Cache::forget("season_pass.stickers.{$user->id}");
        }

        return ['reward' => $reward, 'fresh' => $fresh];
    }

    /** Вдягнути косметику з інвентаря (null — зняти). */
    public function equip(User $user, string $type, ?string $value): void
    {
        if (! in_array($type, self::EQUIPPABLE, true)) {
            throw ValidationException::withMessages(['type' => 'Це не можна вдягнути.']);
        }
        if ($value !== null && ! UserCosmetic::query()->where('user_id', $user->id)->where('type', $type)->where('value', $value)->exists()) {
            throw ValidationException::withMessages(['value' => 'Цього немає у вашому інвентарі.']);
        }
        $equipped = is_array($user->cosmetics) ? $user->cosmetics : [];
        if ($value === null) {
            unset($equipped[$type]);
        } else {
            $equipped[$type] = $value;
        }
        $user->forceFill(['cosmetics' => $equipped === [] ? null : $equipped])->save();
    }

    /**
     * Інвентар із позначкою «вдягнуто».
     *
     * @return list<array<string, mixed>>
     */
    public function inventory(User $user): array
    {
        $equipped = is_array($user->cosmetics) ? $user->cosmetics : [];
        $out = [];
        foreach (UserCosmetic::query()->where('user_id', $user->id)->orderByDesc('id')->get() as $item) {
            $reward = $this->reward(['type' => $item->type, 'value' => $item->value]);
            if ($reward !== null) {
                $out[] = [
                    ...$reward,
                    'equippable' => in_array($item->type, self::EQUIPPABLE, true),
                    'equipped' => ($equipped[$item->type] ?? null) === $item->value,
                    'source' => $item->source,
                ];
            }
        }

        return $out;
    }

    /** Досвід із нагород пропуску (у рівень профілю, Achievements). */
    public function bonusXp(User $user): int
    {
        return (int) SeasonPassClaim::query()->where('user_id', $user->id)->sum('xp');
    }

    /**
     * Набори стікерів, відкриті нагородами пропуску.
     *
     * @return list<string>
     */
    public function stickerPacks(User $user): array
    {
        /** @var list<string> */
        return Cache::remember("season_pass.stickers.{$user->id}", 600, fn () => UserCosmetic::query()
            ->where('user_id', $user->id)->where('type', 'stickers')->pluck('value')->all());
    }

    /**
     * Каталог для адмінки: тип → варіанти.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    public function catalog(): array
    {
        $out = [];
        foreach (self::TYPES as $type) {
            $values = $type === 'stickers'
                ? StickerPack::query()->orderBy('position')->orderBy('id')->pluck('slug')->all()
                : array_keys((array) config("season_pass.cosmetics.{$type}"));
            $out[$type] = array_values(array_filter(array_map(
                fn ($value) => $this->reward(['type' => $type, 'value' => (string) $value]),
                $values,
            )));
        }

        return $out;
    }

    /**
     * Вдягнута косметика для картки користувача (лише значення з каталогу; null — нічого не вдягнуто).
     *
     * @param  array<string, mixed>|null  $equipped
     * @return array{frame: list<string>|null, name: list<string>|null, badge: array{icon: string, color: string, name: string}|null}|null
     */
    public static function card(?array $equipped): ?array
    {
        if (! $equipped) {
            return null;
        }
        $colors = function (string $type) use ($equipped): ?array {
            $key = $equipped[$type] ?? null;
            $colors = is_string($key) ? config("season_pass.cosmetics.{$type}.{$key}.colors") : null;

            return is_array($colors) && $colors !== [] ? array_values(array_map('strval', $colors)) : null;
        };
        $badgeKey = $equipped['badge'] ?? null;
        $badge = is_string($badgeKey) ? config("season_pass.cosmetics.badge.{$badgeKey}") : null;
        $card = [
            'frame' => $colors('frame'),
            'name' => $colors('name'),
            'badge' => is_array($badge) ? ['icon' => (string) $badge['icon'], 'color' => (string) $badge['color'], 'name' => (string) $badge['name']] : null,
        ];

        return array_filter($card) === [] ? null : $card;
    }

    /**
     * Вдягнутий ефект шапки профілю.
     *
     * @param  array<string, mixed>|null  $equipped
     */
    public static function header(?array $equipped): ?string
    {
        $key = $equipped['header'] ?? null;

        return is_string($key) && array_key_exists($key, (array) config('season_pass.cosmetics.header')) ? $key : null;
    }
}
