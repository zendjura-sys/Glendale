<?php

namespace App\Services\Engagement;

use App\Models\User;
use App\Models\UserCosmetic;
use App\Services\Cards\CardCollection;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Календар нагород за щоденний вхід. Цикл — календарний місяць на 28 відміток: кожен день,
 * коли людина заходить і забирає нагороду, відкриває наступну клітинку (пропуски не обнуляють
 * прогрес — просто менше клітинок за місяць). Нагороди — уламки карток, додатковий набір карток
 * і рамка місяця на 28-й відмітці (повторно — уламки). З GameCon+ уламків удвічі більше.
 */
class LoginRewards
{
    public const DAYS = 28;

    public const TZ = 'Europe/Kyiv';

    /**
     * Нагорода клітинки.
     *
     * @return array{kind: string, amount: int, value?: string}
     */
    public function rewardFor(int $day): array
    {
        return match (true) {
            $day === self::DAYS => ['kind' => 'frame', 'amount' => 1, 'value' => 'login_month'],
            $day % 7 === 0 => ['kind' => 'pack', 'amount' => 1],
            $day % 5 === 0 => ['kind' => 'shards', 'amount' => 30],
            default => ['kind' => 'shards', 'amount' => 10],
        };
    }

    private function now(): CarbonInterface
    {
        return now(self::TZ);
    }

    /**
     * Календар людини на поточний місяць.
     *
     * @return array<string, mixed>
     */
    public function board(User $user): array
    {
        $month = $this->now()->format('Y-m');
        $rows = DB::table('login_rewards')->where('user_id', $user->id)->where('month', $month)->orderBy('day')->get(['day', 'claimed_on']);
        $claimed = $rows->count();
        $today = $this->claimedToday($user);
        $plus = $user->isPlus();

        return [
            'month' => $month,
            'claimed' => $claimed,
            'today_claimed' => $today,
            'can_claim' => ! $today && $claimed < self::DAYS,
            'plus' => $plus,
            'days_left' => $this->now()->daysInMonth - $this->now()->day + 1,
            'cells' => array_map(fn (int $day) => [
                'day' => $day,
                ...$this->rewardFor($day),
                'claimed' => $day <= $claimed,
                'next' => $day === $claimed + 1 && ! $today,
                'claimed_on' => $rows->firstWhere('day', $day)->claimed_on ?? null,
            ], range(1, self::DAYS)),
        ];
    }

    public function claimedToday(User $user): bool
    {
        return DB::table('login_rewards')->where('user_id', $user->id)->where('claimed_on', $this->now()->toDateString())->exists();
    }

    /**
     * Забрати нагороду дня.
     *
     * @return array{kind: string, amount: int, value?: string}
     */
    public function claim(User $user): array
    {
        $now = $this->now();
        $month = $now->format('Y-m');

        return DB::transaction(function () use ($user, $now, $month) {
            $claimed = DB::table('login_rewards')->where('user_id', $user->id)->where('month', $month)->lockForUpdate()->count();
            if ($this->claimedToday($user)) {
                throw ValidationException::withMessages(['reward' => 'Сьогоднішню нагороду вже забрано — повертайтеся завтра.']);
            }
            if ($claimed >= self::DAYS) {
                throw ValidationException::withMessages(['reward' => 'Календар цього місяця пройдено.']);
            }
            $day = $claimed + 1;
            $reward = $this->rewardFor($day);
            $cards = app(CardCollection::class);
            switch ($reward['kind']) {
                case 'shards':
                    $reward['amount'] *= $user->isPlus() ? 2 : 1;
                    $cards->addShards($user, $reward['amount']);
                    break;
                case 'pack':
                    $cards->grantPack($user);
                    break;
                case 'frame':
                    $cosmetic = UserCosmetic::query()->firstOrCreate(
                        ['user_id' => $user->id, 'type' => 'frame', 'value' => $reward['value']],
                        ['source' => 'login:'.$month],
                    );
                    if (! $cosmetic->wasRecentlyCreated) {
                        // Рамка вже є — замість неї уламки.
                        $reward = ['kind' => 'shards', 'amount' => 100];
                        $cards->addShards($user, 100);
                    }
                    break;
            }
            DB::table('login_rewards')->insert([
                'user_id' => $user->id, 'month' => $month, 'day' => $day,
                'claimed_on' => $now->toDateString(), 'reward' => $reward['kind'].':'.$reward['amount'], 'created_at' => now(),
            ]);
            Log::info('login_rewards: claimed', ['user' => $user->id, 'day' => $day, 'reward' => $reward]);

            return $reward;
        });
    }
}
