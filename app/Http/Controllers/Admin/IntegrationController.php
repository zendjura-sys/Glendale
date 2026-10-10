<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BotLink;
use App\Models\Game;
use App\Models\ImageFlag;
use App\Models\MovieSource;
use App\Models\PushDevice;
use App\Models\SpotifyAccount;
use App\Models\User;
use App\Models\UserStream;
use App\Models\VoiceParticipant;
use App\Models\VoiceRoom;
use App\Services\Auth\DiscordOAuth;
use App\Services\Auth\FirebaseAuth;
use App\Services\Bots\DiscordApi;
use App\Services\Bots\TelegramApi;
use App\Services\Cinema\CinemaException;
use App\Services\Cinema\FlixcdnClient;
use App\Services\Cinema\FlixcdnPlayer;
use App\Services\Cinema\KodikClient;
use App\Services\Cinema\Metadata\OmdbProvider;
use App\Services\Cinema\Metadata\ShikimoriProvider;
use App\Services\Cinema\Metadata\TmdbProvider;
use App\Services\Games\GameCatalog;
use App\Services\Games\Igdb;
use App\Services\I18n\DeepL;
use App\Services\Moderation\NsfwCheck;
use App\Services\Presence\SteamPresence;
use App\Services\Push\FcmClient;
use App\Services\Spotify\SpotifyClient;
use App\Services\Streams\LiveStreams;
use App\Services\Voice\LiveKit;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class IntegrationController extends Controller
{
    public function __construct(
        private readonly SiteSettings $settings,
        private readonly SpotifyClient $spotify,
        private readonly KodikClient $kodik,
        private readonly FlixcdnPlayer $flixcdn,
        private readonly FlixcdnClient $flixcdnApi,
        private readonly TmdbProvider $tmdb,
        private readonly ShikimoriProvider $shikimori,
        private readonly OmdbProvider $omdb,
        private readonly DiscordOAuth $discord,
        private readonly FirebaseAuth $firebase,
        private readonly FcmClient $fcm,
        private readonly LiveKit $livekit,
        private readonly GameCatalog $games,
        private readonly Igdb $igdb,
        private readonly SteamPresence $steam,
        private readonly DeepL $deepl,
    ) {}

    public function index(): Response
    {
        $secret = $this->spotify->clientSecret();

        return Inertia::render('admin/integrations', [
            'spotify' => [
                'client_id' => $this->spotify->clientId(),
                'secret_hint' => $secret ? Str::mask($secret, '•', 0, -4) : null,
                'from_env' => blank($this->settings->get('spotify_client_id')) && filled(config('services.spotify.client_id')),
                'configured' => $this->spotify->configured(),
                'redirect_uri' => $this->spotify->redirectUri(),
                'accounts' => SpotifyAccount::query()->count(),
                'premium' => SpotifyAccount::query()->where('product', 'premium')->count(),
                'scopes' => SpotifyClient::SCOPES,
            ],
            'cinema' => $this->cinemaCards(),
        ]);
    }

    public function updateSpotify(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'client_id' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{32}$/'],
            'client_secret' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{32}$/'],
            'clear' => ['sometimes', 'boolean'],
        ], [
            'client_id.regex' => 'Client ID — це 32 латинські літери та цифри.',
            'client_secret.regex' => 'Client Secret — це 32 латинські літери та цифри.',
        ]);

        if ($request->boolean('clear')) {
            $this->settings->put(['spotify_client_id' => null]);
            $this->settings->putSecret('spotify_client_secret', null);
            $this->spotify->forgetAppToken();
            Inertia::flash('toast', ['type' => 'success', 'message' => 'Ключі Spotify видалено.']);

            return back();
        }

        $this->settings->put(['spotify_client_id' => $data['client_id'] ?? null]);
        if (filled($data['client_secret'] ?? null)) {
            $this->settings->putSecret('spotify_client_secret', $data['client_secret']);
        }
        $this->spotify->forgetAppToken();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування Spotify збережено.']);

        return back();
    }

    public function testSpotify(): RedirectResponse
    {
        $ok = $this->spotify->configured() && $this->spotify->testCredentials();

        Inertia::flash('toast', $ok
            ? ['type' => 'success', 'message' => 'Spotify відповідає — ключі правильні ✅']
            : ['type' => 'error', 'message' => 'Spotify відхилив ключі. Перевірте Client ID і Secret.']);

        return back();
    }

    public function updateCinema(Request $request, string $provider): RedirectResponse
    {
        $meta = $this->cinemaProviders()[$provider] ?? null;
        if (! is_array($meta) || ! isset($meta['fields']) || ! is_array($meta['fields'])) {
            abort(404);
        }
        $fields = collect($this->providerFields($meta));

        if ($request->boolean('clear')) {
            foreach ($fields as $field) {
                $field['type'] === 'secret' ? $this->settings->putSecret($field['setting'], null) : $this->settings->put([$field['setting'] => null]);
            }
            Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування видалено.']);

            return back();
        }

        $data = $request->validate(
            $fields->mapWithKeys(fn (array $f) => [$f['name'] => $f['rules']])->all(),
            $fields->mapWithKeys(fn (array $f) => [$f['name'].'.regex' => $f['message'] ?? 'Некоректне значення.', $f['name'].'.url' => 'Вкажіть адресу, що починається з https://'])->all(),
        );

        foreach ($fields as $field) {
            $value = $data[$field['name']] ?? null;
            match ($field['type']) {
                'secret' => filled($value) ? $this->settings->putSecret($field['setting'], trim((string) $value)) : null,
                'bool' => $this->settings->put([$field['setting'] => (bool) $value]),
                default => $this->settings->put([$field['setting'] => filled($value) ? trim((string) $value) : null]),
            };
        }
        Cache::forget('cinema.meta.down.'.$provider);
        if ($provider === 'push') {
            $this->fcm->forgetAccessToken();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування '.$this->cinemaProviders()[$provider]['label'].' збережено.']);

        return back();
    }

    public function testCinema(string $provider): RedirectResponse
    {
        $meta = $this->cinemaProviders()[$provider] ?? abort(404);
        $ok = $meta['configured'] && ($meta['test'])();
        Cache::forget('cinema.meta.down.'.$provider);

        Inertia::flash('toast', $ok
            ? ['type' => 'success', 'message' => $meta['label'].' відповідає — підключення працює ✅']
            : ['type' => 'error', 'message' => $meta['configured'] ? $meta['label'].' відхилив ключ або недоступний.' : 'Спершу збережіть ключі.']);

        return back();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function cinemaCards(): array
    {
        $cards = [];
        foreach ($this->cinemaProviders() as $key => $provider) {
            $fields = [];
            foreach ($this->providerFields($provider) as $field) {
                $setting = $field['setting'] ?? null;
                $setting = is_string($setting) ? $setting : '';
                $type = $field['type'] ?? null;
                $value = $type === 'secret' ? $this->settings->secret($setting) : $this->settings->get($setting);
                $env = $field['env'] ?? null;
                $fields[] = [
                    'name' => $field['name'] ?? null,
                    'label' => $field['label'] ?? null,
                    'type' => $type,
                    'placeholder' => $field['placeholder'] ?? null,
                    'help' => $field['help'] ?? null,
                    'options' => $field['options'] ?? null,
                    'value' => $type === 'secret' ? null : $value,
                    'hint' => $type === 'secret' ? $this->hint(is_string($value) && $value !== '' ? $value : (is_string($env) ? $env : null)) : null,
                    'from_env' => blank($value) && filled($env),
                ];
            }
            $cards[] = [
                'key' => $key,
                'label' => $provider['label'] ?? null,
                'group' => $provider['group'] ?? null,
                'description' => $provider['description'] ?? null,
                'docs' => $provider['docs'] ?? null,
                'steps' => $provider['steps'] ?? null,
                'configured' => $provider['configured'] ?? null,
                'stat' => $provider['stat'] ?? null,
                'fields' => $fields,
            ];
        }

        return $cards;
    }

    /**
     * @param  array<string, mixed>  $provider
     * @return list<array<string, mixed>>
     */
    private function providerFields(array $provider): array
    {
        $raw = $provider['fields'] ?? null;
        if (! is_array($raw)) {
            return [];
        }

        $fields = [];
        foreach ($raw as $field) {
            if (! is_array($field)) {
                continue;
            }
            $row = [];
            foreach ($field as $name => $value) {
                if (is_string($name)) {
                    $row[$name] = $value;
                }
            }
            $fields[] = $row;
        }

        return $fields;
    }

    /**
     * Опис кіно-інтеграцій: поля форми, правила валідації й перевірка з’єднання.
     *
     * @return array<string, array<string, mixed>>
     */
    private function cinemaProviders(): array
    {
        $url = ['nullable', 'string', 'max:500', 'url:https'];

        return [
            'discord' => [
                'label' => 'Discord',
                'group' => 'auth',
                'description' => 'Вхід і реєстрація в один клік, прив’язка Discord до профілю та RP-сімей. З ботом — автоматичний статус «Граю в…» з Discord Rich Presence і події серверів із Discord у календарі.',
                'docs' => 'https://discord.com/developers/applications',
                'steps' => [
                    'Discord Developer Portal → New Application → OAuth2.',
                    'Додайте Redirect: '.$this->discord->redirectUri(),
                    'Скопіюйте Client ID і Client Secret сюди.',
                    'Для статусу «Граю в…»: у тому ж застосунку → Bot → Reset Token, скопіюйте токен; увімкніть Presence Intent і Server Members Intent.',
                    'OAuth2 → URL Generator → scope «bot» → відкрийте посилання й додайте бота на Discord-сервер GameCon. ID сервера: ПКМ по серверу → «Копіювати ID» (потрібен режим розробника).',
                    'Гравці мають прив’язати Discord у GameCon, бути на цьому Discord-сервері й увімкнути показ активності.',
                    'Календар: якщо адміністрація проєкту GTA додасть цього ж бота на свій Discord (посилання — на сторінці сервера в розділі «Події»), заплановані події того Discord самі з’являться в календарі GameCon.',
                ],
                'configured' => $this->discord->configured(),
                'stat' => User::query()->whereNotNull('discord_id')->count().' профілів із Discord',
                'test' => fn () => $this->discord->testCredentials(),
                'fields' => [
                    ['name' => 'client_id', 'setting' => 'discord_client_id', 'type' => 'text', 'label' => 'Client ID', 'placeholder' => '123456789012345678',
                        'rules' => ['nullable', 'string', 'regex:/^\d{15,22}$/'], 'message' => 'Client ID Discord — це 15–22 цифри.'],
                    ['name' => 'client_secret', 'setting' => 'discord_client_secret', 'type' => 'secret', 'label' => 'Client Secret', 'env' => config('services.discord.client_secret'),
                        'rules' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_\-]{20,64}$/'], 'message' => 'Client Secret містить недопустимі символи.'],
                    ['name' => 'bot_token', 'setting' => 'discord_bot_token', 'type' => 'secret', 'label' => 'Bot Token (статус «Граю в…»)', 'env' => config('services.discord.bot_token'),
                        'rules' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_\-\.]{50,100}$/'], 'message' => 'Токен бота Discord має вигляд «MTA…xxx.yyy.zzz».'],
                    ['name' => 'guild_id', 'setting' => 'discord_guild_id', 'type' => 'text', 'label' => 'ID Discord-сервера GameCon', 'placeholder' => '123456789012345678',
                        'rules' => ['nullable', 'string', 'regex:/^\d{15,22}$/'], 'message' => 'ID сервера Discord — це 15–22 цифри.'],
                ],
            ],
            'firebase' => [
                'label' => 'Google (Firebase)',
                'group' => 'auth',
                'description' => 'Вхід через Google-акаунт за допомогою Firebase Authentication.',
                'docs' => 'https://console.firebase.google.com',
                'steps' => [
                    'Firebase Console → Authentication → Sign-in method → увімкніть Google.',
                    'Authentication → Settings → Authorized domains: додайте '.parse_url((string) config('app.url'), PHP_URL_HOST).'.',
                    'Project settings → Your apps → Web app: скопіюйте apiKey, authDomain, projectId, appId.',
                ],
                'configured' => $this->firebase->configured(),
                'stat' => User::query()->whereNotNull('google_id')->count().' профілів із Google',
                'test' => fn () => $this->firebase->testCredentials(),
                'fields' => [
                    ['name' => 'api_key', 'setting' => 'firebase_api_key', 'type' => 'text', 'label' => 'apiKey', 'placeholder' => 'AIzaSy…',
                        'rules' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_\-]{30,60}$/'], 'message' => 'apiKey Firebase має вигляд AIzaSy…'],
                    ['name' => 'auth_domain', 'setting' => 'firebase_auth_domain', 'type' => 'text', 'label' => 'authDomain', 'placeholder' => 'gamecon.firebaseapp.com',
                        'help' => 'Можна лишити порожнім — візьмемо projectId.firebaseapp.com.',
                        'rules' => ['nullable', 'string', 'max:255', 'regex:/^[a-z0-9.\-]+$/'], 'message' => 'Вкажіть домен без https://'],
                    ['name' => 'project_id', 'setting' => 'firebase_project_id', 'type' => 'text', 'label' => 'projectId', 'placeholder' => 'gamecon-ua',
                        'rules' => ['nullable', 'string', 'regex:/^[a-z0-9\-]{4,40}$/'], 'message' => 'projectId — малі латинські літери, цифри й дефіс.'],
                    ['name' => 'app_id', 'setting' => 'firebase_app_id', 'type' => 'text', 'label' => 'appId', 'placeholder' => '1:1234567890:web:abc123',
                        'help' => 'Обов’язково: з номера проєкту в appId сервер перевіряє, що токен Google виданий саме вашому сайту.',
                        'rules' => ['nullable', 'string', 'max:100', 'regex:/^\d+:\d+:web:[0-9a-f]+$/'], 'message' => 'appId має вигляд 1:123…:web:…'],
                ],
            ],
            'push' => [
                'label' => 'Push-сповіщення (Firebase)',
                'group' => 'push',
                'description' => 'Сповіщення дзвіночка й нові повідомлення чатів приходять у застосунок GameCon, навіть коли він закритий.',
                'docs' => 'https://console.firebase.google.com',
                'steps' => [
                    'Firebase Console → Project settings → Cloud Messaging: переконайтеся, що Firebase Cloud Messaging API (V1) увімкнено.',
                    'Project settings → Service accounts → Generate new private key — завантажиться JSON-файл.',
                    'Відкрийте файл і вставте весь його вміст у поле нижче, потім натисніть «Перевірити».',
                    'Проєкт має бути тим самим, що й у google-services.json застосунку (пакет online.gamecon.app).',
                ],
                'configured' => $this->fcm->configured(),
                'stat' => PushDevice::query()->count().' пристроїв · '.PushDevice::query()->distinct()->count('user_id').' користувачів',
                'test' => fn () => $this->fcm->testCredentials(),
                'fields' => [
                    ['name' => 'service_account', 'setting' => 'fcm_service_account', 'type' => 'secret', 'label' => 'Ключ сервісного акаунта (JSON)', 'placeholder' => '{"type": "service_account", …}',
                        'env' => config('services.firebase.credentials'),
                        'rules' => ['nullable', 'string', 'max:10000', fn (string $attribute, mixed $value, \Closure $fail) => is_string($value) && FcmClient::parse($value) === null
                            ? $fail('Вставте повний JSON ключа сервісного акаунта Firebase (type: service_account).') : null],
                    ],
                ],
            ],
            'telegram_bot' => [
                'label' => 'Бот Telegram',
                'group' => 'bots',
                'description' => 'Офіційний бот GameCon: сім’ї, клани й спільноти додають його в свої групи одним натисканням. Події з кнопками «Піду / Не піду», нагадування, пости й меню — без команд.',
                'docs' => 'https://t.me/BotFather',
                'steps' => [
                    'Відкрийте @BotFather → /newbot, задайте ім’я (наприклад, GameCon) і username, скопіюйте токен сюди.',
                    'У @BotFather → /setjoingroups → Enable, щоб бота можна було додавати в групи.',
                    'Натисніть «Перевірити»: сайт запам’ятає @username бота й сам підключить вебхук '.url('/api/bots/telegram').'.',
                    'Далі керівники груп натискають «Додати в Telegram» у налаштуваннях своєї сім’ї, клану чи спільноти.',
                ],
                'configured' => app(TelegramApi::class)->token() !== null,
                'stat' => BotLink::query()->where('platform', BotLink::TELEGRAM)->count().' груп · '.User::query()->whereNotNull('telegram_id')->count().' прив’язаних акаунтів',
                'test' => fn () => app(TelegramApi::class)->connect(url('/api/bots/telegram')) !== null,
                'fields' => [
                    ['name' => 'token', 'setting' => 'telegram_bot_token', 'type' => 'secret', 'label' => 'Токен бота', 'env' => config('services.telegram.bot_token'),
                        'rules' => ['nullable', 'string', 'regex:/^\d{6,12}:[A-Za-z0-9_-]{30,50}$/'], 'message' => 'Токен від @BotFather має вигляд 123456789:AA…'],
                ],
            ],
            'discord_bot' => [
                'label' => 'Бот Discord',
                'group' => 'bots',
                'description' => 'Той самий застосунок Discord, що й для входу: бот публікує картки з кнопками в обраний канал сервера групи й видає ролі за складом.',
                'docs' => 'https://discord.com/developers/applications',
                'steps' => [
                    'Client ID, Client Secret і Bot Token беруться з блоку «Discord» вище — вони вже мають бути заповнені.',
                    'Developer Portal → ваш застосунок → OAuth2 → Redirects: додайте '.route('bots.discord.callback').'.',
                    'General Information → скопіюйте Public Key сюди.',
                    'Там же Interactions Endpoint URL: '.url('/api/bots/discord/interactions').' — збережіть (Discord перевірить адресу; спершу збережіть Public Key тут і задеплойте).',
                    'Ролі: роль бота на сервері групи має бути вище за ролі, які він видає.',
                ],
                'configured' => app(DiscordApi::class)->configured() && app(DiscordApi::class)->publicKey() !== null,
                'stat' => BotLink::query()->where('platform', BotLink::DISCORD)->count().' серверів',
                'test' => fn () => app(DiscordApi::class)->publicKey() !== null && $this->discord->testCredentials(),
                'fields' => [
                    ['name' => 'public_key', 'setting' => 'discord_public_key', 'type' => 'text', 'label' => 'Public Key', 'placeholder' => '64 символи hex',
                        'env' => config('services.discord.public_key'),
                        'rules' => ['nullable', 'string', 'regex:/^[0-9a-fA-F]{64}$/'], 'message' => 'Public Key — 64 символи 0–9, a–f.'],
                ],
            ],
            'twitch' => [
                'label' => 'Twitch',
                'group' => 'bots',
                'description' => '«Зараз у стрімі»: сайт сам бачить, коли гравці з каналом Twitch виходять в ефір, і показує LIVE. YouTube працює без ключа.',
                'docs' => 'https://dev.twitch.tv/console/apps',
                'steps' => [
                    'dev.twitch.tv → Your Console → Applications → Register Your Application.',
                    'OAuth Redirect URL: '.url('/').' (не використовується, але поле обов’язкове), Category: Website Integration.',
                    'Скопіюйте Client ID, натисніть New Secret і скопіюйте Client Secret сюди.',
                ],
                'configured' => filled($this->settings->get('twitch_client_id')) && $this->settings->secret('twitch_client_secret') !== null,
                'stat' => UserStream::query()->count().' каналів · '.UserStream::query()->where('is_live', true)->count().' зараз в ефірі',
                'test' => fn () => app(LiveStreams::class)->testTwitch(),
                'fields' => [
                    ['name' => 'client_id', 'setting' => 'twitch_client_id', 'type' => 'text', 'label' => 'Client ID', 'placeholder' => 'abcd1234…',
                        'rules' => ['nullable', 'string', 'regex:/^[a-z0-9]{20,40}$/'], 'message' => 'Client ID Twitch — 20–40 малих літер і цифр.'],
                    ['name' => 'client_secret', 'setting' => 'twitch_client_secret', 'type' => 'secret', 'label' => 'Client Secret',
                        'rules' => ['nullable', 'string', 'regex:/^[a-z0-9]{20,40}$/'], 'message' => 'Client Secret Twitch — 20–40 малих літер і цифр.'],
                ],
            ],
            'sightengine' => [
                'label' => 'Автоперевірка фото (Sightengine)',
                'group' => 'bots',
                'description' => 'Кожне фото в альбомах і записах перевіряється на відвертий вміст: сумнівні розмиваються, відверті йдуть у Модерація → «Фото на перевірці».',
                'docs' => 'https://sightengine.com/docs/nudity-detection-model-2.1',
                'steps' => [
                    'Зареєструйтеся на sightengine.com (є безкоштовний тариф).',
                    'Dashboard → API keys: скопіюйте API user і API secret сюди й натисніть «Перевірити».',
                ],
                'configured' => app(NsfwCheck::class)->configured(),
                'stat' => ImageFlag::query()->where('status', ImageFlag::PENDING)->count().' фото чекають рішення',
                'test' => fn () => app(NsfwCheck::class)->test(),
                'fields' => [
                    ['name' => 'user', 'setting' => 'sightengine_user', 'type' => 'text', 'label' => 'API user', 'placeholder' => '123456789',
                        'rules' => ['nullable', 'string', 'regex:/^\d{5,15}$/'], 'message' => 'API user — це число.'],
                    ['name' => 'secret', 'setting' => 'sightengine_secret', 'type' => 'secret', 'label' => 'API secret',
                        'rules' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{16,64}$/'], 'message' => 'API secret — латинські літери й цифри.'],
                ],
            ],
            'voice' => [
                'label' => 'Голосові кімнати (LiveKit)',
                'group' => 'voice',
                'description' => 'Голосові канали сімей і спільнот на сайті й у застосунку — як у Discord. Звук іде через ваш сервер LiveKit.',
                'docs' => 'https://docs.livekit.io/home/self-hosting/deployment/',
                'steps' => [
                    'Встановіть LiveKit на сервер: sudo bash deploy/livekit/setup-livekit.sh — скрипт видасть адресу, API Key і Secret.',
                    'Вставте їх нижче й натисніть «Перевірити».',
                    'Вебхук LiveKit скрипт уже налаштував на '.url('/api/livekit/webhook').' — так сайт бачить, хто в кімнаті.',
                ],
                'configured' => $this->livekit->configured(),
                'stat' => VoiceRoom::query()->count().' кімнат · '.VoiceParticipant::query()->count().' зараз у голосі',
                'test' => fn () => $this->livekit->test(),
                'fields' => [
                    ['name' => 'url', 'setting' => 'livekit_url', 'type' => 'text', 'label' => 'Адреса сервера', 'placeholder' => 'wss://voice.gamecon.online',
                        'env' => config('services.livekit.url'),
                        'rules' => ['nullable', 'string', 'max:255', 'regex:#^wss?://[^\s]+$#'], 'message' => 'Адреса має починатися з wss://'],
                    ['name' => 'api_key', 'setting' => 'livekit_api_key', 'type' => 'text', 'label' => 'API Key', 'placeholder' => 'APIxxxxxxxx',
                        'env' => config('services.livekit.key'),
                        'rules' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_\-]{6,64}$/'], 'message' => 'API Key — латинські літери й цифри.'],
                    ['name' => 'api_secret', 'setting' => 'livekit_api_secret', 'type' => 'secret', 'label' => 'API Secret',
                        'env' => config('services.livekit.secret'),
                        'rules' => ['nullable', 'string', 'min:16', 'max:128'], 'message' => 'Секрет LiveKit — щонайменше 16 символів.'],
                ],
            ],
            'igdb' => [
                'label' => 'Каталог ігор (IGDB)',
                'group' => 'games',
                'description' => 'Основне джерело каталогу мультиплеєрних ігор (база Twitch): ПК, телефони й консолі — обкладинки, жанри й прямі посилання на Steam, Google Play, App Store, Epic та інші магазини.',
                'docs' => 'https://api-docs.igdb.com/#account-creation',
                'steps' => [
                    'Увійдіть на dev.twitch.tv акаунтом Twitch (потрібна двоетапна автентифікація в налаштуваннях Twitch).',
                    'Your Console → Applications → Register Your Application: назва будь-яка, OAuth Redirect URL — http://localhost, категорія — Website Integration, тип клієнта — Confidential.',
                    'Відкрийте застосунок (Manage), скопіюйте Client ID, натисніть «New Secret» і скопіюйте Client Secret.',
                    'Вставте обидва значення нижче й натисніть «Перевірити». Безкоштовно.',
                    'Каталог оновлюється щодня о 04:40; першу синхронізацію можна запустити одразу: php artisan games:sync',
                ],
                'configured' => $this->igdb->configured(),
                'stat' => Game::query()->whereNotNull('igdb_id')->count().' ігор з IGDB · усього '.Game::query()->count(),
                'test' => fn () => $this->igdb->test(),
                'fields' => [
                    ['name' => 'client_id', 'setting' => 'igdb_client_id', 'type' => 'text', 'label' => 'Client ID', 'placeholder' => 'abcdefghij0123456789abcdefghij',
                        'env' => config('services.igdb.client_id'),
                        'rules' => ['nullable', 'string', 'regex:/^[a-z0-9]{20,40}$/'], 'message' => 'Client ID — 20–40 малих латинських літер і цифр.'],
                    ['name' => 'client_secret', 'setting' => 'igdb_client_secret', 'type' => 'secret', 'label' => 'Client Secret',
                        'env' => config('services.igdb.client_secret'),
                        'rules' => ['nullable', 'string', 'regex:/^[a-z0-9]{20,40}$/'], 'message' => 'Client Secret — 20–40 малих латинських літер і цифр.'],
                ],
            ],
            'rawg' => [
                'label' => 'Каталог ігор (RAWG)',
                'group' => 'games',
                'description' => 'Запасне джерело каталогу ігор: використовується, лише якщо IGDB не налаштовано.',
                'docs' => 'https://rawg.io/apidocs',
                'steps' => [
                    'Зареєструйтеся на rawg.io і відкрийте rawg.io/apidocs → «Get API Key» (безкоштовно, до 20 000 запитів на місяць).',
                    'Вставте ключ нижче й натисніть «Перевірити».',
                    'Каталог оновлюється щодня о 04:40; першу синхронізацію можна запустити одразу: php artisan games:sync',
                ],
                'configured' => $this->games->key() !== null,
                'stat' => Game::query()->whereNotNull('rawg_id')->count().' ігор з RAWG',
                'test' => fn () => $this->games->test(),
                'fields' => [
                    ['name' => 'key', 'setting' => 'rawg_key', 'type' => 'secret', 'label' => 'API Key', 'env' => config('services.rawg.key'),
                        'rules' => ['nullable', 'string', 'regex:/^[a-f0-9]{32}$/'], 'message' => 'Ключ RAWG — 32 символи (цифри й літери a–f).'],
                ],
            ],
            'kodik' => [
                'label' => 'Kodik',
                'group' => 'players',
                'description' => 'Плеєр з усіма озвучками, пошук та автоімпорт фільмів, серіалів і аніме.',
                'docs' => 'https://kodik.biz',
                'steps' => ['Зареєструйтеся на kodik.biz і отримайте API-токен.', 'Вставте токен і натисніть «Перевірити».', 'Увімкніть автонаповнення в Адмінка → Кіно.'],
                'configured' => $this->kodik->configured(),
                'stat' => MovieSource::query()->where('provider', 'kodik')->count().' плеєрів у каталозі',
                'test' => fn () => $this->kodik->test(),
                'fields' => [
                    ['name' => 'token', 'setting' => 'kodik_token', 'type' => 'secret', 'label' => 'API-токен', 'env' => config('services.kodik.token'),
                        'rules' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{16,64}$/'], 'message' => 'Токен Kodik — це 16–64 латинські літери та цифри.'],
                ],
            ],
            'flixcdn' => [
                'label' => 'FlixCDN',
                'group' => 'players',
                'description' => 'Другий балансер: плеєр за шаблоном адреси та автоімпорт через API з кабінету FlixCDN.',
                'docs' => 'https://t.me/FlixCDN',
                'steps' => [
                    'Отримайте токен і адреси API в кабінеті FlixCDN (або в їхній підтримці @FlixCDN).',
                    'Шаблон плеєра: адреса iframe з {imdb_id} та {token}.',
                    'Пошук API: адреса з {token} та {imdb_id} або {title}. Оновлення: з {token} і {page}.',
                ],
                'configured' => $this->flixcdn->configured() || $this->flixcdnApi->configured(),
                'stat' => MovieSource::query()->where('provider', 'flixcdn')->count().' плеєрів у каталозі',
                'test' => fn () => $this->flixcdnApi->configured() ? $this->flixcdnApi->test() : $this->flixcdn->configured(),
                'fields' => [
                    ['name' => 'token', 'setting' => 'flixcdn_token', 'type' => 'secret', 'label' => 'Токен', 'env' => config('services.flixcdn.token'),
                        'rules' => ['nullable', 'string', 'max:2000', 'regex:/^[A-Za-z0-9_\-.]+$/'], 'message' => 'Токен містить недопустимі символи.'],
                    ['name' => 'template', 'setting' => 'flixcdn_template', 'type' => 'url', 'label' => 'Шаблон плеєра',
                        'placeholder' => 'https://player.example/?imdb={imdb_id}&token={token}', 'help' => 'Підставляються {imdb_id} і {token}; працюють і інші ID з кабінету FlixCDN.',
                        'rules' => [...$url, $this->placeholderRule(['{kinopoisk_id}', '{imdb_id}'])]],
                    ['name' => 'api_search', 'setting' => 'flixcdn_api_search', 'type' => 'url', 'label' => 'API: пошук',
                        'placeholder' => 'https://api.example/search?token={token}&imdb_id={imdb_id}', 'help' => 'Для імпорту й оновлення плеєрів окремого фільму.',
                        'rules' => [...$url, $this->placeholderRule(['{kinopoisk_id}', '{imdb_id}', '{title}'])]],
                    ['name' => 'api_updates', 'setting' => 'flixcdn_api_updates', 'type' => 'url', 'label' => 'API: оновлення',
                        'placeholder' => 'https://api.example/updates?token={token}&page={page}', 'help' => 'Список новинок для автонаповнення.',
                        'rules' => $url],
                ],
            ],
            'tmdb' => [
                'label' => 'TMDB',
                'group' => 'metadata',
                'description' => 'Українські назви й описи, якісні постери та фони, трейлери, рейтинг TMDB.',
                'docs' => 'https://www.themoviedb.org/settings/api',
                'steps' => ['Увійдіть на themoviedb.org → Settings → API.', 'Скопіюйте «API Read Access Token» (або API Key).'],
                'configured' => $this->tmdb->configured(),
                'test' => fn () => $this->safe(fn () => $this->tmdb->test()),
                'fields' => [
                    ['name' => 'token', 'setting' => 'tmdb_token', 'type' => 'secret', 'label' => 'API Read Access Token або API Key', 'env' => config('services.tmdb.token'),
                        'rules' => ['nullable', 'string', 'max:1000', 'regex:/^[A-Za-z0-9_\-.]+$/'], 'message' => 'Ключ TMDB містить недопустимі символи.'],
                    ['name' => 'language', 'setting' => 'tmdb_language', 'type' => 'select', 'label' => 'Мова метаданих',
                        'options' => [['value' => 'uk-UA', 'label' => 'Українська'], ['value' => 'ru-RU', 'label' => 'Російська'], ['value' => 'en-US', 'label' => 'Англійська']],
                        'rules' => ['required', Rule::in(['uk-UA', 'ru-RU', 'en-US'])]],
                ],
            ],
            'shikimori' => [
                'label' => 'Shikimori',
                'group' => 'metadata',
                'description' => 'Аніме: назви, описи, жанри, епізоди та рейтинг. Ключ не потрібен.',
                'docs' => 'https://shikimori.one/api/doc',
                'steps' => ['Працює без ключа.', 'Якщо основний домен недоступний, вкажіть дзеркало.'],
                'configured' => $this->shikimori->configured(),
                'test' => fn () => $this->safe(fn () => $this->shikimori->test()),
                'fields' => [
                    ['name' => 'enabled', 'setting' => 'shikimori_enabled', 'type' => 'bool', 'label' => 'Використовувати Shikimori', 'rules' => ['required', 'boolean']],
                    ['name' => 'url', 'setting' => 'shikimori_url', 'type' => 'url', 'label' => 'Дзеркало', 'placeholder' => 'https://shikimori.one', 'rules' => $url],
                ],
            ],
            'steam' => [
                'label' => 'Steam',
                'group' => 'games',
                'description' => 'Автоматичний статус «Граю в…» для ПК-ігор: хто прив’язав профіль Steam, у того статус ставиться сам.',
                'docs' => 'https://steamcommunity.com/dev/apikey',
                'steps' => [
                    'Відкрийте steamcommunity.com/dev/apikey (потрібен акаунт Steam), домен — gamecon.online.',
                    'Скопіюйте ключ сюди й натисніть «Перевірити».',
                    'Гравці прив’язують профіль у Налаштування → «Граю в…»; профіль і «Деталі гри» в Steam мають бути відкриті.',
                ],
                'configured' => $this->steam->configured(),
                'stat' => User::query()->whereNotNull('steam_id')->count().' профілів зі Steam',
                'test' => fn () => $this->steam->test(),
                'fields' => [
                    ['name' => 'key', 'setting' => 'steam_api_key', 'type' => 'secret', 'label' => 'Web API Key', 'env' => config('services.steam.key'),
                        'rules' => ['nullable', 'string', 'regex:/^[A-F0-9]{32}$/'], 'message' => 'Ключ Steam — 32 символи (цифри й літери A–F).'],
                ],
            ],
            'deepl' => [
                'label' => 'DeepL',
                'group' => 'translate',
                'description' => 'Автопереклад інтерфейсу на додані мови (Адмінка → Мови) і кнопка «Перекласти» під записами та коментарями.',
                'docs' => 'https://www.deepl.com/pro-api',
                'steps' => [
                    'Зареєструйтеся на deepl.com → DeepL API (Free — до 500 000 символів на місяць безкоштовно, або Pro).',
                    'Account → API Keys → скопіюйте ключ. Ключ Free закінчується на «:fx».',
                    'Вставте ключ нижче й натисніть «Перевірити», потім додайте мови в Адмінці → Мови.',
                ],
                'configured' => $this->deepl->configured(),
                'test' => fn () => $this->deepl->test(),
                'fields' => [
                    ['name' => 'key', 'setting' => 'deepl_key', 'type' => 'secret', 'label' => 'Authentication Key', 'env' => config('services.deepl.key'),
                        'rules' => ['nullable', 'string', 'regex:/^[A-Za-z0-9\-]{30,48}(:fx)?$/'], 'message' => 'Ключ DeepL має вигляд xxxxxxxx-xxxx-…:fx'],
                ],
            ],
            'omdb' => [
                'label' => 'IMDb (OMDb)',
                'group' => 'metadata',
                'description' => 'Рейтинг IMDb, IMDb ID і постери. IMDb не має публічного API, тому дані йдуть через OMDb.',
                'docs' => 'https://www.omdbapi.com/apikey.aspx',
                'steps' => ['Отримайте безкоштовний ключ на omdbapi.com (1000 запитів на добу).', 'Підтвердьте email і вставте ключ.'],
                'configured' => $this->omdb->configured(),
                'test' => fn () => $this->safe(fn () => $this->omdb->test()),
                'fields' => [
                    ['name' => 'key', 'setting' => 'omdb_key', 'type' => 'secret', 'label' => 'API Key', 'env' => config('services.omdb.key'),
                        'rules' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{6,40}$/'], 'message' => 'Ключ OMDb — латинські літери та цифри.'],
                ],
            ],
        ];
    }

    /**
     * @param  list<string>  $placeholders
     */
    private function placeholderRule(array $placeholders): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) use ($placeholders) {
            if (is_string($value) && $value !== '' && ! Str::contains($value, $placeholders)) {
                $fail('Адреса має містити '.implode(' або ', array_diff($placeholders, ['{kinopoisk_id}'])).'.');
            }
        };
    }

    /**
     * @param  callable(): bool  $test
     */
    private function safe(callable $test): bool
    {
        try {
            return $test();
        } catch (CinemaException) {
            return false;
        }
    }

    private function hint(?string $secret): ?string
    {
        return $secret ? Str::mask($secret, '•', 0, -4) : null;
    }
}
