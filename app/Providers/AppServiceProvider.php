<?php

namespace App\Providers;

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
use App\Models\User;
use App\Services\CommunityService;
use App\Services\Families\FamilyGate;
use App\Services\FriendshipService;
use App\Services\Push\PushNotifier;
use App\Support\Mail\AccountMail;
use App\Support\Mail\MailCategory;
use App\Support\Mail\SocialMailer;
use App\Support\Modules\ModuleManager;
use App\Support\Settings\SiteSettings;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(ModuleManager::class, fn () => new ModuleManager(config('modules')));
        $this->app->singleton(SiteSettings::class);
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

        // Тип листа визначає адресу: no-reply@ — «Оповіщення», social@ — «Соцмережі».
        Event::listen(MessageSending::class, function (MessageSending $event) {
            MailCategory::apply($event->message);
        });

        // Кожне сповіщення дзвіночка сайту також іде push-ом у застосунок і листом у «Соцмережі».
        Event::listen(NotificationSent::class, function (NotificationSent $event) {
            if ($event->channel === 'database' && $event->response instanceof DatabaseNotification) {
                rescue(fn () => app(PushNotifier::class)->notification($event->notifiable, $event->response), report: true);
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
