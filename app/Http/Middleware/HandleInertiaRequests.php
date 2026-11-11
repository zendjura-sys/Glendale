<?php

namespace App\Http\Middleware;

use App\Http\Controllers\Fun\MemoriesController;
use App\Http\Controllers\Settings\GameThemeController;
use App\Http\Controllers\StatusPageController;
use App\Models\Track;
use App\Models\User;
use App\Services\Alerts\AirAlertService;
use App\Services\Auth\DiscordOAuth;
use App\Services\Auth\FirebaseAuth;
use App\Services\Billing\Catalog;
use App\Services\Billing\Checkout;
use App\Services\Billing\GooglePay;
use App\Services\Billing\Shop;
use App\Services\Engagement\Streaks;
use App\Services\FriendshipService;
use App\Services\I18n\ContentTranslator;
use App\Services\Messenger;
use App\Services\Moderation\ContentFilter;
use App\Services\Phones\PhoneNumbers;
use App\Services\Spotify\SpotifyClient;
use App\Services\Wrapped\YearInReview;
use App\Support\AuthImages;
use App\Support\Backgrounds;
use App\Support\I18n\Locales;
use App\Support\Modules\ModuleManager;
use App\Support\NetworkModes;
use App\Support\NotifyPrefs;
use App\Support\Plugins\Plugins;
use App\Support\Seasons;
use App\Support\Settings\SiteSettings;
use App\Support\Skins;
use App\Support\Staff\StaffRoles;
use App\Support\TeenMode;
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
                'child_safety' => __('ui.child_safety'),
                'rights' => __('ui.all_rights_reserved'),
            ],
            'site' => [
                'name' => $this->settings->get('site_name'),
                'tagline' => $this->settings->get('tagline'),
                'description' => $this->settings->seoDescription(),
                // Магазини застосунку (Адмінка → Дизайн): лише ті, де вказано посилання.
                'app_links' => (object) $this->settings->appLinks(),
                'play_store' => transform($this->settings->playStoreUrl(), fn (string $url) => ['url' => $url, 'badge' => $this->settings->playStoreBadge()]),
                'registration_open' => (bool) $this->settings->get('registration_open'),
                // Фони входу й реєстрації (Адмінка → Дизайн): комп'ютер і планшет, телефон.
                'auth_images' => collect(AuthImages::urls())->only(['site_desktop', 'site_mobile'])->all(),
                'translate' => app(ContentTranslator::class)->enabled(),
                'max_attachments' => (int) $this->settings->get('max_attachments'),
                'max_message_file_mb' => (int) $this->settings->get('max_message_file_mb'),
                'announcement' => $this->settings->get('maintenance_message'),
                // Google Analytics 4 (G-…): завантажується лише після згоди на аналітичні cookie.
                'analytics' => $this->settings->analyticsId(),
                // Завантаження музики: ліміт і формати (кнопка «Завантажити» в розділі «Музика»).
                'music_upload' => ['max_mb' => (int) $this->settings->get('music_max_track_mb'), 'formats' => Track::uploadFormats()],
                // «Підсумки року» відкриті (грудень — січень): банер у стрічці й пункт меню.
                'wrapped' => app(Plugins::class)->on('wrapped') ? app(YearInReview::class)->season() : null,
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
                    // Внутрішній номер GameCon (+555 / +777) або null.
                    'phone' => $this->modules->enabled('phone') ? app(PhoneNumbers::class)->current($user)?->toCard() : null,
                    'hide_spoilers' => app(Plugins::class)->on('spoiler_switch') && (bool) $user->pref('hide_spoilers'),
                    'profanity_mask' => TeenMode::hidesProfanity($user) ? app(ContentFilter::class)->clientPattern() : null,
                    // «Показувати, що я слухаю» (усі джерела музики; Spotify — ще й своїм перемикачем).
                    'show_listening' => $user->showsListening(),
                    'morning_digest' => $user->wantsDigest(),
                    // Економія трафіку: фото по дотику, відео не грає саме.
                    'data_saver' => $user->pref('data_saver') === true,
                    // Режим стримера: особисте на екрані розмите.
                    'streamer_mode' => app(Plugins::class)->on('streamer_mode') && $user->pref('streamer_mode') === true,
                    // Звук нових повідомлень і сповіщень (Налаштування → Оформлення).
                    'notify_sound' => in_array($sound = $user->pref('notify_sound', 'soft'), GameThemeController::SOUNDS, true) ? $sound : 'soft',
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
                // Знижка на GameCon+ для сім’ї лідерам із власним GameCon+ (%).
                'family_plus_discount' => app(Catalog::class)->familyPlusDiscount(),
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
            // Вікно «Отримайте номер» для акаунтів без номера (після онбордингу; «Пізніше» — більше не показуємо).
            'phonePrompt' => fn () => $user !== null && $this->modules->enabled('phone') && $user->pref('onboarded') !== false
                && $user->pref('phone_prompt') !== false && app(PhoneNumbers::class)->current($user) === null,
            // Фірмовий фон з адмінки (картинки для ПК і телефона) або null.
            'siteBackground' => fn () => Backgrounds::image(),
            // Режим «очима людини»: банер з кнопкою виходу.
            'viewAs' => $request->attributes->get('view_as_admin') !== null && $user ? ['name' => $user->name, 'username' => $user->username] : null,
            // Ролі команди: які розділи адмінки бачить модератор.
            // Мапа тривог: розділ і інформер — лише для людей з України.
            'airAlerts' => $user ? fn () => app(AirAlertService::class)->isAvailableFor($request) : false,
            'staffSections' => $user?->isStaff() ? fn () => StaffRoles::sections($user) : null,
            // Активний збій зі сторінки статусу — тонкий банер угорі (null, коли все працює).
            'incident' => fn () => StatusPageController::banner(),
            // Серія днів поспіль, спогади «цього дня» й рамка свята (для бічної панелі, стрічки й налаштувань).
            'engagement' => $user ? fn () => [
                'streak' => app(Streaks::class)->state($user),
                'memories' => MemoriesController::count($user),
                'frame' => MemoriesController::frameState($user),
                'widgets' => MemoriesController::widgets($user),
            ] : null,
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
