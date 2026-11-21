<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\System\Backups;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

/** Система: резервні копії бази, журнал помилок і монітор черги задач. */
class SystemController extends Controller
{
    public function index(Request $request, Backups $backups): Response
    {
        $show = $request->query('show') === 'resolved' ? 'resolved' : 'open';
        $errors = DB::table('error_logs')
            ->when($show === 'open', fn ($q) => $q->whereNull('resolved_at'), fn ($q) => $q->whereNotNull('resolved_at'))
            ->orderByDesc('last_seen_at')->limit(100)->get()
            ->map(fn (object $e) => [
                'id' => (int) $e->id,
                'class' => $e->class,
                'message' => $e->message,
                'file' => $e->file,
                'line' => $e->line,
                'url' => $e->url,
                'method' => $e->method,
                'count' => (int) $e->count,
                'first_seen_at' => (string) $e->first_seen_at,
                'last_seen_at' => (string) $e->last_seen_at,
                'resolved' => $e->resolved_at !== null,
            ])->values();
        $list = $backups->list();
        // Монітор черги: скільки задач чекає і останні, що впали (з першим рядком помилки).
        $failed = Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->orderByDesc('id')->limit(50)->get()->map(function (object $j) {
            $payload = json_decode((string) $j->payload, true);

            return [
                'uuid' => (string) $j->uuid,
                'queue' => (string) $j->queue,
                'job' => class_basename((string) (is_array($payload) ? ($payload['displayName'] ?? '') : '')),
                'error' => mb_substr(strtok((string) $j->exception, "\n") ?: '', 0, 300),
                'failed_at' => (string) $j->failed_at,
            ];
        })->values() : collect();
        $queue = [
            'pending' => Schema::hasTable('jobs') ? DB::table('jobs')->count() : 0,
            'oldest' => Schema::hasTable('jobs') ? DB::table('jobs')->min('created_at') : null,
            'failed_total' => Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : 0,
            'failed' => $failed,
        ];

        return Inertia::render('admin/system', [
            'backups' => $list,
            // Остання копія старша за дві доби — щось не так з розкладом.
            'backup_stale' => $list === [] || strtotime($list[0]['created_at']) < now()->subDays(2)->getTimestamp(),
            'errors' => $errors,
            'queue' => $queue,
            'show' => $show,
            'stats' => [
                'open' => DB::table('error_logs')->whereNull('resolved_at')->count(),
                'today' => DB::table('error_logs')->where('last_seen_at', '>=', now()->startOfDay())->sum('count'),
            ],
        ]);
    }

    public function backup(Request $request, Backups $backups): RedirectResponse
    {
        try {
            $name = $backups->create();
        } catch (Throwable $e) {
            Log::warning('system: backup failed', ['error' => $e->getMessage(), 'by' => $request->user()?->id]);
            Inertia::flash('toast', ['type' => 'error', 'message' => $e->getMessage()]);

            return back();
        }
        Log::info('system: backup created', ['file' => $name, 'by' => $request->user()?->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Резервну копію створено.']);

        return back();
    }

    public function download(Request $request, string $name, Backups $backups): BinaryFileResponse
    {
        $path = $backups->path($name);
        abort_if($path === null, 404);
        Log::info('system: backup downloaded', ['file' => $name, 'by' => $request->user()?->id]);

        return response()->download($path, $name);
    }

    public function resolve(Request $request, int $error): RedirectResponse
    {
        DB::table('error_logs')->where('id', $error)->update(['resolved_at' => now()]);
        Log::info('system: error resolved', ['error' => $error, 'by' => $request->user()?->id]);

        return back();
    }

    /** Повторити задачу, що впала (або всі, якщо uuid = all). */
    public function retryJob(Request $request, string $uuid): RedirectResponse
    {
        Artisan::call('queue:retry', ['id' => [$uuid]]);
        Log::info('system: failed job retried', ['job' => $uuid, 'by' => $request->user()?->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => $uuid === 'all' ? 'Усі задачі повернено в чергу.' : 'Задачу повернено в чергу.']);

        return back();
    }

    /** Прибрати задачу, що впала, з журналу (або всі). */
    public function forgetJob(Request $request, string $uuid): RedirectResponse
    {
        $uuid === 'all' ? Artisan::call('queue:flush') : Artisan::call('queue:forget', ['id' => $uuid]);
        Log::info('system: failed job forgotten', ['job' => $uuid, 'by' => $request->user()?->id]);

        return back();
    }

    public function clear(Request $request): RedirectResponse
    {
        $count = DB::table('error_logs')->whereNotNull('resolved_at')->delete();
        Log::info('system: resolved errors cleared', ['count' => $count, 'by' => $request->user()?->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Вирішені помилки прибрано з журналу.']);

        return back();
    }
}
