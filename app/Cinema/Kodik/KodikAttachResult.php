<?php

namespace App\Cinema\Kodik;

final readonly class KodikAttachResult
{
    private function __construct(
        public string $status,
        public ?KodikApiException $exception = null,
    ) {}

    public static function attached(): self
    {
        return new self('attached');
    }

    public static function notFound(): self
    {
        return new self('not_found');
    }

    public static function failed(KodikApiException $exception): self
    {
        return new self('failed', $exception);
    }

    public function retryable(): bool
    {
        return $this->exception?->retryable() ?? false;
    }
}
