<?php

namespace Addons\Progression\Services;

use Addons\Progression\Events\AchievementUnlocked;
use Addons\Progression\Models\Achievement;
use Addons\Progression\Models\ProgressionProfile;
use Addons\Progression\Models\UserAchievement;
use Addons\Progression\Models\XpLedgerEntry;
use Addons\Reports\Models\Report;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

/**
 * Единая точка входа для всего, что связано с прогрессом участника.
 * Публичный awardXp() — тот самый метод, через который Member Center (в
 * будущем) будет делать ручные корректировки статистики, как описано в
 * брифе для раздела Member Center & HR.
 */
class ProgressionService
{
    // XP за события — фиксировано брифом.
    private const XP_KAPT_WIN = 120;
    private const XP_KAPT_LOSS = 40;
    private const XP_CONTRACT = ['light' => 30, 'medium' => 45, 'heavy' => 60];
    // bizwar/investment — брифом не описані (це пізніший запит), тому
    // значення підібрані за аналогією з KAPT/Контрактом і легко
    // підкрутити тут однією цифрою, якщо не підійдуть.
    private const XP_BIZWAR_WIN = 100;
    private const XP_BIZWAR_LOSS = 35;
    private const XP_INVESTMENT = 50;

    // Бонусы еженедельных челленджей.
    private const WEEKLY_KAPT_WINS_THRESHOLD = 5;
    private const WEEKLY_KAPT_WINS_BONUS = 300;
    private const WEEKLY_CONTRACTS_THRESHOLD = 10;
    private const WEEKLY_CONTRACTS_BONUS = 250;

    // Sharpshooter: критерий не задан брифом явно — фиксирую как константу,
    // чтобы можно было поменять одной строкой без переписывания логики.
    private const SHARPSHOOTER_HEAVY_CONTRACTS = 10;

    // Нові рубежі: загальна кількість затверджених звітів (будь-якого типу)
    // і сукупна сума інвестицій — обидва без прив'язки до брифа, підібрані
    // за аналогією з контрактами/стріком.
    private const REPORTS_MILESTONES = [10, 50, 100];
    private const INVESTMENT_MILESTONES = [10000, 50000, 100000];

    public function profileFor(User $user): ProgressionProfile
    {
        return ProgressionProfile::firstOrCreate(['user_id' => $user->id]);
    }

    /**
     * Общий метод начисления XP — и для событий отчётов, и для ручных
     * корректировок администратором/офицером.
     */
    public function awardXp(
        User $user,
        int $amount,
        string $reason,
        string $sourceType,
        ?int $sourceId = null,
        ?User $awardedBy = null,
    ): void {
        DB::transaction(function () use ($user, $amount, $reason, $sourceType, $sourceId, $awardedBy) {
            $profile = $this->profileFor($user);

            XpLedgerEntry::create([
                'user_id' => $user->id,
                'amount' => $amount,
                'reason' => $reason,
                'source_type' => $sourceType,
                'source_id' => $sourceId,
                'awarded_by' => $awardedBy?->id,
            ]);

            $profile->increment('xp', $amount);
            $profile->update(['last_activity_at' => now()]);
        });
    }

    /**
     * Вызывается слушателем report.reviewed ТОЛЬКО для status=approved.
     * type=other не начисляет XP — брифом не определено.
     */
    public function handleApprovedReport(Report $report): void
    {
        $user = $report->user;
        $profile = $this->profileFor($user);

        // Рубіж "N звітів" — про БУДЬ-ЯКИЙ тип, включно з "інше", яке саме
        // по собі XP не приносить: рахуємо сам факт затвердженого звіту, а
        // не конкретний внесок.
        $reportsBefore = $profile->reports_total;
        $profile->increment('reports_total');
        $reportsAfter = $profile->fresh()->reports_total;
        foreach (self::REPORTS_MILESTONES as $threshold) {
            if ($reportsBefore < $threshold && $reportsAfter >= $threshold) {
                $this->unlock($user, "reports_{$threshold}");
            }
        }

        if ($report->type === 'kapt') {
            $isWin = $report->outcome === 'win';
            $amount = $isWin ? self::XP_KAPT_WIN : self::XP_KAPT_LOSS;

            $wasFirstWin = $isWin && $profile->kapt_wins === 0;

            if ($isWin) {
                $profile->increment('kapt_wins');
            } else {
                $profile->increment('kapt_losses');
            }

            $this->applyStreak($user, $profile, $isWin ? 1 : 0, $isWin ? 0 : 1);

            $this->awardXp($user, $amount, "KAPT {$report->outcome}", 'report', $report->id);

            if ($wasFirstWin) {
                $this->unlock($user, 'first_blood');
            }
        } elseif ($report->type === 'contract') {
            $contractsBefore = $profile->contracts_count;
            $heavyBefore = $profile->heavy_contracts_count;

            if ($report->weight !== null) {
                // Історичний формат: один звіт — один контракт однієї ваги.
                $light = $report->weight === 'light' ? 1 : 0;
                $medium = $report->weight === 'medium' ? 1 : 0;
                $heavy = $report->weight === 'heavy' ? 1 : 0;
                $reason = "Контракт ({$report->weight})";
            } else {
                // Пакетний формат: скільки контрактів кожної ваги набралось за дату.
                $light = $report->light_count ?? 0;
                $medium = $report->medium_count ?? 0;
                $heavy = $report->heavy_count ?? 0;
                $reason = "Контракти (л:{$light} с:{$medium} т:{$heavy})";
            }

            $amount = $light * self::XP_CONTRACT['light']
                + $medium * self::XP_CONTRACT['medium']
                + $heavy * self::XP_CONTRACT['heavy'];

            $profile->increment('contracts_count', $light + $medium + $heavy);
            if ($heavy > 0) {
                $profile->increment('heavy_contracts_count', $heavy);
            }

            $this->awardXp($user, $amount, $reason, 'report', $report->id);

            // Пакетний звіт може одразу перестрибнути поріг (наприклад,
            // з 23 на 28) — тому дивимось, чи поріг ліг МІЖ старим і новим
            // значенням, а не чи новe значення рівне порогу.
            $freshProfile = $profile->fresh();
            foreach ([25, 100, 250] as $threshold) {
                if ($contractsBefore < $threshold && $freshProfile->contracts_count >= $threshold) {
                    $this->unlock($user, "contracts_{$threshold}");
                }
            }
            if ($heavyBefore < self::SHARPSHOOTER_HEAVY_CONTRACTS && $freshProfile->heavy_contracts_count >= self::SHARPSHOOTER_HEAVY_CONTRACTS) {
                $this->unlock($user, 'sharpshooter');
            }
        } elseif ($report->type === 'bizwar') {
            // Пакетний звіт (кілька перемог/поразок за дату відразу) —
            // достеменний порядок подій усередині нього невідомий, тому
            // стрік рахуємо консервативно: applyStreak() нижче.
            $wins = $report->wins_count ?? 0;
            $losses = $report->losses_count ?? 0;
            $amount = $wins * self::XP_BIZWAR_WIN + $losses * self::XP_BIZWAR_LOSS;

            $this->applyStreak($user, $profile, $wins, $losses);

            $this->awardXp($user, $amount, "Бізвар (W:{$wins} L:{$losses})", 'report', $report->id);
        } elseif ($report->type === 'investment') {
            $investmentBefore = $profile->investment_total;
            $profile->increment('investment_total', $report->amount ?? 0);
            $investmentAfter = $profile->fresh()->investment_total;

            $this->awardXp($user, self::XP_INVESTMENT, "Інвестиція ({$report->amount})", 'report', $report->id);

            foreach (self::INVESTMENT_MILESTONES as $threshold) {
                if ($investmentBefore < $threshold && $investmentAfter >= $threshold) {
                    $this->unlock($user, "investments_{$threshold}");
                }
            }
        }
        // type=other: без начисления XP, только сам факт репорта остаётся в reports.
    }

    /**
     * Спільна логіка стріку для kapt (завжди $wins=1 XOR $losses=1) і
     * бізвару (пакетні лічильники, можуть прийти обидва одразу).
     *
     * Будь-яка поразка в пакеті рве стрік до нуля — навіть якщо в тому ж
     * пакеті були й перемоги: порядок подій усередині одного пакетного
     * звіту невідомий, тож "поразка десь була" чесніше рахувати як розрив,
     * а не додавати перемоги поверх старого стріку.
     *
     * Пороги досягнень перевіряються переходом ДО/ПІСЛЯ (а не точним
     * значенням) — пакетний приріст може одразу перестрибнути поріг
     * (наприклад з 3 на 7 за одну відправку).
     */
    private function applyStreak(User $user, ProgressionProfile $profile, int $wins, int $losses): void
    {
        $before = $profile->current_streak;

        if ($losses > 0) {
            $profile->update(['current_streak' => 0]);

            return;
        }

        if ($wins > 0) {
            $profile->increment('current_streak', $wins);
            if ($profile->current_streak > $profile->longest_streak) {
                $profile->update(['longest_streak' => $profile->current_streak]);
            }
        }

        $after = $profile->fresh()->current_streak;
        foreach ([5, 15, 30] as $threshold) {
            if ($before < $threshold && $after >= $threshold) {
                $this->unlock($user, "streak_{$threshold}");
            }
        }
    }

    private function unlock(User $user, string $achievementCode): void
    {
        $achievement = Achievement::where('code', $achievementCode)->first();
        if (! $achievement) {
            return;
        }

        $userAchievement = UserAchievement::firstOrCreate(
            ['user_id' => $user->id, 'achievement_id' => $achievement->id],
            ['earned_at' => now()],
        );

        if ($userAchievement->wasRecentlyCreated) {
            Event::dispatch(new AchievementUnlocked($user->id, $achievement->code, $achievement->name));
        }
    }

    /**
     * Тижневий бонус — рахує ЗАТВЕРДЖЕНІ звіти в межах поточного тижня
     * (Sunday 20:00 Europe/Kyiv за брифом) і нараховує XP, якщо пороги
     * досягнуто. Викликається scheduled-таском щотижня.
     */
    public function runWeeklyBonuses(): void
    {
        // "Последнее воскресенье 20:00 Europe/Kyiv, которое уже наступило" —
        // startOfWeek(SUNDAY) даёт воскресенье ТЕКУЩЕЙ недели (может быть
        // сегодня), а не "предыдущее" в смысле Carbon::previous() (который
        // всегда откатывает минимум на неделю назад, даже если сегодня уже
        // воскресенье после 20:00 — это давало неверную границу).
        $now = now('Europe/Kyiv');
        $weekStart = $now->copy()->startOfWeek(\Carbon\Carbon::SUNDAY)->setTime(20, 0);
        if ($weekStart->gt($now)) {
            $weekStart->subWeek();
        }

        $userIds = Report::query()
            ->where('status', 'approved')
            ->where('reviewed_at', '>=', $weekStart)
            ->pluck('user_id')
            ->unique();

        foreach ($userIds as $userId) {
            $user = User::find($userId);
            if (! $user) {
                continue;
            }

            // KAPT прибрано з форми подачі — перемоги за тиждень тепер
            // рахуються з бізвару (wins_count у пакетному звіті), а не з
            // окремих type=kapt рядків. Старі kapt-рядки (approved ще ДО
            // переходу на бізвар, але вже в межах поточного тижневого вікна)
            // теж рахуємо — щоб не губити межовий тиждень міграції формату.
            $legacyKaptWins = Report::query()
                ->where('user_id', $userId)->where('status', 'approved')
                ->where('type', 'kapt')->where('outcome', 'win')
                ->where('reviewed_at', '>=', $weekStart)->count();

            $bizwarWins = (int) Report::query()
                ->where('user_id', $userId)->where('status', 'approved')
                ->where('type', 'bizwar')
                ->where('reviewed_at', '>=', $weekStart)->sum('wins_count');

            $kaptWins = $legacyKaptWins + $bizwarWins;

            // Контракти теж подаються пакетом (light/medium/heavy_count за
            // одну дату) — рахуємо СКІЛЬКИ контрактів, а не скільки звітів
            // надіслано: один пакетний звіт може одразу закрити поріг.
            $contracts = Report::query()
                ->where('user_id', $userId)->where('status', 'approved')
                ->where('type', 'contract')
                ->where('reviewed_at', '>=', $weekStart)
                ->get(['weight', 'light_count', 'medium_count', 'heavy_count'])
                ->sum(fn (Report $r) => $r->weight !== null
                    ? 1
                    : (($r->light_count ?? 0) + ($r->medium_count ?? 0) + ($r->heavy_count ?? 0)));

            if ($kaptWins >= self::WEEKLY_KAPT_WINS_THRESHOLD) {
                $this->awardXp($user, self::WEEKLY_KAPT_WINS_BONUS, 'Тижневий бонус: 5+ перемог бізвару', 'weekly_bonus');
            }
            if ($contracts >= self::WEEKLY_CONTRACTS_THRESHOLD) {
                $this->awardXp($user, self::WEEKLY_CONTRACTS_BONUS, 'Тижневий бонус: 10+ контрактів', 'weekly_bonus');
            }
        }
    }
}
