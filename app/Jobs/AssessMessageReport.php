<?php

namespace App\Jobs;

use App\Models\MessageReport;
use App\Services\Ai\AiAssistant;
use App\Support\Plugins\Plugins;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/** ШІ оцінює скаргу на повідомлення (через чергу — скарга не чекає відповіді ШІ). */
class AssessMessageReport implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;

    public function __construct(public readonly int $reportId) {}

    public function handle(AiAssistant $assistant): void
    {
        $report = MessageReport::query()->find($this->reportId);
        if ($report === null || ! app(Plugins::class)->on('ai_moderation')) {
            return;
        }
        $verdict = $assistant->assessReport($report);
        if ($verdict !== null) {
            $report->forceFill(['ai_verdict' => $verdict])->save();
        }
    }
}
