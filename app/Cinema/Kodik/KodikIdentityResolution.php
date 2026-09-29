<?php

namespace App\Cinema\Kodik;

use App\Cinema\Title;

final readonly class KodikIdentityResolution
{
    /** @param list<int> $candidateIds */
    public function __construct(
        public string $status,
        public ?Title $title,
        public string $reason,
        public array $candidateIds = [],
    ) {}

    /** @param list<int> $candidateIds */
    public static function matched(Title $title, string $reason, array $candidateIds): self
    {
        return new self('matched', $title, $reason, array_values(array_unique($candidateIds)));
    }

    public static function new(): self
    {
        return new self('new', null, 'no_match');
    }

    /** @param list<int> $candidateIds */
    public static function ambiguous(string $reason, array $candidateIds): self
    {
        return new self('ambiguous', null, $reason, array_values(array_unique($candidateIds)));
    }
}
