<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules, ProfileValidationRules;

    public function __construct(private readonly SiteSettings $settings) {}

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        if (! $this->settings->get('registration_open')) {
            throw ValidationException::withMessages(['email' => 'Реєстрацію тимчасово закрито.']);
        }

        Validator::make($input, [
            ...$this->profileRules(),
            'last_name' => ['required', 'string', 'max:64'],
            'password' => $this->passwordRules(),
        ])->validate();

        $isFirstUser = ! User::query()->exists();

        $user = User::create([
            'username' => $this->uniqueUsername($input['first_name'], $input['last_name']),
            'first_name' => $input['first_name'],
            'last_name' => $input['last_name'],
            'email' => $input['email'],
            'password' => $input['password'],
        ]);

        if ($isFirstUser) {
            $user->forceFill(['role' => User::ROLE_ADMIN])->save();
        }

        $user->mergePref(['onboarded' => false]);

        return $user;
    }

    private function uniqueUsername(string $firstName, string $lastName): string
    {
        $base = Str::of(Str::transliterate($firstName.'.'.$lastName))
            ->lower()
            ->replaceMatches('/[^a-z0-9.]+/', '')
            ->trim('.')
            ->limit(24, '')
            ->toString();

        if (strlen($base) < 3 || ! preg_match('/^[a-z]/', $base) || in_array($base, config('reserved.usernames'), true)) {
            $base = 'user';
        }

        $candidate = $base;
        while (User::query()->where('username', $candidate)->exists()) {
            $candidate = $base.random_int(10, 99999);
        }

        return $candidate;
    }
}
