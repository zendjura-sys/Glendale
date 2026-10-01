<?php

namespace App\Providers;

use App\Models\Comment;
use App\Models\Community;
use App\Models\Movie;
use App\Models\Photo;
use App\Models\Post;
use App\Models\User;
use App\Services\CommunityService;
use App\Services\FriendshipService;
use App\Support\Modules\ModuleManager;
use App\Support\Settings\SiteSettings;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
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
        ]);

        Model::preventLazyLoading(! app()->isProduction());
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
