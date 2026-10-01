<?php

namespace App\Services\Auth;

final readonly class SocialProfile
{
    public function __construct(
        public string $provider,
        public string $id,
        public ?string $email,
        public bool $emailVerified,
        public string $name,
        public ?string $handle = null,
        public ?string $avatarUrl = null,
    ) {}

    public function label(): string
    {
        return SocialLogin::PROVIDERS[$this->provider];
    }
}
