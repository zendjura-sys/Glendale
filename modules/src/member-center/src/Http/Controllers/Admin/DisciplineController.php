<?php

namespace Addons\MemberCenter\Http\Controllers\Admin;

use Addons\MemberCenter\Models\MemberWarning;
use Addons\MemberCenter\Services\DisciplineService;
use App\Models\User;
use App\Support\FamilyRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Керування покараннями (members.manage). Дії повертають JSON — ті самі
 * методи обслуговують і сайт (axios), і мобільну адмінку (/api/admin/...).
 */
class DisciplineController
{
    public function __construct(private readonly DisciplineService $discipline)
    {
    }

    public function index(Request $request): Response
    {
        return Inertia::render('Admin/Discipline/Index', [
            ...$this->listPayload($request),
            'types' => collect(MemberWarning::TYPES)->map(fn ($t) => [
                'key' => $t, 'label' => MemberWarning::TYPE_LABELS[$t], 'emoji' => MemberWarning::TYPE_EMOJI[$t],
            ])->values(),
            'rules' => $this->ruleOptions(),
            'filters' => ['status' => $request->query('status', 'open'), 'user' => $request->query('user')],
        ]);
    }

    public function indexJson(Request $request): JsonResponse
    {
        return $this->ok(null, [
            ...$this->listPayload($request),
            'types' => collect(MemberWarning::TYPES)->map(fn ($t) => [
                'key' => $t, 'label' => MemberWarning::TYPE_LABELS[$t], 'emoji' => MemberWarning::TYPE_EMOJI[$t],
            ])->values(),
            'rules' => $this->ruleOptions(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'type' => ['required', Rule::in(MemberWarning::TYPES)],
            'rule_code' => ['nullable', 'string', 'max:20'],
            'reason' => ['required', 'string', 'max:2000'],
            'amount' => ['required_if:type,fine', 'nullable', 'integer', 'min:1', 'max:100000000'],
        ]);

        $user = User::findOrFail($data['user_id']);
        $warning = $this->discipline->issue(
            $user,
            $request->user(),
            $data['type'],
            $data['reason'],
            $data['rule_code'] ?? null,
            isset($data['amount']) ? (int) $data['amount'] : null,
        );

        return $this->ok(MemberWarning::TYPE_LABELS[$warning->type].' видано: '.$user->name.'.', [
            'penalty' => $warning->load('user:id,name', 'author:id,name')->toPayload(),
        ]);
    }

    public function revoke(Request $request, MemberWarning $warning): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'max:500']]);
        $this->discipline->revoke($warning, $request->user(), $data['note']);

        return $this->ok('Покарання скасовано.', ['penalty' => $warning->fresh(['user:id,name', 'author:id,name', 'resolver:id,name'])->toPayload()]);
    }

    public function markPaid(Request $request, MemberWarning $warning): JsonResponse
    {
        $this->discipline->markPaid($warning, $request->user());

        return $this->ok('Штраф позначено сплаченим.', ['penalty' => $warning->fresh(['user:id,name', 'author:id,name', 'resolver:id,name'])->toPayload()]);
    }

    public function searchMembers(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));
        $members = mb_strlen($query) < 2 ? collect() : User::query()->inActiveFamily()
            ->where('is_shadow', false)
            ->where('name', 'like', '%'.$query.'%')
            ->orderBy('name')
            ->limit(10)
            ->get(['id', 'name'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'summary' => $this->discipline->summary($u)]);

        return $this->ok(null, ['members' => $members]);
    }

    private function listPayload(Request $request): array
    {
        $status = $request->query('status', 'open');
        $userId = $request->integer('user') ?: null;

        $penalties = MemberWarning::query()
            ->with('user:id,name', 'author:id,name', 'resolver:id,name')
            ->when($userId, fn ($q) => $q->where('user_id', $userId))
            ->when($status === 'open', fn ($q) => $q->whereIn('status', ['active', 'overdue']))
            ->when($status === 'fines', fn ($q) => $q->where('type', 'fine')->whereIn('status', ['active', 'overdue']))
            ->when($status === 'closed', fn ($q) => $q->whereNotIn('status', ['active', 'overdue']))
            ->latest('id')
            ->limit(200)
            ->get();

        return [
            'penalties' => $penalties->map(fn (MemberWarning $w) => $w->toPayload())->values(),
            'stats' => [
                'openRemarks' => MemberWarning::query()->where('type', 'remark')->where('status', 'active')->count(),
                'openReprimands' => MemberWarning::query()->where('type', 'reprimand')->where('status', 'active')->count(),
                'unpaidFines' => MemberWarning::query()->where('type', 'fine')->whereIn('status', ['active', 'overdue'])->count(),
                'unpaidFinesAmount' => (int) MemberWarning::query()->where('type', 'fine')->whereIn('status', ['active', 'overdue'])->sum('amount'),
            ],
        ];
    }

    /**
     * Пункти правил родини для вибору в формі — лише порушення з короткою
     * назвою ("2.1 — НРП нік"), без повного тексту правила; penalty —
     * підказка, що передбачено правилами за цей пункт.
     */
    private function ruleOptions(): array
    {
        $book = collect(FamilyRules::payload()['books'])->firstWhere('slug', 'monsory');
        $penalties = collect($book['sections'] ?? [])
            ->flatMap(fn ($s) => $s['rules'])
            ->mapWithKeys(fn ($r) => [$r['code'] => $r['penalties'][0]['text'] ?? null]);

        return collect(FamilyRules::SHORT_LABELS)
            ->map(fn (string $label, string $code) => [
                'code' => (string) $code,
                'text' => $label,
                'penalty' => $penalties[$code] ?? null,
            ])
            ->values()
            ->all();
    }

    private function ok(?string $message, array $data): JsonResponse
    {
        return response()->json(['ok' => true, 'message' => $message, 'data' => $data, 'errors' => null, 'redirect' => null]);
    }
}
