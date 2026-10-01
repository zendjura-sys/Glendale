<?php

namespace App\Services\Cinema;

use Illuminate\Http\JsonResponse;
use RuntimeException;

class CinemaException extends RuntimeException
{
    public function __construct(string $message, private readonly int $status = 502)
    {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], $this->status >= 400 && $this->status < 600 ? $this->status : 502);
    }
}
