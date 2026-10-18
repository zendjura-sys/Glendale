<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\Auth\DiscordOAuth;
use App\Services\Auth\FirebaseAuth;
use App\Services\Billing\Catalog;
use App\Services\Billing\Checkout;
use App\Services\Billing\GooglePay;
use App\Services\Billing\Shop;
use App\Services\FriendshipService;
use App\Services\I18n\ContentTranslator;
use App\Services\Messenger;
use App\Services\Moderation\ContentFilter;
use App\Services\Spotify\SpotifyClient;
use App\Support\Backgrounds;
use App\Support\I18n\Locales;
use App\Support\Modules\ModuleManager;
use App\Support\NetworkModes;
use App\Support\NotifyPrefs;
use App\Support\Plugins\Plugins;
use App\Support\Seasons;
use App\Support\Settings\SiteSettings;
use App\Support\Skins;
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
            'locale' => app()->getLocale(),
            'locales' => app(Locales::class)->options(),
            // Футер на всіх сторінках: документи, копірайт мовою інтерфейсу (lang/{locale}/ui.php).
            'footer' => [
                'year' => (int) date('Y'),
                'terms' => __('ui.terms'),
                'privacy' => __('ui.privacy'),
                'refund' => __('ui.refund'),
                'pricing' => __('ui.pricing'),
                'contacts' => __('ui.contacts'),
                'rights' => __('ui.all_rights_reserved'),
            ],
            'site' => [
                'name' => $this->settings->get('site_name'),
                'tagline' => $this->settings->get('tagline'),
                'description' => $this->settings->seoDescription(),
                'play_store' => transform($this->settings->playStoreUrl(), fn (string $url) => ['url' => $url, 'badge' => $this->settings->playStoreBadge()]),
                'registration_open' => (bool) $this->settings->get('registration_open'),
                'translate' => app(ContentTranslator::class)->enabled(),
                'max_attachments' => (int) $this->settings->get('max_attachments'),
                'max_message_file_mb' => (int) $this->settings->get('max_message_file_mb'),
                'announcement' => $this->settings->get('maintenance_message'),
                'social' => [
                    'discord' => app(DiscordOAuth::class)->configured(),
                    'google' => app(FirebaseAuth::class)->clientConfig(),
                ],
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
                    'nav_tabs' => array_values(array_intersect($this->modules->navTabsFor($user), app(NetworkModes::class)->modulesFor($user))),
                    'network_mode' => app(NetworkModes::class)->for($user)['id'],
                    'palette' => $user->palette(),
                    'background' => Backgrounds::for($user),
                    'skin' => Skins::for($user),
                    'theme' => Skins::theme($user),
                    'hide_spoilers' => app(Plugins::class)->on('spoiler_switch') && (bool) $user->pref('hide_spoilers'),
                    'profanity_mask' => $user->pref('hide_profanity') ? app(ContentFilter::class)->clientPattern() : null,
                    // До коли діє GameCon+ (оплата — карткою через monobank, без балансу).
                    'plus_until' => $user->plus_until?->toIso8601String(),
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at,
                ] : null,
            ],
            // Оплата (лише сайт): тарифи з адмінки, чи працює оплата карткою, нативний Google Pay, значки карток у підвалі.
            'billing' => fn () => [
                'card' => app(Checkout::class)->available(),
                'products' => Shop::catalog(),
                'save_card' => app(Catalog::class)->rules()['offer_save_card'],
                'badges' => app(Catalog::class)->rules()['badges'],
                'google_pay' => $user ? app(GooglePay::class)->clientConfig() : null,
            ],
            // Режим соцмережі ховає частину розділів і функцій (лише в інтерфейсі цієї людини).
            'nav' => $user ? fn () => $this->visibleNav($user) : [],
            'modules' => fn () => app(NetworkModes::class)->modulesFor($user),
            'plugins' => fn () => app(NetworkModes::class)->pluginsFor($user),
            'features' => fn () => app(NetworkModes::class)->featuresFor($user),
            // Сезонні прикраси (Новий рік, Великдень…) або null.
            'season' => fn () => app(Seasons::class)->for($user),
            // Фірмовий фон з адмінки (картинки для ПК і телефона) або null.
            'siteBackground' => fn () => Backgrounds::image(),
            'music' => $user ? fn () => $this->musicProps($user) : null,
            'counters' => $user ? fn () => [
                'friend_requests' => $this->friendships->incomingCount($user),
                'notifications' => NotifyPrefs::unreadCount($user),
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

        return ['spotify' => [
            'connected' => $account !== null,
            'premium' => (bool) $account?->isPremium(),
            'configured' => app(SpotifyClient::class)->configured(),
        ]];
    }

    /**
     * Пункти меню, які людина бачить у своєму режимі.
     *
     * @return list<array<string, mixed>>
     */
    private function visibleNav(User $user): array
    {
        $visible = app(NetworkModes::class)->modulesFor($user);

        return array_values(array_filter(
            $this->modules->navigation(),
            fn (array $item) => in_array($item['key'], $visible, true),
        ));
    }
}
