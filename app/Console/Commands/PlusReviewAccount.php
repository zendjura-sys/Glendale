<?php

namespace App\Console\Commands;

use App\Models\PlusGrant;
use App\Models\User;
use App\Services\Plus\Plus;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Тестовий акаунт для перевірки застосунку в Google Play (Play Console → App content → App access):
 * GameCon+ уже активний, тож перевіряльники бачать усі функції без жодної оплати.
 *
 *   php artisan plus:review-account                 — створити або оновити, новий пароль
 *   php artisan plus:review-account --keep-password — лише продовжити GameCon+
 */
class PlusReviewAccount extends Command
{
    protected $signature = 'plus:review-account
        {--email=play-review@gamecon.online : Пошта тестового акаунта}
        {--days=365 : На скільки днів має діяти GameCon+}
        {--keep-password : Не змінювати пароль (лише продовжити GameCon+)}';

    protected $description = 'Створити тестовий акаунт з активним GameCon+ для перевірки в Google Play';

    public function handle(Plus $plus): int
    {
        $email = (string) $this->option('email');
        $days = max(30, (int) $this->option('days'));
        $user = User::query()->where('email', $email)->first();
        $password = null;

        if ($user === null || ! $this->option('keep-password')) {
            $password = Str::password(16, symbols: false);
        }
        if ($user === null) {
            $user = User::query()->create([
                'username' => 'playreview',
                'first_name' => 'Play',
                'last_name' => 'Review',
                'email' => $email,
                'password' => Hash::make((string) $password),
            ]);
        } elseif ($password !== null) {
            $user->forceFill(['password' => Hash::make($password)])->save();
        }
        $user->forceFill(['email_verified_at' => $user->email_verified_at ?? now()])->save();

        // Продовжуємо, лише якщо до кінця лишилося менше потрібного строку.
        if ($user->plus_until === null || $user->plus_until->lt(now()->addDays($days - 1))) {
            $left = $user->plus_until?->isFuture() ? (int) now()->diffInDays($user->plus_until) : 0;
            $plus->grant($user, $days - $left, 'admin', note: 'Google Play review');
        }

        $this->info('Тестовий акаунт для Google Play: '.$email);
        if ($password !== null) {
            $this->line('Пароль (показується лише зараз): '.$password);
        }
        $this->line('GameCon+ до: '.$user->fresh()?->plus_until?->format('d.m.Y'));
        $this->line('Періодів GameCon+: '.PlusGrant::query()->where('owner_type', 'user')->where('owner_id', $user->id)->count());

        return self::SUCCESS;
    }
}
