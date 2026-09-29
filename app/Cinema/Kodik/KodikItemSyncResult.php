<?php

namespace App\Cinema\Kodik;

use App\Cinema\CinemaSyncEvent;
use App\Cinema\Title;

final readonly class KodikItemSyncResult
{
    public function __construct(
        public string $status,
        public ?Title $title,
        public CinemaSyncEvent $event,
    ) {}
}
