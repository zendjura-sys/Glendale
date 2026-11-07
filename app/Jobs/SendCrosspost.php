<?php

namespace App\Jobs;

use App\Models\CrosspostTarget;
use App\Services\Crosspost\Crossposting;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/** Одне повідомлення автопостингу в Discord чи Telegram. */
class SendCrosspost implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 2;

    /**
     * @param  array{title: string, text: string, url: string, image?: string|null}  $payload
     */
    public function __construct(public readonly int $targetId, public readonly array $payload) {}

    public function handle(Crossposting $crossposting): void
    {
        $target = CrosspostTarget::query()->find($this->targetId);
        if ($target !== null && $target->enabled) {
            $crossposting->send($target, $this->payload);
        }
    }
}
