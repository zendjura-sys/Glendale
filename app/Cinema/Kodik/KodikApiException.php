<?php

namespace App\Cinema\Kodik;

use RuntimeException;
use Throwable;

final class KodikApiException extends RuntimeException
{
    /** @param array<string, bool|int|string|null> $safeContext */
    public function __construct(
        private readonly string $errorKind,
        string $message,
        private readonly array $safeContext = [],
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    public function kind(): string
    {
        return $this->errorKind;
    }

    public function retryable(): bool
    {
        return in_array($this->errorKind, ['rate_limit', 'transport', 'server'], true);
    }

    /** @return array<string, bool|int|string|null> */
    public function context(): array
    {
        return $this->safeContext + [
            'kind' => $this->errorKind,
            'retryable' => $this->retryable(),
        ];
    }
}
