<?php

namespace App\Jobs;

use App\Models\TrackImport;
use App\Services\Music\ImportFailed;
use App\Services\Music\LinkImporter;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * «Завантажити за посиланням»: файл за посиланням користувача → звичайне завантаження треку
 * (LinkImporter). Стан і зрозуміла помилка — у track_imports, їх показує вікно завантаження.
 */
class ImportTrackFromUrl implements ShouldQueue
{
    use Queueable;

    // Менше за retry_after черги (90 с), інакше воркер узяв би задачу вдруге.
    public int $timeout = 85;

    public int $tries = 1;

    public function __construct(public readonly int $importId) {}

    public function handle(LinkImporter $importer): void
    {
        $import = TrackImport::query()->find($this->importId);
        if ($import === null || ! $import->isActive()) {
            return;
        }

        try {
            $importer->import($import);
        } catch (ImportFailed $e) {
            $import->fail($e->getMessage());
        } catch (Throwable $e) {
            Log::warning('Завантаження треку за посиланням не вдалося', ['import' => $import->id, 'error' => $e->getMessage()]);
            $import->fail(ImportFailed::GENERIC);
        }
    }

    /** Задачу зупинено ззовні (таймаут воркера) — завантаження не лишається «активним». */
    public function failed(?Throwable $e): void
    {
        TrackImport::query()->whereKey($this->importId)->whereIn('status', TrackImport::ACTIVE)
            ->update(['status' => TrackImport::FAILED, 'error' => ImportFailed::TOO_LONG, 'progress' => null]);
    }
}
