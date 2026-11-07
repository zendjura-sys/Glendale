<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\VerificationRequest;
use App\Services\Accounts\AccountTypes;
use App\Services\Accounts\Verification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Адмінка → «Верифікація»: черга заявок, рішення з причиною, зняття позначки. */
class VerificationController extends Controller
{
    public function __construct(private readonly Verification $verification) {}

    public function index(Request $request): Response
    {
        $status = in_array($request->query('status'), ['pending', 'needs_info', 'approved', 'rejected'], true) ? (string) $request->query('status') : 'pending';
        $requests = VerificationRequest::query()->with(['user', 'reviewer'])->where('status', $status)
            ->orderBy($status === 'pending' ? 'id' : 'decided_at', $status === 'pending' ? 'asc' : 'desc')
            ->paginate(20)->withQueryString();

        $requests->setCollection($requests->getCollection()->map(fn (VerificationRequest $r) => [
            'id' => $r->id,
            'kind' => $r->kind,
            'kind_label' => Verification::KINDS[$r->kind] ?? $r->kind,
            'status' => $r->status,
            'links' => $r->links ?? [],
            'note' => $r->note,
            'has_document' => $r->document_path !== null,
            'reason' => $r->reason,
            'created_at' => $r->created_at->toIso8601String(),
            'decided_at' => $r->decided_at?->toIso8601String(),
            'reviewer' => $r->reviewer?->name,
            'user' => $r->user ? [
                ...$r->user->toCard(),
                'account_label' => AccountTypes::TYPES[$r->user->account_type]['label'] ?? null,
                'created_at' => $r->user->created_at?->toIso8601String(),
                'requirements' => $this->verification->requirements($r->user),
            ] : null,
        ]));

        return Inertia::render('admin/verification', [
            'requests' => $requests,
            'status' => $status,
            'counts' => VerificationRequest::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status'),
            'verified' => User::query()->where('is_verified', true)->count(),
        ]);
    }

    public function decide(Request $request, VerificationRequest $verificationRequest): RedirectResponse
    {
        $data = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject', 'needs_info'])],
            'reason' => ['nullable', 'required_unless:decision,approve', 'string', 'max:500'],
        ]);
        $this->verification->decide($verificationRequest, $request->user(), $data['decision'], $data['reason'] ?? null);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Рішення збережено.']);

        return back();
    }

    /** Документ до заявки — лише команді й лише поки заявка відкрита. */
    public function document(Request $request, VerificationRequest $verificationRequest): StreamedResponse
    {
        abort_if($verificationRequest->document_path === null, 404);
        Log::info('admin: verification document viewed', ['request' => $verificationRequest->id, 'by' => $request->user()->id]);

        return Storage::disk('local')->response($verificationRequest->document_path);
    }

    public function revoke(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);
        $this->verification->revoke($user, $request->user(), $data['reason']);

        return back();
    }
}
