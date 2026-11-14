# Увійти через GameCon — Laravel (Socialite)

```bash
composer config repositories.gamecon path packages/gamecon-socialite
composer require gamecon/socialite:*
```

`config/services.php`:

```php
'gamecon' => [
    'client_id' => env('GAMECON_CLIENT_ID'),
    'client_secret' => env('GAMECON_CLIENT_SECRET'),
    'redirect' => env('APP_URL').'/auth/gamecon/callback',
    'base_url' => 'https://gamecon.online',
],
```

`routes/web.php`:

```php
use Laravel\Socialite\Facades\Socialite;

Route::get('/auth/gamecon', fn () => Socialite::driver('gamecon')->redirect());

Route::get('/auth/gamecon/callback', function () {
    $gc = Socialite::driver('gamecon')->user();
    $user = \App\Models\User::updateOrCreate(
        ['gamecon_id' => $gc->getId()],
        ['name' => $gc->getName() ?: $gc->getNickname(), 'email' => $gc->getEmail() ?? $gc->getId().'@users.gamecon.online', 'avatar' => $gc->getAvatar()],
    );
    Auth::login($user, remember: true);

    return redirect('/');
});
```

Міграція: додайте до `users` колонку `gamecon_id` (string, unique, nullable).
Адреса повернення для застосунку GameCon: `https://ваш-сайт/auth/gamecon/callback`.
