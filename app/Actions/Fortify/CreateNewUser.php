<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Models\User;
use App\Services\CommunityService;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules, ProfileValidationRules;

    /** Скільки акаунтів можна створити з однієї IP-адреси за годину. */
    private const PER_HOUR = 5;

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

        // Пастка для ботів: поле приховане від людей, боти його заповнюють.
        if (filled($input['website'] ?? null)) {
            throw ValidationException::withMessages(['email' => 'Не вдалося зареєструватися. Спробуйте ще раз.']);
        }
        // Не більше кількох нових акаунтів з однієї адреси за годину.
        $key = 'register:'.request()->ip();
        if (RateLimiter::tooManyAttempts($key, self::PER_HOUR)) {
            throw ValidationException::withMessages(['email' => 'Забагато реєстрацій з вашої мережі. Спробуйте за годину.']);
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
        app(CommunityService::class)->autoJoin($user);
        RateLimiter::hit($key, 3600);

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
