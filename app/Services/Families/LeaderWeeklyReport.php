<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilyReport;
use Illuminate\Support\Facades\Cache;

/**
 * Тижневий звіт лідеру й заступникам із правом «members.manage»: хто тягнув сім’ю цього тижня,
 * скільки звітів схвалено і хто зовсім без активності — щоб вчасно помітити, а не на кінець сезону.
 * Приходить сповіщенням (дзвіночок + пуш) у неділю разом із тижневим звітом виплат.
 */
class LeaderWeeklyReport
{
    /** Скількох найактивніших і «тихих» називати поіменно. */
    private const NAMES = 3;

    public function __construct(
        private readonly FamilyRating $rating,
        private readonly FamilyNotifier $notifier,
    ) {}

    /**
     * @return array{top: list<string>, points: int, reports: int, quiet: int, quiet_names: list<string>}
     */
    public function build(Family $family): array
    {
        $rows = $this->rating->leaderboard($family, 'week');
        $active = array_values(array_filter($rows, fn (array $r) => (int) $r['points'] > 0));
        $quiet = array_values(array_filter($rows, fn (array $r) => (int) $r['points'] <= 0));
        ['start' => $start] = WeeklyDigest::week();

        return [
            'top' => array_map(fn (array $r) => (string) $r['display'], array_slice($active, 0, self::NAMES)),
            'points' => array_sum(array_map(fn (array $r) => (int) $r['points'], $rows)),
            'reports' => FamilyReport::query()->where('family_id', $family->id)->where('status', FamilyReport::STATUS_APPROVED)
                ->where('reviewed_at', '>=', $start->utc())->count(),
            'quiet' => count($quiet),
            'quiet_names' => array_map(fn (array $r) => (string) $r['display'], array_slice($quiet, 0, self::NAMES)),
        ];
    }

    /**
     * Надіслати раз на тиждень; повертає зведення або null, якщо вже надсилали.
     *
     * @return array<string, mixed>|null
     */
    public function send(Family $family, bool $force = false): ?array
    {
        ['start' => $start] = WeeklyDigest::week();
        $key = 'family.leader-report.'.$family->id.'.'.$start->format('o-W');
        if (! $force && Cache::has($key)) {
            return null;
        }
        $data = $this->build($family);
        $text = 'Тиждень у сім’ї: '.$data['reports'].' звітів схвалено, '.$data['points'].' балів.';
        if ($data['top'] !== []) {
            $text .= ' Найактивніші: '.implode(', ', $data['top']).'.';
        }
        if ($data['quiet'] > 0) {
            $text .= ' Без активності: '.$data['quiet'].($data['quiet_names'] !== [] ? ' ('.implode(', ', $data['quiet_names']).($data['quiet'] > count($data['quiet_names']) ? '…' : '').')' : '').'.';
        }
        $this->notifier->holders($family, 'members.manage', 'weekly_report', $text, route('families.rating', $family, absolute: false));
        Cache::put($key, true, now()->addDays(8));

        return $data;
    }
}
