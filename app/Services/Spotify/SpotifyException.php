<?php

namespace App\Services\Spotify;

use Illuminate\Http\JsonResponse;
use RuntimeException;

class SpotifyException extends RuntimeException
{
    public function __construct(string $message, private readonly int $status = 502)
    {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status >= 400 && $this->status < 600 ? $this->status : 502;
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], $this->status() === 401 ? 409 : $this->status());
    }
}
