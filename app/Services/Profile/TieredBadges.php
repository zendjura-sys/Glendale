<?php

namespace App\Services\Profile;

use App\Models\GameBacklog;
use App\Models\PlayedPlace;
use App\Models\PlusGrant;
use App\Models\QuestClaim;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\Presence\SteamPresence;
use App\Support\Modules\ModuleManager;
use Illuminate\Support\Facades\Cache;

/**
 * Багаторівневі значки (як у Discord): лічильник, рівні з порогами, колір рівня й прогрес до наступного.
 * Рахуються з наявних даних (ігри, Steam, підписки, подарунки, просування спільнот, завдання) — окремої таблиці немає.
 */
class TieredBadges
{
    /**
     * Кольори рівнів: сірий → зелений → бірюзовий → блакитний → синій → золото → «лід» (без фіолетового й рожевого).
     */
    public const TIER_COLORS = ['#94A3B8', '#22C55E', '#14B8A6', '#38BDF8', '#3B82F6', '#F59E0B', '#A5F3FC'];

    /**
     * @var list<array{key: string, title: string, category: string, icon: string, unit: string, tiers: list<int>, hint: string, href?: string, module?: string}>
     */
    private const BADGES = [
        ['key' => 'games', 'title' => 'Різні ігри', 'category' => 'Ігри', 'icon' => 'gamepad-2', 'unit' => 'ігор', 'tiers' => [2, 5, 10, 15, 20, 30, 40, 60, 80, 100], 'hint' => 'Грайте в нові ігри: їх видно в «Граю в…», беклозі й бібліотеці Steam.', 'module' => 'games'],
        ['key' => 'hours', 'title' => 'Час у грі', 'category' => 'Ігри', 'icon' => 'timer', 'unit' => 'год', 'tiers' => [1, 5, 20, 75, 150, 300, 500, 1000, 2000, 5000], 'hint' => 'Підключіть Steam у налаштуваннях — години з бібліотеки зараховуються.'],
        ['key' => 'gifts', 'title' => 'Подарунки', 'category' => 'Спільнота', 'icon' => 'gift', 'unit' => 'подарунків', 'tiers' => [1, 2, 3, 6, 10, 20], 'hint' => 'Подаруйте GameCon+ другові.', 'href' => '/pricing'],
        ['key' => 'tenure', 'title' => 'Стаж', 'category' => 'GameCon', 'icon' => 'cake', 'unit' => 'р.', 'tiers' => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'hint' => 'Рівень росте щороку з дня реєстрації.'],
        ['key' => 'plus', 'title' => 'GameCon+', 'category' => 'GameCon', 'icon' => 'sparkles', 'unit' => 'міс.', 'tiers' => [1, 3, 6, 12, 24, 36, 60, 72], 'hint' => 'Рахуються місяці з GameCon+.', 'href' => '/pricing'],
        ['key' => 'community_support', 'title' => 'Підтримка спільноти', 'category' => 'Спільнота', 'icon' => 'rocket', 'unit' => 'міс.', 'tiers' => [1, 2, 3, 6, 9, 12, 15, 18, 24], 'hint' => 'Просувайте спільноти в каталозі — рахуються місяці просування.', 'href' => '/communities', 'module' => 'communities'],
        ['key' => 'quests', 'title' => 'Завдання', 'category' => 'Активність', 'icon' => 'target', 'unit' => 'завдань', 'tiers' => [10, 30, 100, 300, 1000], 'hint' => 'Виконуйте щоденні завдання.', 'href' => '/quests', 'module' => 'quests'],
    ];

    public function __construct(private readonly SteamPresence $steam) {}

    /**
     * Усі значки людини з рівнем і прогресом (кеш 30 хв).
     *
     * @return list<array<string, mixed>>
     */
    public function for(User $user): array
    {
        /** @var array<string, int> $stats */
        $stats = Cache::remember("tiered-badges.{$user->id}", now()->addMinutes(30), fn () => $this->stats($user));
        $modules = app(ModuleManager::class);
        $out = [];
        foreach (self::BADGES as $badge) {
            if (isset($badge['module']) && ! $modules->enabled($badge['module'])) {
                continue;
            }
            $value = $stats[$badge['key']] ?? 0;
            $level = 0;
            foreach ($badge['tiers'] as $i => $threshold) {
                if ($value >= $threshold) {
                    $level = $i + 1;
                }
            }
            $next = $badge['tiers'][$level] ?? null;
            $out[] = [
                'key' => $badge['key'],
                'title' => $badge['title'],
                'category' => $badge['category'],
                'icon' => $badge['icon'],
                'unit' => $badge['unit'],
                'hint' => $badge['hint'],
                'href' => $badge['href'] ?? null,
                'value' => $value,
                'level' => $level,
                'levels' => count($badge['tiers']),
                'tiers' => $badge['tiers'],
                'next' => $next,
                'color' => self::TIER_COLORS[min(count(self::TIER_COLORS) - 1, intdiv(max(0, $level - 1) * count(self::TIER_COLORS), max(1, count($badge['tiers']))))],
                'colors' => array_map(fn (int $i) => self::TIER_COLORS[min(count(self::TIER_COLORS) - 1, intdiv($i * count(self::TIER_COLORS), count($badge['tiers'])))], array_keys($badge['tiers'])),
            ];
        }
        // Отримані — першими, вищі рівні — раніше.
        usort($out, fn (array $a, array $b) => [$b['level'] > 0, $b['level']] <=> [$a['level'] > 0, $a['level']]);

        return $out;
    }

    public function forget(User $user): void
    {
        Cache::forget("tiered-badges.{$user->id}");
    }

    /**
     * Очки за завдання — внутрішня «валюта» профілю (лише показ, не гроші й не ціни).
     */
    public function questPoints(User $user): int
    {
        return (int) QuestClaim::query()->where('user_id', $user->id)->sum('xp');
    }

    /**
     * @return array<string, int>
     */
    private function stats(User $user): array
    {
        $library = $this->steam->library($user);
        $gameIds = PlayedPlace::query()->where('user_id', $user->id)->where('kind', PlayedPlace::GAME)->pluck('subject_id')
            ->merge(GameBacklog::query()->where('user_id', $user->id)->whereIn('status', [GameBacklog::PLAYING, GameBacklog::DONE, GameBacklog::DROPPED])->pluck('game_id'))
            ->unique()->count();
        $plusDays = PlusGrant::query()->where('owner_type', 'user')->where('owner_id', $user->id)->get(['starts_at', 'ends_at'])
            ->sum(fn (PlusGrant $grant) => $grant->starts_at && $grant->ends_at ? (int) $grant->starts_at->diffInDays(min($grant->ends_at, now()), true) : 0);
        // Кожна покупка просування — 7 днів.
        $promoWeeks = WalletTransaction::query()->where('user_id', $user->id)->where('product', 'community_promo')->count();

        return [
            'games' => max($gameIds, count($library)),
            'hours' => (int) collect($library)->sum('hours'),
            'gifts' => PlusGrant::query()->where('source', 'gift')->where('by_user_id', $user->id)->count(),
            'tenure' => $user->created_at ? (int) floor($user->created_at->diffInDays(now(), true) / 365) : 0,
            'plus' => (int) floor($plusDays / 30),
            'community_support' => (int) floor($promoWeeks * 7 / 30),
            'quests' => QuestClaim::query()->where('user_id', $user->id)->count(),
        ];
    }
}
