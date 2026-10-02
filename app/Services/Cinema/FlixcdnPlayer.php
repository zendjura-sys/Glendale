<?php

namespace App\Services\Cinema;

use App\Models\Movie;
use App\Support\Settings\SiteSettings;

/**
 * FlixCDN не має публічного API, тому плеєр будується за шаблоном адреси з кабінету FlixCDN:
 * {kinopoisk_id}, {imdb_id}, {token} підставляються для кожного фільму.
 */
class FlixcdnPlayer
{
    public const PLACEHOLDERS = ['{kinopoisk_id}', '{imdb_id}', '{token}'];

    public function __construct(private readonly SiteSettings $settings) {}

    public function template(): ?string
    {
        return $this->settings->get('flixcdn_template') ?: config('services.flixcdn.template');
    }

    public function token(): ?string
    {
        return $this->settings->secret('flixcdn_token') ?: config('services.flixcdn.token');
    }

    public function configured(): bool
    {
        return filled($this->template());
    }

    public function link(Movie $movie): ?string
    {
        $template = $this->template();
        if (! $template) {
            return null;
        }

        $values = [
            '{kinopoisk_id}' => $movie->kinopoisk_id,
            '{imdb_id}' => $movie->imdb_id,
            '{token}' => $this->token(),
        ];

        foreach ($values as $placeholder => $value) {
            if (str_contains($template, $placeholder)) {
                if (blank($value)) {
                    return null;
                }
                $template = str_replace($placeholder, rawurlencode((string) $value), $template);
            }
        }

        return $template;
    }
}
