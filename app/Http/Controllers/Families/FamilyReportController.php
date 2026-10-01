<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Models\FamilyCashout;
use App\Models\FamilyReport;
use App\Models\FamilyReportProof;
use App\Services\Families\ReportService;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FamilyReportController extends FamilyBaseController
{
    public function index(Request $request, Family $family, ReportService $reports): Response
    {
        $member = $this->member($request, $family);
        $status = $request->validate(['status' => ['nullable', Rule::in(['pending', 'approved', 'rejected'])]])['status'] ?? null;
        $today = ReportService::today();
        $settings = $family->resolvedSettings();

        $list = FamilyReport::query()
            ->with(['submitter', 'beneficiary', 'reviewer', 'proofs'])
            ->where('family_id', $family->id)
            ->where(fn ($q) => $q->where('beneficiary_id', $member->id)->orWhere('submitter_id', $member->id))
            ->when($status, fn ($q, string $s) => $q->where('status', $s))
            ->latest('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (FamilyReport $r) => $this->card($family, $r));

        $usage = [];
        foreach ([$today, $today->subDay(), $today->subDays(2)] as $day) {
            foreach (array_keys(FamilyReport::TIERS) as $tier) {
                $usage[$day->toDateString()][$tier] = $reports->contractsUsed($member, $tier, $day);
            }
        }

        return $this->page($family, $member, 'families/reports', 'reports', [
            'reports' => Inertia::scroll(fn () => $list),
            'status' => $status,
            'config' => [
                'types' => FamilyReport::TYPES,
                'tiers' => FamilyReport::TIERS,
                'hours' => FamilyReport::HOURS,
                'rates' => $settings['rates'],
                'deadline_hours' => (int) $settings['reports']['deadline_hours'],
                'contract_limit' => (int) $settings['reports']['contract_daily_limit'],
                'require_proof' => (bool) $settings['reports']['require_proof'],
                'max_proofs' => (int) $settings['reports']['max_proofs'],
                'today' => $today->toDateString(),
                'min_date' => $this->minDate($family, $today),
            ],
            'usage' => $usage,
            'roster' => $this->roster($family),
        ]);
    }

    public function store(Request $request, Family $family, ReportService $reports): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(FamilyReport::TYPES))],
            'for' => ['required', Rule::in(['self', 'friend'])],
            'beneficiary_id' => ['nullable', 'required_if:for,friend', 'integer'],
            'event_date' => ['required', 'date_format:Y-m-d'],
            'wins' => ['nullable', 'integer', 'min:0', 'max:40'],
            'losses' => ['nullable', 'integer', 'min:0', 'max:40'],
            'hours' => ['nullable', 'array', 'max:13'],
            'hours.*' => ['integer', Rule::in(FamilyReport::HOURS)],
            'tier' => ['nullable', 'required_if:type,contract', Rule::in(array_keys(FamilyReport::TIERS))],
            'count' => ['nullable', 'integer', 'min:1', 'max:10'],
            'amount' => ['nullable', 'required_if:type,investment', 'numeric', 'min:0', 'max:100000000'],
            'description' => ['nullable', 'string', 'max:2000'],
            'proofs' => ['nullable', 'array', 'max:10'],
            'proofs.*' => ['file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ], [
            'beneficiary_id.required_if' => 'Оберіть друга, за якого подаєте звіт.',
            'tier.required_if' => 'Оберіть рівень контракту.',
            'amount.required_if' => 'Вкажіть суму інвестиції.',
            'proofs.*.image' => 'Доказом має бути зображення (скріншот).',
            'proofs.*.max' => 'Скріншот завеликий — до 10 МБ.',
        ]);

        $report = $reports->submit($family, $member, $data, array_values($request->file('proofs', [])));
        $flag = $report->flags['similar_reports'] ?? [];

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Звіт #'.$report->id.' надіслано на перевірку'.($report->reward > 0 ? ' · очікувана винагорода '.Money::format($report->reward) : '').($flag ? '. Скріншот схожий на попередні — офіцер перевірить уважніше.' : '.'),
        ]);

        return back();
    }

    public function queue(Request $request, Family $family, ReportService $reports): Response
    {
        $member = $this->member($request, $family);
        $can = $this->gate->abilities($member, $family);
        abort_unless($can['reports.review'] || $can['treasury.manage'], 403, 'Черга доступна офіцерам.');

        $types = collect(array_keys(FamilyReport::TYPES))->filter(fn ($t) => $can['reports.'.$t])->values()->all();

        $pending = FamilyReport::query()
            ->with(['submitter.user', 'beneficiary.user', 'proofs'])
            ->where('family_id', $family->id)
            ->where('status', FamilyReport::STATUS_PENDING)
            ->whereIn('type', $types ?: ['-'])
            ->orderBy('id')
            ->limit(100)
            ->get();

        $history = FamilyReport::query()
            ->selectRaw('beneficiary_id, status, count(*) as total')
            ->where('family_id', $family->id)
            ->whereIn('beneficiary_id', $pending->pluck('beneficiary_id')->unique()->all() ?: [0])
            ->where('status', '!=', FamilyReport::STATUS_PENDING)
            ->where('created_at', '>=', now()->subDays(30))
            ->groupBy('beneficiary_id', 'status')
            ->get()
            ->groupBy('beneficiary_id');

        return $this->page($family, $member, 'families/queue', 'queue', [
            'reports' => $pending->map(fn (FamilyReport $r) => [
                ...$this->card($family, $r),
                'self_review' => $member->user_id !== $family->owner_id && in_array($member->id, [$r->submitter_id, $r->beneficiary_id], true),
                'history' => [
                    'approved' => (int) ($history[$r->beneficiary_id] ?? collect())->firstWhere('status', FamilyReport::STATUS_APPROVED)?->total,
                    'rejected' => (int) ($history[$r->beneficiary_id] ?? collect())->firstWhere('status', FamilyReport::STATUS_REJECTED)?->total,
                ],
                'contracts_used' => $r->type === FamilyReport::TYPE_CONTRACT
                    ? $reports->contractsUsed($r->beneficiary, (string) ($r->data['tier'] ?? 'light'), $r->event_date->toImmutable())
                    : null,
            ])->values(),
            'cashouts' => $can['treasury.manage']
                ? FamilyCashout::query()->with('member')->where('family_id', $family->id)->where('status', FamilyCashout::STATUS_PENDING)->orderBy('id')->get()
                    ->map(fn (FamilyCashout $c) => FamilyBankController::cashout($c))
                : [],
            'contract_limit' => (int) $family->setting('reports.contract_daily_limit', 10),
            'tab' => $request->string('tab')->toString() === 'cashouts' ? 'cashouts' : 'reports',
        ]);
    }

    public function review(Request $request, Family $family, FamilyReport $report, ReportService $reports): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'comment' => ['nullable', 'string', 'max:500'],
            'reward' => ['nullable', 'numeric', 'min:0', 'max:10000000'],
        ]);

        $custom = isset($data['reward']) && $report->type === FamilyReport::TYPE_OTHER ? $this->money($data['reward']) : null;
        $reports->review($family, $report, $member, $data['decision'] === 'approve', $data['comment'] ?? null, $custom);

        Inertia::flash('toast', ['type' => 'success', 'message' => $data['decision'] === 'approve' ? "Звіт #{$report->id} схвалено ✅" : "Звіт #{$report->id} відхилено."]);

        return back();
    }

    public function bulk(Request $request, Family $family, ReportService $reports): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:50'],
            'ids.*' => ['integer'],
        ]);

        $done = 0;
        $skipped = 0;
        foreach (FamilyReport::query()->where('family_id', $family->id)->whereKey($data['ids'])->where('status', FamilyReport::STATUS_PENDING)->get() as $report) {
            if (! $this->gate->can($member, $family, $report->permission()) || (! empty($report->flags['similar_reports']))) {
                $skipped++;

                continue;
            }
            try {
                $reports->review($family, $report, $member, true, null);
                $done++;
            } catch (ValidationException) {
                $skipped++;
            }
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => "Схвалено: {$done}".($skipped ? " · пропущено: {$skipped} (свої, з позначкою антифроду або без прав)" : '')]);

        return back();
    }

    public function proof(Request $request, Family $family, FamilyReportProof $proof): StreamedResponse
    {
        $member = $this->member($request, $family);
        $report = $proof->loadMissing('report')->report;
        abort_unless(
            in_array($member->id, [$report->submitter_id, $report->beneficiary_id], true) || $this->gate->can($member, $family, $report->permission()),
            403,
        );

        return Storage::disk(FamilyReportProof::DISK)->response($proof->path, null, [
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function card(Family $family, FamilyReport $r): array
    {
        $deadline = ReportService::deadline($family, $r->event_date->toImmutable());

        return [
            'id' => $r->id,
            'type' => $r->type,
            'type_label' => FamilyReport::TYPES[$r->type],
            'status' => $r->status,
            'event_date' => $r->event_date->toDateString(),
            'data' => $r->data,
            'description' => $r->description,
            'reward' => $r->reward,
            'points' => $r->points,
            'flags' => $r->flags,
            'for_friend' => $r->submitter_id !== $r->beneficiary_id,
            'submitter' => $r->submitter->toCard($family),
            'beneficiary' => $r->beneficiary->toCard($family),
            'reviewer' => $r->reviewer?->toCard($family),
            'review_comment' => $r->review_comment,
            'reviewed_at' => $r->reviewed_at?->toIso8601String(),
            'created_at' => $r->created_at->toIso8601String(),
            'deadline' => $deadline->toIso8601String(),
            'proofs' => $r->proofs->map(fn (FamilyReportProof $p) => [
                'id' => $p->id,
                'url' => route('families.proofs.show', [$family, $p], absolute: false),
                'width' => $p->width,
                'height' => $p->height,
            ])->values(),
        ];
    }

    private function minDate(Family $family, CarbonImmutable $today): string
    {
        $date = $today;
        while (ReportService::deadline($family, $date->subDay())->gte(now()) && $date->gt($today->subDays(30))) {
            $date = $date->subDay();
        }

        return $date->toDateString();
    }
}
