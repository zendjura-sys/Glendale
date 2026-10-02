<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\FamilyReport;
use App\Models\FamilyReportProof;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ReportService
{
    public const TIMEZONE = 'Europe/Kyiv';

    public function __construct(
        private readonly ProofHasher $hasher,
        private readonly FamilyBank $bank,
        private readonly FamilyAudit $audit,
        private readonly FamilyNotifier $notifier,
        private readonly FamilyGate $gate,
    ) {}

    public static function today(): CarbonImmutable
    {
        return CarbonImmutable::now(self::TIMEZONE)->startOfDay();
    }

    /**
     * Кінцевий момент, до якого можна подати звіт за дату події.
     */
    public static function deadline(Family $family, CarbonImmutable $eventDate): CarbonImmutable
    {
        return $eventDate->setTimezone(self::TIMEZONE)->startOfDay()->addHours((int) $family->setting('reports.deadline_hours', 48));
    }

    /**
     * @param  array<string, mixed>  $input  провалідовані поля форми
     * @param  list<UploadedFile>  $proofs
     */
    public function submit(Family $family, FamilyMember $submitter, array $input, array $proofs): FamilyReport
    {
        $type = (string) $input['type'];
        $beneficiary = $this->beneficiary($family, $submitter, $input);
        $eventDate = CarbonImmutable::parse((string) $input['event_date'], self::TIMEZONE)->startOfDay();

        if ($eventDate->gt(self::today())) {
            throw ValidationException::withMessages(['event_date' => 'Дата події не може бути в майбутньому.']);
        }
        if (now()->gt(self::deadline($family, $eventDate))) {
            throw ValidationException::withMessages(['event_date' => 'Звіт закрито: минуло понад '.$family->setting('reports.deadline_hours', 48).' год від дати події.']);
        }

        $data = $this->data($family, $type, $input, $beneficiary, $eventDate);
        $description = isset($input['description']) ? trim((string) $input['description']) : null;
        if ($type === FamilyReport::TYPE_OTHER && mb_strlen((string) $description) < 5) {
            throw ValidationException::withMessages(['description' => 'Опишіть, що саме було зроблено.']);
        }

        $maxProofs = (int) $family->setting('reports.max_proofs', 6);
        if ((bool) $family->setting('reports.require_proof', true) && $proofs === []) {
            throw ValidationException::withMessages(['proofs' => 'Додайте хоча б один скріншот-доказ.']);
        }
        if (count($proofs) > $maxProofs) {
            throw ValidationException::withMessages(['proofs' => "Не більше {$maxProofs} скріншотів."]);
        }

        [$hashes, $similar] = $this->checkProofs($family, $proofs);

        $report = DB::transaction(function () use ($family, $submitter, $beneficiary, $type, $eventDate, $data, $description, $proofs, $hashes, $similar) {
            $report = FamilyReport::query()->create([
                'family_id' => $family->id,
                'type' => $type,
                'submitter_id' => $submitter->id,
                'beneficiary_id' => $beneficiary->id,
                'event_date' => $eventDate->toDateString(),
                'data' => $data,
                'description' => $description !== '' ? $description : null,
                'status' => FamilyReport::STATUS_PENDING,
                'flags' => $similar !== [] ? ['similar_reports' => $similar] : null,
            ]);
            $report->forceFill(['reward' => $this->reward($family, $report), 'points' => $this->points($family, $report)])->save();

            foreach ($proofs as $i => $file) {
                $extension = match ($file->getMimeType()) {
                    'image/png' => 'png',
                    'image/webp' => 'webp',
                    'image/gif' => 'gif',
                    default => 'jpg',
                };
                $report->proofs()->create([
                    'family_id' => $family->id,
                    'path' => $file->storeAs("family-proofs/{$family->id}/".now()->format('Y/m'), Str::random(40).'.'.$extension, FamilyReportProof::DISK),
                    'size' => $file->getSize(),
                    ...$hashes[$i],
                ]);
            }

            return $report;
        });

        $who = $beneficiary->id === $submitter->id ? $submitter->displayName() : "{$submitter->displayName()} за {$beneficiary->displayName()}";
        $this->notifier->holders($family, $report->permission(), 'report', 'Новий звіт «'.FamilyReport::TYPES[$type]."» від {$who}", route('families.queue', $family, absolute: false), $submitter);
        $this->notifier->refresh($family, 'reports');

        return $report;
    }

    public function review(Family $family, FamilyReport $report, FamilyMember $reviewer, bool $approve, ?string $comment, ?int $customReward = null): FamilyReport
    {
        $this->gate->authorize($reviewer, $family, $report->permission());
        $isOwner = $reviewer->user_id === $family->owner_id;
        if (! $isOwner && in_array($reviewer->id, [$report->submitter_id, $report->beneficiary_id], true)) {
            throw ValidationException::withMessages(['report' => 'Свій звіт перевіряє інший офіцер.']);
        }
        if (! $approve && blank($comment)) {
            throw ValidationException::withMessages(['comment' => 'Вкажіть причину відхилення.']);
        }

        DB::transaction(function () use ($family, $report, $reviewer, $approve, $comment, $customReward) {
            $locked = FamilyReport::query()->with(['beneficiary.user', 'submitter.user'])->whereKey($report->id)->lockForUpdate()->firstOrFail();
            if (! $locked->isPending()) {
                throw ValidationException::withMessages(['report' => 'Звіт уже перевірено.']);
            }

            $reward = $approve ? ($customReward ?? $this->reward($family, $locked)) : 0;
            $locked->forceFill([
                'status' => $approve ? FamilyReport::STATUS_APPROVED : FamilyReport::STATUS_REJECTED,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'review_comment' => $comment,
                'reward' => $reward,
                'points' => $approve ? $this->points($family, $locked) : 0,
            ])->save();

            $beneficiary = $locked->beneficiary;
            if ($approve) {
                if ($locked->type === FamilyReport::TYPE_INVESTMENT) {
                    $this->bank->post($family, $beneficiary, 'investment', 0, (int) ($locked->data['amount'] ?? 0), $reviewer, 'Інвестиція за звітом #'.$locked->id, $locked);
                }
                if ($reward > 0) {
                    $this->bank->post($family, $beneficiary, 'report_reward', $reward, 0, $reviewer, FamilyReport::TYPES[$locked->type].' · звіт #'.$locked->id, $locked);
                }
            }

            $this->audit->log($family, $approve ? 'REPORT_APPROVE' : 'REPORT_REJECT', $reviewer, $beneficiary, [
                'report_id' => $locked->id,
                'type' => $locked->type,
                'reward' => $reward,
                'comment' => $comment,
            ]);

            $text = $approve
                ? 'Звіт «'.FamilyReport::TYPES[$locked->type].'» схвалено'.($reward > 0 ? ': +'.Money::format($reward) : '')
                : 'Звіт «'.FamilyReport::TYPES[$locked->type]."» відхилено: {$comment}";
            $recipients = collect([$beneficiary, $locked->submitter])->unique('id')->reject(fn ($m) => $m->id === $reviewer->id);
            $this->notifier->members($recipients, $family, 'review', $text, route('families.reports', $family, absolute: false));

            $report->setRawAttributes($locked->getAttributes(), true);
        });

        $this->notifier->refresh($family, 'reports');

        return $report;
    }

    /**
     * Розрахунок винагороди за поточними ставками (копійки).
     */
    public function reward(Family $family, FamilyReport $report): int
    {
        $data = $report->data ?? [];

        return match ($report->type) {
            FamilyReport::TYPE_BIZWAR => (int) ($data['wins'] ?? 0) * $family->rate('bizwar_win') + (int) ($data['losses'] ?? 0) * $family->rate('bizwar_loss'),
            FamilyReport::TYPE_CONTRACT => (int) ($data['count'] ?? 0) * $family->rate('contract_'.($data['tier'] ?? 'light')),
            FamilyReport::TYPE_INVESTMENT => intdiv((int) ($data['amount'] ?? 0) * (int) round((float) $family->setting('rates.investment_cashback', 0) * 100), 10000),
            default => 0,
        };
    }

    public function points(Family $family, FamilyReport $report): int
    {
        $data = $report->data ?? [];
        $rating = $family->resolvedSettings()['rating'];

        return match ($report->type) {
            FamilyReport::TYPE_BIZWAR => (int) ($data['wins'] ?? 0) * (int) $rating['points_bizwar_win'] + (int) ($data['losses'] ?? 0) * (int) $rating['points_bizwar_loss'],
            FamilyReport::TYPE_CONTRACT => (int) ($data['count'] ?? 0) * (int) ($rating['points_contract_'.($data['tier'] ?? 'light')] ?? 0),
            FamilyReport::TYPE_INVESTMENT => intdiv((int) ($data['amount'] ?? 0), 100_000) * (int) $rating['points_per_1000'],
            default => 0,
        };
    }

    /**
     * Скільки контрактів рівня вже подано за день (крім відхилених).
     */
    public function contractsUsed(FamilyMember $beneficiary, string $tier, CarbonImmutable $date): int
    {
        return (int) FamilyReport::query()
            ->where('beneficiary_id', $beneficiary->id)
            ->where('type', FamilyReport::TYPE_CONTRACT)
            ->whereDate('event_date', $date->toDateString())
            ->where('status', '!=', FamilyReport::STATUS_REJECTED)
            ->get(['data'])
            ->filter(fn (FamilyReport $r) => ($r->data['tier'] ?? null) === $tier)
            ->sum(fn (FamilyReport $r) => (int) ($r->data['count'] ?? 0));
    }

    /**
     * @param  array<string, mixed>  $input
     */
    private function beneficiary(Family $family, FamilyMember $submitter, array $input): FamilyMember
    {
        if (($input['for'] ?? 'self') !== 'friend') {
            return $submitter;
        }

        $friend = FamilyMember::query()
            ->where('family_id', $family->id)
            ->where('status', FamilyMember::STATUS_ACTIVE)
            ->whereKey((int) ($input['beneficiary_id'] ?? 0))
            ->first();

        if (! $friend || $friend->id === $submitter->id) {
            throw ValidationException::withMessages(['beneficiary_id' => 'Оберіть іншого учасника сім’ї.']);
        }

        return $friend;
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function data(Family $family, string $type, array $input, FamilyMember $beneficiary, CarbonImmutable $date): array
    {
        switch ($type) {
            case FamilyReport::TYPE_BIZWAR:
                $wins = (int) ($input['wins'] ?? 0);
                $losses = (int) ($input['losses'] ?? 0);
                $hours = collect((array) ($input['hours'] ?? []))->map(fn ($h) => (int) $h)
                    ->filter(fn (int $h) => in_array($h, FamilyReport::HOURS, true))->unique()->sort()->values()->all();
                if ($wins + $losses < 1) {
                    throw ValidationException::withMessages(['wins' => 'Вкажіть кількість перемог або поразок.']);
                }
                if ($hours === []) {
                    throw ValidationException::withMessages(['hours' => 'Позначте години стріл.']);
                }
                if ($wins + $losses > count($hours) * 3) {
                    throw ValidationException::withMessages(['wins' => 'Забагато стріл для вказаних годин.']);
                }

                return ['wins' => $wins, 'losses' => $losses, 'hours' => $hours];

            case FamilyReport::TYPE_CONTRACT:
                $tier = (string) ($input['tier'] ?? '');
                $count = (int) ($input['count'] ?? 1);
                $limit = (int) $family->setting('reports.contract_daily_limit', 10);
                $used = $this->contractsUsed($beneficiary, $tier, $date);
                if ($used + $count > $limit) {
                    throw ValidationException::withMessages(['count' => 'Ліміт '.$limit.' контрактів рівня «'.FamilyReport::TIERS[$tier].'» на день: уже подано '.$used.'.']);
                }

                return ['tier' => $tier, 'count' => $count];

            case FamilyReport::TYPE_INVESTMENT:
                $amount = Money::toMinor($input['amount'] ?? 0);
                if ($amount < 100) {
                    throw ValidationException::withMessages(['amount' => 'Сума інвестиції — від 1 ₴.']);
                }

                return ['amount' => $amount];

            default:
                return [];
        }
    }

    /**
     * @param  list<UploadedFile>  $proofs
     * @return array{0: list<array<string, mixed>>, 1: list<int>}
     */
    private function checkProofs(Family $family, array $proofs): array
    {
        $hashes = [];
        $similar = [];

        foreach ($proofs as $i => $file) {
            $hash = $this->hasher->hash($file);

            foreach ($hashes as $j => $previous) {
                if ($previous['sha256'] === $hash['sha256'] || ($hash['phash'] && $previous['phash'] && $this->hasher->informative($hash['phash']) && $this->hasher->distance($hash['phash'], $previous['phash']) <= ProofHasher::DUPLICATE_DISTANCE)) {
                    throw ValidationException::withMessages(["proofs.{$i}" => 'Скріншоти №'.($j + 1).' і №'.($i + 1).' однакові.']);
                }
            }

            $match = $this->hasher->match($family->id, $hash);
            if ($match['duplicate']) {
                $used = $match['duplicate']->report;
                throw ValidationException::withMessages([
                    "proofs.{$i}" => 'Скріншот №'.($i + 1).' уже використано у звіті #'.$used->id.' від '.$used->created_at->setTimezone(self::TIMEZONE)->format('d.m.Y').'. Повторне використання доказів заборонено.',
                ]);
            }

            $similar = [...$similar, ...$match['similar']];
            $hashes[] = $hash;
        }

        return [$hashes, array_values(array_unique($similar))];
    }

    public function proofUrl(Family $family, FamilyReportProof $proof): string
    {
        return route('families.proofs.show', [$family, $proof], absolute: false);
    }

    public function deleteProofs(FamilyReport $report): void
    {
        foreach ($report->proofs as $proof) {
            Storage::disk(FamilyReportProof::DISK)->delete($proof->path);
        }
    }
}
