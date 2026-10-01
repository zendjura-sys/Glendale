<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Messenger;
use App\Support\Modules\ModuleManager;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    public function __construct(
        private readonly ModuleManager $modules,
        private readonly SiteSettings $settings,
        private readonly FriendshipService $friendships,
    ) {}

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'name' => $this->settings->get('site_name'),
            'site' => [
                'name' => $this->settings->get('site_name'),
                'tagline' => $this->settings->get('tagline'),
                'registration_open' => (bool) $this->settings->get('registration_open'),
                'max_attachments' => (int) $this->settings->get('max_attachments'),
                'max_message_file_mb' => (int) $this->settings->get('max_message_file_mb'),
                'announcement' => $this->settings->get('maintenance_message'),
            ],
            'auth' => [
                'user' => $user ? [
                    ...$user->toCard(),
                    'last_name' => $user->last_name,
                    'email' => $user->email,
                    'email_verified_at' => $user->email_verified_at,
                    'two_factor_enabled' => $user->two_factor_confirmed_at !== null,
                    'role' => $user->role,
                    'is_admin' => $user->isAdmin(),
                    'cover_url' => $user->cover_url,
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at,
                ] : null,
            ],
            'nav' => $user ? fn () => $this->modules->navigation() : [],
            'modules' => fn () => $this->modules->enabledKeys(),
            'music' => $user ? fn () => $this->musicProps($user) : null,
            'counters' => $user ? fn () => [
                'friend_requests' => $this->friendships->incomingCount($user),
                'notifications' => $user->unreadNotifications()->count(),
                'messages' => $this->modules->enabled('messages') ? app(Messenger::class)->unreadConversations($user) : 0,
            ] : null,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function musicProps(User $user): ?array
    {
        if (! $this->modules->enabled('music')) {
            return null;
        }

        $account = $user->spotifyAccount;

        return ['spotify' => ['connected' => $account !== null, 'premium' => (bool) $account?->isPremium()]];
    }
}
