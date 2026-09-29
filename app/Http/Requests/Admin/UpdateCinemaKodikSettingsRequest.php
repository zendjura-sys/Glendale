<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCinemaKodikSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('cinema.manage') ?? false;
    }

    public function rules(): array
    {
        $rules = [
            'types' => ['sometimes', 'array', 'max:20'],
            'types.*' => ['string', Rule::in(['foreign-movie', 'soviet-cartoon', 'foreign-cartoon', 'russian-cartoon', 'anime', 'russian-movie', 'cartoon-serial', 'documentary-serial', 'russian-serial', 'foreign-serial', 'anime-serial', 'multi-part-film'])],
            'year_from' => ['sometimes', 'nullable', 'integer', 'between:1900,2100'],
            'year_to' => ['sometimes', 'nullable', 'integer', 'between:1900,2100'],
            'max_minimal_age' => ['sometimes', 'nullable', 'integer', 'between:0,21'],
            'ratings' => ['sometimes', 'array:kinopoisk,imdb,shikimori,mydramalist'],
            'ratings.*' => ['numeric', 'between:0,10'],
        ];
        foreach (['allowed_countries', 'blocked_countries', 'allowed_genres', 'blocked_genres', 'translation_ids', 'blocked_translation_ids', 'translation_types', 'rating_mpaa', 'anime_kinds', 'mydramalist_tags', 'anime_statuses', 'drama_statuses', 'anime_studios', 'anime_licensed_by', 'required_available_in', 'blacklisted_ids'] as $key) {
            $rules[$key] = ['sometimes', 'array', 'max:1000'];
            $rules[$key.'.*'] = ['string', 'max:255'];
        }
        $rules['translation_types.*'] = ['string', Rule::in(['voice', 'subtitles'])];
        foreach (['allow_camrip', 'allow_lgbt', 'require_poster', 'require_description', 'update_existing', 'auto_publish'] as $key) {
            $rules[$key] = ['sometimes', 'boolean'];
        }

        return $rules;
    }
}
