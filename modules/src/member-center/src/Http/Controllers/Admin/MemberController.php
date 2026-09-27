<?php

namespace Addons\MemberCenter\Http\Controllers\Admin;

use Addons\MemberCenter\Events\LeaveRequestReviewed;
use Addons\MemberCenter\Models\LeaveRequest;
use Addons\MemberCenter\Models\MemberNote;
use Addons\MemberCenter\Models\MemberProfile;
use Addons\MemberCenter\Models\MemberWarning;
use Addons\MemberCenter\Services\DisciplineService;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class MemberController
{
    public function index(Request $request): Response
    {
        // Свідомо не додаємо hasMany/belongsTo для member_profiles/member_notes
        // до базової моделі App\Models\User — модуль лишається повністю
        // самодостатнім (не вимагає commit'у в базовий застосунок для звʼязків),
        // тому тут підзапити замість $user->memberProfile.
        $search = $request->string('q')->toString();

        $members = User::query()->inActiveFamily()
            ->select('users.id', 'users.name', 'users.email')
            ->selectSub(
                MemberProfile::query()->select('hr_status')->whereColumn('user_id', 'users.id'),
                'hr_status',
            )
            ->selectSub(
                MemberNote::query()->selectRaw('count(*)')->whereColumn('user_id', 'users.id'),
                'notes_count',
            )
            ->selectSub(
                MemberWarning::query()->selectRaw('count(*)')->whereColumn('user_id', 'users.id')->whereIn('status', ['active', 'overdue']),
                'warnings_count',
            )
            ->when($search, fn ($q) => $q->where(fn ($q2) => $q2
                ->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")))
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString()
            ->through(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'hr_status' => $user->hr_status ?? 'active',
                'notes_count' => (int) $user->notes_count,
                'warnings_count' => (int) $user->warnings_count,
            ]);

        $pendingLeaveRequests = LeaveRequest::query()
            ->with('user:id,name')
            ->where('status', 'pending')
            ->orderBy('starts_on')
            ->get();

        return Inertia::render('Admin/Members/Index', [
            'members' => $members,
            'search' => $search,
            'pendingLeaveRequests' => $pendingLeaveRequests,
            'statuses' => MemberProfile::STATUSES,
            'warningSeverities' => MemberWarning::SEVERITIES,
            'warningSeverityLabels' => MemberWarning::SEVERITY_LABELS,
        ]);
    }

    public function updateStatus(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'hr_status' => ['required', Rule::in(MemberProfile::STATUSES)],
        ]);

        MemberProfile::updateOrCreate(['user_id' => $user->id], $data);

        return response()->json([
            'ok' => true,
            'message' => 'Статус оновлено.',
            'data' => null,
            'errors' => null,
            'redirect' => null,
        ]);
    }

    public function notes(User $user): JsonResponse
    {
        $notes = MemberNote::query()
            ->with('author:id,name')
            ->where('user_id', $user->id)
            ->latest()
            ->get();

        return response()->json([
            'ok' => true,
            'message' => null,
            'data' => ['notes' => $notes],
            'errors' => null,
            'redirect' => null,
        ]);
    }

    public function storeNote(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $note = MemberNote::create([
            ...$data,
            'user_id' => $user->id,
            'author_id' => $request->user()->id,
        ]);

        return response()->json([
            'ok' => true,
            'message' => 'Нотатку додано.',
            'data' => ['note' => $note->load('author:id,name')],
            'errors' => null,
            'redirect' => null,
        ]);
    }

    public function warnings(User $user): JsonResponse
    {
        $warnings = MemberWarning::query()
            ->with('author:id,name', 'resolver:id,name')
            ->where('user_id', $user->id)
            ->latest('id')
            ->get()
            ->map(fn (MemberWarning $w) => $w->toPayload());

        return response()->json([
            'ok' => true,
            'message' => null,
            'data' => ['warnings' => $warnings],
            'errors' => null,
            'redirect' => null,
        ]);
    }

    /**
     * Видача з панелі кадрового обліку — той самий DisciplineService, що й
     * у розділі «Покарання» (строки, ескалація, сповіщення). Легасі-поле
     * severity (старий UI) мапиться на новий тип.
     */
    public function storeWarning(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required_without:severity', 'nullable', Rule::in(MemberWarning::TYPES)],
            'severity' => ['nullable', Rule::in(MemberWarning::SEVERITIES)],
            'rule_code' => ['nullable', 'string', 'max:20'],
            'reason' => ['required', 'string', 'max:2000'],
            'amount' => ['required_if:type,fine', 'nullable', 'integer', 'min:1'],
        ]);

        $type = $data['type'] ?? ($data['severity'] === 'severe' ? 'reprimand' : 'remark');
        $warning = app(DisciplineService::class)->issue(
            $user,
            $request->user(),
            $type,
            $data['reason'],
            $data['rule_code'] ?? null,
            isset($data['amount']) ? (int) $data['amount'] : null,
        );

        return response()->json([
            'ok' => true,
            'message' => MemberWarning::TYPE_LABELS[$type].' видано.',
            'data' => ['warning' => $warning->load('author:id,name')->toPayload()],
            'errors' => null,
            'redirect' => null,
        ]);
    }

    public function approveLeave(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        return $this->reviewLeave($request, $leaveRequest, 'approved');
    }

    public function rejectLeave(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        return $this->reviewLeave($request, $leaveRequest, 'rejected');
    }

    private function reviewLeave(Request $request, LeaveRequest $leaveRequest, string $status): JsonResponse
    {
        if (! $leaveRequest->isPending()) {
            return response()->json([
                'ok' => false,
                'message' => 'Заявку вже розглянуто раніше.',
                'data' => null,
                'errors' => null,
                'redirect' => null,
            ], 422);
        }

        $leaveRequest->update([
            'status' => $status,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        Event::dispatch(new LeaveRequestReviewed($leaveRequest));

        return response()->json([
            'ok' => true,
            'message' => $status === 'approved' ? 'Заявку затверджено.' : 'Заявку відхилено.',
            'data' => null,
            'errors' => null,
            'redirect' => null,
        ]);
    }
}
