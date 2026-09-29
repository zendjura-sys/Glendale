<?php

namespace App\Cinema;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/**
 * Масова проставка плеєра (кнопка в адмінці «Проставити Kodik/FlixCDN на
 * всі») — у черзі, по тайтлу на задачу, як і ImportTitleJob: сотні
 * синхронних HTTP-викликів під час одного веб-запиту вклались би в таймаут.
 */
class AttachPlayerJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(public string $source, public int $titleId) {}

    public function handle(): void
    {
        $title = Title::query()->find($this->titleId);
        if (! $title) {
            return;
        }

        $result = match ($this->source) {
            'kodik' => Kodik::attachResult($title),
            'flixcdn' => FlixCdn::attach($title),
            'shikimori' => Shikimori::attach($title),
            default => null,
        };

        if ($this->source === 'kodik' && $result?->retryable() && $result->exception !== null) {
            throw $result->exception;
        }
    }
}
