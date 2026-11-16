<?php

namespace App\Concerns;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

trait ProfileValidationRules
{
    /**
     * Get the validation rules used to validate user profiles.
     *
     * @return array<string, array<int, ValidationRule|array<mixed>|string>>
     */
    protected function profileRules(?int $userId = null): array
    {
        return [
            'first_name' => $this->nameRules(),
            'last_name' => ['nullable', 'string', 'max:64'],
            'email' => $this->emailRules($userId),
        ];
    }

    /**
     * Поля «Про себе», які редагуються в налаштуваннях профілю.
     *
     * @return array<string, array<int, ValidationRule|array<mixed>|string>>
     */
    protected function aboutRules(?int $userId = null): array
    {
        return [
            'username' => $this->usernameRules($userId),
            'status' => ['nullable', 'string', 'max:140'],
            'about' => ['nullable', 'string', 'max:2000'],
            'city' => ['nullable', 'string', 'max:80'],
            'birthday' => ['nullable', 'date', 'before:today', 'after:1900-01-01'],
            'gender' => ['nullable', Rule::in(['male', 'female'])],
            'website' => ['nullable', 'url:http,https', 'max:255'],
            'is_private' => ['boolean'],
        ];
    }

    /**
     * Get the validation rules used to validate user names.
     *
     * @return array<int, ValidationRule|array<mixed>|string>
     */
    protected function nameRules(): array
    {
        return ['required', 'string', 'max:64'];
    }

    /**
     * Короткі адреси сторінок: латиниця, цифри, крапка й підкреслення; не схожі на службові маршрути.
     *
     * @return array<int, ValidationRule|array<mixed>|string>
     */
    protected function usernameRules(?int $userId = null): array
    {
        return [
            'required',
            'string',
            'min:3',
            'max:32',
            'regex:/^[a-z][a-z0-9_.]*[a-z0-9]$/i',
            'not_regex:/^id\d+$/i',
            Rule::notIn(config('reserved.usernames')),
            $userId === null
                ? Rule::unique(User::class)
                : Rule::unique(User::class)->ignore($userId),
        ];
    }

    /**
     * Get the validation rules used to validate user emails.
     *
     * @return array<int, ValidationRule|array<mixed>|string>
     */
    protected function emailRules(?int $userId = null): array
    {
        return [
            'required',
            'string',
            'email',
            'max:255',
            $userId === null
                ? Rule::unique(User::class)
                : Rule::unique(User::class)->ignore($userId),
        ];
    }
}
