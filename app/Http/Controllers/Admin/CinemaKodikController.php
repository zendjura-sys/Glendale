<?php

namespace App\Http\Controllers\Admin;

use App\Cinema\CinemaSettings;
use App\Cinema\CinemaSyncEvent;
use App\Cinema\CinemaSyncRun;
use App\Cinema\Kodik;
use App\Cinema\Kodik\KodikImportPolicy;
use App\Cinema\Kodik\KodikRebindDispatcher;
use App\Cinema\Kodik\SyncLogRedactor;
use App\Cinema\RunKodikSyncJob;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateCinemaKodikSettingsRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CinemaKodikController extends Controller
{
    public function runs(Request $request): JsonResponse
    {
        $data = $request->validate([
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'status' => ['sometimes', 'string', 'max:32'],
            'mode' => ['sometimes', 'string', 'max:32'],
        ]);
        CinemaSyncEvent::where('created_at', '<', now()->subDays(30))
            ->whereHas('run', fn ($q) => $q->where('source', 'kodik')->whereNotIn('status', ['queued', 'running']))->delete();
        CinemaSyncRun::where('source', 'kodik')->where('created_at', '<', now()->subDays(90))
            ->whereNotIn('status', ['queued', 'running'])->delete();

        $runs = CinemaSyncRun::where('source', 'kodik')->withCount('events')
            ->when(isset($data['status']), fn ($q) => $q->where('status', $data['status']))
            ->when(isset($data['mode']), fn ($q) => $q->where('mode', $data['mode']))
            ->latest('id')->paginate($data['per_page'] ?? 25);
        $runs->through(fn ($run) => SyncLogRedactor::clean($run->toArray()));

        return response()->json($runs);
    }

    public function events(Request $request, int $run): JsonResponse
    {
        $record = CinemaSyncRun::where('source', 'kodik')->findOrFail($run);
        $data = $request->validate([
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'status' => ['sometimes', 'string', 'max:32'],
            'action' => ['sometimes', 'string', 'max:48'],
        ]);
        $events = $record->events()
            ->when(isset($data['status']), fn ($q) => $q->where('status', $data['status']))
            ->when(isset($data['action']), fn ($q) => $q->where('action', $data['action']))
            ->paginate($data['per_page'] ?? 25);
        $events->through(fn ($event) => SyncLogRedactor::clean($event->toArray()));

        return response()->json($events);
    }

    public function settings(KodikImportPolicy $policy): JsonResponse
    {
        return response()->json([
            'configured' => Kodik::configured(),
            'policy' => $policy->normalize(CinemaSettings::kodikImportPolicy()),
        ]);
    }

    public function updateSettings(UpdateCinemaKodikSettingsRequest $request, KodikImportPolicy $policy): JsonResponse
    {
        $settings = $policy->normalize(array_replace(CinemaSettings::kodikImportPolicy(), $request->validated()));
        CinemaSettings::setKodikImportPolicy($settings);

        return $this->settings($policy);
    }

    public function sync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mode' => ['required', 'in:incremental,reconcile,missing,full'],
            'batch' => ['sometimes', 'integer', 'between:1,100'],
            'dry_run' => ['sometimes', 'boolean'],
            'confirm_full' => ['exclude_unless:mode,full', 'required', 'accepted'],
        ]);
        if (CinemaSyncRun::where('source', 'kodik')->where('mode', $data['mode'])
            ->whereIn('status', ['queued', 'running'])->exists()) {
            return response()->json(['message' => 'Цей режим синхронізації вже запущено.'], 409);
        }
        RunKodikSyncJob::dispatch($data['mode'], $data['batch'] ?? 100, $data['dry_run'] ?? false, $request->user()->id);

        return response()->json(['status' => 'queued'], 202);
    }

    public function rebind(Request $request, KodikRebindDispatcher $dispatcher): JsonResponse
    {
        $data = $request->validate([
            'scope' => ['required', 'in:all,missing'],
            'confirm' => ['exclude_unless:scope,all', 'required', 'accepted'],
        ]);
        $run = $dispatcher->dispatch($data['scope'] === 'missing', $request->user()->id);

        return response()->json(['run_id' => $run->id, 'queued' => $run->counters['queued']], 202);
    }
}
