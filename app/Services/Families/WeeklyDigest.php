<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\FamilyTransaction;
use App\Support\Money;
use Carbon\CarbonImmutable;

/**
 * Тижневий звіт виплат: лише учасники з нарахуваннями строго більше 1 ₴.
 */
class WeeklyDigest
{
    /** Поріг у копійках: виводимо тих, хто заробив > 1 ₴. */
    public const THRESHOLD = 100;

    private const GROUPS = [
        'report_reward' => 'звіти',
        'event_reward' => 'події',
        'manual_credit' => 'премії',
        'deposit_interest' => 'депозити',
    ];

    public function __construct(
        private readonly FamilyChat $chat,
        private readonly FamilyBot $bot,
        private readonly FamilyAudit $audit,
    ) {}

    /**
     * @return array{start: CarbonImmutable, end: CarbonImmutable}
     */
    public static function week(?CarbonImmutable $at = null): array
    {
        $at = ($at ?? CarbonImmutable::now())->setTimezone(ReportService::TIMEZONE);

        return ['start' => $at->startOfWeek(), 'end' => $at->endOfWeek()];
    }

    /**
     * @return array{lines: list<array{member: FamilyMember, total: int, parts: array<string, int>}>, total: int, start: CarbonImmutable, end: CarbonImmutable}
     */
    public function build(Family $family, ?CarbonImmutable $at = null): array
    {
        ['start' => $start, 'end' => $end] = self::week($at);

        $rows = FamilyTransaction::query()
            ->where('family_id', $family->id)
            ->whereIn('type', FamilyTransaction::EARNINGS)
            ->where('amount', '>', 0)
            ->whereBetween('created_at', [$start->utc(), $end->utc()])
            ->selectRaw('member_id, type, sum(amount) as total')
            ->groupBy('member_id', 'type')
            ->get();

        $members = FamilyMember::query()->whereKey($rows->pluck('member_id')->unique()->all())->get()->keyBy('id');

        $grouped = $this->emptyDigestGroups();
        foreach ($rows as $transaction) {
            $memberId = $transaction->member_id;
            if ($memberId === null) {
                continue;
            }
            $amount = $transaction->getAttribute('total');
            $value = is_numeric($amount) ? (int) $amount : 0;
            if (! array_key_exists($memberId, $grouped)) {
                $grouped[$memberId] = ['total' => 0, 'parts' => []];
            }
            $grouped[$memberId]['total'] += $value;
            $grouped[$memberId]['parts'][$transaction->type] = $value;
        }

        $lines = [];
        foreach ($grouped as $memberId => $row) {
            $member = $members->get($memberId);
            if (! $member instanceof FamilyMember || $row['total'] <= self::THRESHOLD) {
                continue;
            }
            $lines[] = [
                'member' => $member,
                'total' => $row['total'],
                'parts' => $row['parts'],
            ];
        }

        $lines = collect($lines)->sortByDesc('total')->values()->all();

        return ['lines' => array_values($lines), 'total' => (int) array_sum(array_column($lines, 'total')), 'start' => $start, 'end' => $end];
    }

    /**
     * @return array<int, array{total: int, parts: array<string, int>}>
     */
    private function emptyDigestGroups(): array
    {
        return [];
    }

    /**
     * @param  array{lines: list<array{member: FamilyMember, total: int, parts: array<string, int>}>, total: int, start: CarbonImmutable, end: CarbonImmutable}  $digest
     */
    public function format(Family $family, array $digest): string
    {
        if ($digest['lines'] === []) {
            return 'Цього тижня нарахувань понад 1 ₴ не було.';
        }

        $lines = [];
        foreach ($digest['lines'] as $i => $line) {
            $parts = collect($line['parts'])
                ->map(fn (int $sum, string $type) => (self::GROUPS[$type] ?? $type).': '.Money::format($sum))
                ->implode(', ');
            $lines[] = ($i + 1).'. '.$line['member']->displayName().' — '.Money::format($line['total']).($parts ? " ({$parts})" : '');
        }

        return implode("\n", $lines)."\n\nРазом: ".Money::format($digest['total']).' · учасників: '.count($digest['lines']);
    }

    /**
     * @return array<string, bool>|null null — якщо звіт за цей тиждень уже надіслано
     */
    public function send(Family $family, bool $force = false, ?CarbonImmutable $at = null): ?array
    {
        $digest = $this->build($family, $at);
        $key = $digest['start']->format('o-\WW');
        $settings = $family->settings ?? [];

        if (! $force && (($settings['digest_last'] ?? null) === $key || ! $family->setting('digest.enabled', true))) {
            return null;
        }

        $title = "💰 Тижневі виплати [{$family->tag}] {$family->name} · {$digest['start']->format('d.m')}–{$digest['end']->format('d.m')}";
        $text = $this->format($family, $digest);

        $result = [];
        if ($family->setting('digest.chat', true) && $family->conversation_id) {
            $this->chat->announce($family, $title."\n\n".$text);
            $result['chat'] = true;
        }
        $result += $this->bot->send($family, $text, $title);

        $settings['digest_last'] = $key;
        $family->forceFill(['settings' => $settings])->saveQuietly();
        $this->audit->log($family, 'DIGEST_SENT', null, null, [
            'week' => $key,
            'members' => count($digest['lines']),
            'total' => $digest['total'],
            'channels' => $result,
        ]);

        return $result;
    }
}
