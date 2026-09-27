<?php

namespace App\Providers;

use App\Models\Setting;
use Illuminate\Auth\Events\Registered;
use Illuminate\Auth\Listeners\SendEmailVerificationNotification;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        // Лідер і заступники керують інструментами СВОЄЇ активної родини
        // (звіти, банк, покарання, цілі, події, прогрес, розсилки) без ролі
        // адміністратора платформи.
        \Illuminate\Support\Facades\Queue::after(fn () => \App\Families\FamilyContext::flushCache());
        \Illuminate\Support\Facades\Gate::before(function ($user, string $ability) {
            if (in_array($ability, \App\Families\FamilyAbilities::MANAGER, true) && \App\Families\FamilyContext::isManager($user)) {
                return true;
            }

            return null;
        });

        // Без App\Providers\EventServiceProvider (его нет в Laravel 12 по
        // умолчанию) фреймворк сам по себе НЕ подписывает этот листенер —
        // без этой строки письмо с подтверждением email при регистрации
        // никогда не отправлялось, даже с рабочим SMTP.
        Event::listen(Registered::class, SendEmailVerificationNotification::class);

        // queue:work живёт до часа (--max-time=3600) и держит настройки в
        // статике процесса. Без этого сброса воркер ещё час работал бы со
        // старым токеном бота после того, как его сменили в админке:
        // Cache::forget() из веб-процесса чужую статику не трогает.
        Event::listen(JobProcessing::class, static fn () => Setting::flushMemo());

        // Force HTTPS when APP_URL uses https
        if (str_starts_with(env('APP_URL', ''), 'https://')) {
            URL::forceScheme('https');
            URL::forceRootUrl(env('APP_URL'));
        }
    }
}
