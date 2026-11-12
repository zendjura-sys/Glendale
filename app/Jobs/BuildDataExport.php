<?php

namespace App\Jobs;

use App\Models\DataExport;
use App\Notifications\AccountNotice;
use App\Services\Account\DataExporter;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/** Збирає архів «Мої дані» у фоні й повідомляє людину, коли він готовий. */
class BuildDataExport implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;

    public int $timeout = 1800;

    public function __construct(public readonly int $exportId) {}

    public function handle(DataExporter $exporter): void
    {
        $export = DataExport::query()->with('user')->find($this->exportId);
        if ($export === null || $export->status !== 'pending' || $export->user === null) {
            return;
        }
        try {
            $exporter->build($export);
            $export->user->notify(new AccountNotice('data_export', null, 'Архів ваших даних готовий', 'Завантажте його в налаштуваннях акаунта — посилання діє '.DataExport::DAYS.' днів.', '/settings/account'));
        } catch (Throwable $e) {
            $export->update(['status' => 'failed', 'error' => Str::limit($e->getMessage(), 190)]);
            Log::warning('data_export.failed', ['export' => $export->id, 'error' => $e->getMessage()]);
        }
    }
}
