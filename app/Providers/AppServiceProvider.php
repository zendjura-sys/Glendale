<?php

namespace App\Providers;

use App\Jobs\CheckImage;
use App\Jobs\RelayToBots;
use App\Models\ClanEvent;
use App\Models\Comment;
use App\Models\Community;
use App\Models\Family;
use App\Models\FamilyCashout;
use App\Models\FamilyDeposit;
use App\Models\FamilyEvent;
use App\Models\FamilyPunishment;
use App\Models\FamilyReport;
use App\Models\Movie;
use App\Models\Photo;
use App\Models\Post;
use App\Models\PostAttachment;
use App\Models\User;
use App\Services\Auth\AccountSecurity;
use App\Services\CommunityService;
use App\Services\Families\FamilyGate;
use App\Services\FriendshipService;
use App\Services\Moderation\NsfwCheck;
use App\Services\Push\PushNotifier;
use App\Services\Referrals;
use App\Support\I18n\CatalogLoader;
use App\Support\I18n\Locales;
use App\Support\I18n\Translations;
use App\Support\Mail\AccountMail;
use App\Support\Mail\MailBrand;
use App\Support\Mail\MailCategory;
use App\Support\Mail\SocialMailer;
use App\Support\Modules\ModuleManager;
use App\Support\NotifyPrefs;
use App\Support\Settings\SiteSettings;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Contracts\Translation\Loader;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Inertia\Ssr\SsrState;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(ModuleManager::class, fn () => new ModuleManager(config('modules')));
        $this->app->singleton(SiteSettings::class);
        $this->app->scoped(Translations::class);
        // Повідомлення валідації для мов без файлів у lang/ — з каталогу перекладів.
        $this->app->extend('translation.loader', fn (Loader $loader) => new CatalogLoader($loader));
        $this->app->scoped(FriendshipService::class);
        $this->app->scoped(CommunityService::class);
        $this->app->scoped(FamilyGate::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();

        // Захист від флуду на рівні застосунку (nginx стримує грубіше — deploy/nginx): запитів на хвилину
        // з одного акаунта чи адреси. Із запасом для звичайної роботи й оновлень у реальному часі.
        RateLimiter::for('web-global', fn (Request $request) => Limit::perMinute(600)->by('web|'.($request->user()?->id ?: $request->ip())));
        RateLimiter::for('api-global', fn (Request $request) => Limit::perMinute(600)->by('api|'.($request->user()?->id ?: $request->ip())));

        // $t у шаблонах листів: переклад мовою отримувача (Laravel ставить її з preferredLocale).
        View::share('t', fn (string $text, array $params = []) => (string) preg_replace_callback(
            '/\{(\w+)\}/',
            fn (array $m) => array_key_exists($m[1], $params) ? (string) $params[$m[1]] : $m[0],
            app(Translations::class)->line($text),
        ));

        // Перша сторінка Inertia вбудована в HTML. Компонент <x-inertia::app>
        // читає її з SsrState, а не з даних шаблону, тож переклад кладемо в обидва місця.
        // Інакше після повного завантаження (зокрема зміни мови) меню лишається українським,
        // доки наступний перехід Inertia не віддасть уже перекладений JSON.
        View::composer('app', function (\Illuminate\View\View $view) {
            $page = $view->getData()['page'] ?? null;
            if (! is_array($page) || App::getLocale() === Locales::SOURCE) {
                return;
            }
            $page = app(Translations::class)->tree($page);
            $view->with('page', $page);
            app(SsrState::class)->setPage($page);
        });

        // Новий акаунт за посиланням /r/{код}: друзі з запрошувачем, бонуси йому.
        User::created(function (User $user) {
            $code = request()->cookie(Referrals::COOKIE);
            app(Referrals::class)->attach($user, is_string($code) ? $code : null);
        });

        // Автоперевірка фото на відвертий вміст (лише коли в адмінці є ключі Sightengine).
        Photo::created(function (Photo $photo) {
            if (app(NsfwCheck::class)->configured()) {
                CheckImage::dispatch('photo', $photo->id);
            }
        });
        PostAttachment::created(function (PostAttachment $attachment) {
            if ($attachment->type === PostAttachment::TYPE_IMAGE && app(NsfwCheck::class)->configured()) {
                CheckImage::dispatch('post_image', $attachment->id);
            }
        });

        // Нова подія сім’ї чи клану — картка з кнопками в підключені чати Telegram / Discord.
        FamilyEvent::created(fn (FamilyEvent $event) => RelayToBots::maybe('family', $event->family_id, 'family_event', $event->id));
        ClanEvent::created(fn (ClanEvent $event) => RelayToBots::maybe('clan', $event->clan_id, 'clan_event', $event->id));

        Relation::enforceMorphMap([
            'user' => User::class,
            'post' => Post::class,
            'comment' => Comment::class,
            'community' => Community::class,
            'photo' => Photo::class,
            'movie' => Movie::class,
            'family' => Family::class,
            'family_report' => FamilyReport::class,
            'family_cashout' => FamilyCashout::class,
            'family_deposit' => FamilyDeposit::class,
            'family_punishment' => FamilyPunishment::class,
            'family_event' => FamilyEvent::class,
        ]);

        Model::preventLazyLoading(! app()->isProduction());

        AccountMail::register();

        // Журнал входів і список відкритих сесій.
        Event::listen(Login::class, function (Login $event) {
            if ($event->guard === 'web' && $event->user instanceof User) {
                app(AccountSecurity::class)->logLogin($event->user, AccountSecurity::methodFromRoute(request()->route()?->getName()), true);
            }
        });
        Event::listen(Failed::class, function (Failed $event) {
            if ($event->user instanceof User) {
                app(AccountSecurity::class)->logLogin($event->user, 'password', false);
            }
        });
        Event::listen(Logout::class, function () {
            if (request()->hasSession()) {
                app(AccountSecurity::class)->forget(request()->session()->getId());
            }
        });

        // Тип листа визначає адресу: no-reply@ — «Оповіщення», social@ — «Соцмережі».
        Event::listen(MessageSending::class, function (MessageSending $event) {
            MailCategory::apply($event->message);
            MailBrand::embed($event->message);
        });

        // Кожне сповіщення дзвіночка сайту також іде push-ом у застосунок і листом у «Соцмережі».
        Event::listen(NotificationSent::class, function (NotificationSent $event) {
            if ($event->channel !== 'database' || ! $event->response instanceof DatabaseNotification) {
                return;
            }

            $user = $event->notifiable;
            $data = $event->response->data;
            $kind = (string) ($data['kind'] ?? '');
            if ($user instanceof User && ! NotifyPrefs::allowsKind($user, $kind)) {
                return;
            }
            if ($user instanceof User && ! NotifyPrefs::enabled($user, 'site')) {
                $data['hidden'] = true;
                $event->response->forceFill(['data' => $data])->save();
            }
            if (! $user instanceof User || NotifyPrefs::enabled($user, 'push')) {
                rescue(fn () => app(PushNotifier::class)->notification($event->notifiable, $event->response), report: true);
            }
            if (! $user instanceof User || NotifyPrefs::enabled($user, 'email')) {
                rescue(fn () => app(SocialMailer::class)->notification($event->notifiable, $event->response), report: true);
            }
        });
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(10)
                ->letters()
                ->numbers()
                ->uncompromised()
            : null,
        );
    }
}
