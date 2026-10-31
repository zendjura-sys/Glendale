<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\StatusIncident;
use App\Services\Status\HealthChecks;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Інциденти сторінки статусу: оголосити збій, повідомити про хід робіт, закрити. */
class StatusController extends Controller
{
    public function index(HealthChecks $health): Response
    {
        return Inertia::render('admin/status', [
            'overall' => $health->overall(),
            'components' => $health->components(),
            'incidents' => StatusIncident::query()->latest('started_at')->limit(50)->get()->map->toCard(),
            'statuses' => StatusIncident::STATUSES,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:120'],
            'severity' => ['required', Rule::in(StatusIncident::SEVERITIES)],
            'message' => ['required', 'string', 'min:3', 'max:1000'],
        ]);
        $incident = StatusIncident::query()->create([
            'user_id' => $request->user()?->id,
            'title' => $data['title'],
            'severity' => $data['severity'],
            'status' => 'investigating',
            'updates' => [['status' => 'investigating', 'message' => $data['message'], 'at' => now()->toIso8601String()]],
            'started_at' => now(),
        ]);
        $this->forget();
        Log::info('status: incident opened', ['incident' => $incident->id, 'severity' => $incident->severity, 'by' => $request->user()?->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Інцидент оголошено — його видно на сторінці статусу.']);

        return back();
    }

    public function update(Request $request, StatusIncident $incident): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(StatusIncident::STATUSES)],
            'message' => ['required', 'string', 'min:3', 'max:1000'],
        ]);
        $updates = $incident->updates ?? [];
        $updates[] = ['status' => $data['status'], 'message' => $data['message'], 'at' => now()->toIso8601String()];
        $incident->update([
            'status' => $data['status'],
            'updates' => $updates,
            'resolved_at' => $data['status'] === 'resolved' ? now() : null,
        ]);
        $this->forget();
        Log::info('status: incident updated', ['incident' => $incident->id, 'status' => $data['status'], 'by' => $request->user()?->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => $data['status'] === 'resolved' ? 'Інцидент закрито.' : 'Оновлення опубліковано.']);

        return back();
    }

    public function destroy(Request $request, StatusIncident $incident): RedirectResponse
    {
        $id = $incident->id;
        $incident->delete();
        $this->forget();
        Log::info('status: incident deleted', ['incident' => $id, 'by' => $request->user()?->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Інцидент видалено.']);

        return back();
    }

    private function forget(): void
    {
        Cache::forget('status:banner');
        Cache::forget('status:components');
    }
}
