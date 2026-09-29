<?php

namespace App\Cinema\Kodik;

final readonly class KodikPage
{
    /** @param list<array<string, mixed>> $results */
    public function __construct(
        public array $results,
        public ?string $nextPage,
        public int $total,
    ) {}
}
