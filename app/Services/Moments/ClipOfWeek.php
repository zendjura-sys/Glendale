<?php

namespace App\Services\Moments;

use App\Models\Moment;
use App\Models\User;
use App\Notifications\ClipOfWeekNotice;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * «Кліп тижня»: момент, що зібрав найбільше вподобань за тиждень (понеділок–неділя за Києвом).
 * Щопонеділка переможець минулого тижня записується в архів, автор отримує сповіщення й бейдж.
 */
class ClipOfWeek
{
    public const ZONE = 'Europe/Kyiv';

    /** Початок тижня (понеділок 00:00 за Києвом) для дати; за замовчуванням — поточного. */
    public static function weekStart(?CarbonImmutable $at = null): CarbonImmutable
    {
        return ($at ?? CarbonImmutable::now(self::ZONE))->setTimezone(self::ZONE)->startOfWeek(CarbonImmutable::MONDAY);
    }

    /**
     * Лідер тижня: id моменту й кількість вподобань, отриманих за тиждень (рівні — раніше доданий).
     *
     * @return array{moment_id: int, likes: int}|null
     */
    public function leader(CarbonImmutable $week): ?array
    {
        $from = $week->utc();
        $to = $week->addWeek()->utc();
        $row = DB::table('moment_likes as l')->join('moments as m', 'm.id', '=', 'l.moment_id')
            ->where('l.created_at', '>=', $from)->where('l.created_at', '<', $to)
            ->whereColumn('l.user_id', '!=', 'm.user_id')
            ->groupBy('l.moment_id')->selectRaw('l.moment_id, COUNT(*) as total, MIN(m.id) as first_id')
            ->orderByDesc('total')->orderBy('first_id')->first();

        return $row ? ['moment_id' => (int) $row->moment_id, 'likes' => (int) $row->total] : null;
    }

    /**
     * Записати переможця минулого тижня (один раз) і сповістити автора. Повертає момент-переможця.
     */
    public function crown(?CarbonImmutable $now = null): ?Moment
    {
        $week = self::weekStart($now)->subWeek();
        if (DB::table('moment_weekly')->where('week', $week->toDateString())->exists()) {
            return null;
        }
        $leader = $this->leader($week);
        if ($leader === null) {
            return null;
        }
        $moment = Moment::query()->with('user')->find($leader['moment_id']);
        if (! $moment instanceof Moment) {
            return null;
        }

        DB::table('moment_weekly')->insert([
            'week' => $week->toDateString(),
            'moment_id' => $moment->id,
            'user_id' => $moment->user_id,
            'likes' => $leader['likes'],
            'created_at' => now(),
        ]);
        $moment->user->notify(new ClipOfWeekNotice($moment->title, $leader['likes'], '/moments?tab=week'));

        return $moment;
    }

    /**
     * Минулі переможці, свіжі — першими (момент може бути вже видалений).
     *
     * @return list<array{week: string, moment_id: int|null, likes: int}>
     */
    public function history(int $limit = 8): array
    {
        return array_values(DB::table('moment_weekly')->orderByDesc('week')->limit($limit)->get()
            ->map(fn ($row) => ['week' => (string) $row->week, 'moment_id' => $row->moment_id !== null ? (int) $row->moment_id : null, 'likes' => (int) $row->likes])
            ->all());
    }

    /** Скільки разів кліп людини ставав «Кліпом тижня». */
    public function wins(User $user): int
    {
        return DB::table('moment_weekly')->where('user_id', $user->id)->count();
    }
}
