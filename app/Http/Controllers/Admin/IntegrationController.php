<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MovieSource;
use App\Models\SpotifyAccount;
use App\Services\Cinema\CinemaException;
use App\Services\Cinema\FlixcdnClient;
use App\Services\Cinema\FlixcdnPlayer;
use App\Services\Cinema\KodikClient;
use App\Services\Cinema\Metadata\KinopoiskProvider;
use App\Services\Cinema\Metadata\OmdbProvider;
use App\Services\Cinema\Metadata\ShikimoriProvider;
use App\Services\Cinema\Metadata\TmdbProvider;
use App\Services\Spotify\SpotifyClient;
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
        private readonly KinopoiskProvider $kinopoisk,
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
        $fields = collect($this->cinemaProviders()[$provider]['fields'] ?? abort(404));

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
        return collect($this->cinemaProviders())->map(fn (array $p, string $key) => [
            'key' => $key,
            'label' => $p['label'],
            'group' => $p['group'],
            'description' => $p['description'],
            'docs' => $p['docs'],
            'steps' => $p['steps'],
            'configured' => $p['configured'],
            'stat' => $p['stat'] ?? null,
            'fields' => collect($p['fields'])->map(function (array $f) {
                $value = $f['type'] === 'secret' ? $this->settings->secret($f['setting']) : $this->settings->get($f['setting']);

                return [
                    'name' => $f['name'],
                    'label' => $f['label'],
                    'type' => $f['type'],
                    'placeholder' => $f['placeholder'] ?? null,
                    'help' => $f['help'] ?? null,
                    'options' => $f['options'] ?? null,
                    'value' => $f['type'] === 'secret' ? null : $value,
                    'hint' => $f['type'] === 'secret' ? $this->hint($value ?: ($f['env'] ?? null)) : null,
                    'from_env' => blank($value) && filled($f['env'] ?? null),
                ];
            })->values()->all(),
        ])->values()->all();
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
                    'Шаблон плеєра: адреса iframe з {kinopoisk_id} або {imdb_id}.',
                    'Пошук API: адреса з {token} і {kinopoisk_id}/{imdb_id}/{title}. Оновлення: з {token} і {page}.',
                ],
                'configured' => $this->flixcdn->configured() || $this->flixcdnApi->configured(),
                'stat' => MovieSource::query()->where('provider', 'flixcdn')->count().' плеєрів у каталозі',
                'test' => fn () => $this->flixcdnApi->configured() ? $this->flixcdnApi->test() : $this->flixcdn->configured(),
                'fields' => [
                    ['name' => 'token', 'setting' => 'flixcdn_token', 'type' => 'secret', 'label' => 'Токен', 'env' => config('services.flixcdn.token'),
                        'rules' => ['nullable', 'string', 'max:2000', 'regex:/^[A-Za-z0-9_\-.]+$/'], 'message' => 'Токен містить недопустимі символи.'],
                    ['name' => 'template', 'setting' => 'flixcdn_template', 'type' => 'url', 'label' => 'Шаблон плеєра',
                        'placeholder' => 'https://player.example/?kp={kinopoisk_id}&token={token}', 'help' => 'Підставляються {kinopoisk_id}, {imdb_id}, {token}.',
                        'rules' => [...$url, $this->placeholderRule(['{kinopoisk_id}', '{imdb_id}'])]],
                    ['name' => 'api_search', 'setting' => 'flixcdn_api_search', 'type' => 'url', 'label' => 'API: пошук',
                        'placeholder' => 'https://api.example/search?token={token}&kinopoisk_id={kinopoisk_id}', 'help' => 'Для імпорту й оновлення плеєрів окремого фільму.',
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
            'kinopoisk' => [
                'label' => 'КіноПошук',
                'group' => 'metadata',
                'description' => 'Рейтинг КіноПошуку, слогани, обкладинки (Kinopoisk API Unofficial).',
                'docs' => 'https://kinopoiskapiunofficial.tech',
                'steps' => ['Зареєструйтеся на kinopoiskapiunofficial.tech.', 'Скопіюйте токен з профілю.'],
                'configured' => $this->kinopoisk->configured(),
                'test' => fn () => $this->safe(fn () => $this->kinopoisk->test()),
                'fields' => [
                    ['name' => 'key', 'setting' => 'kinopoisk_key', 'type' => 'secret', 'label' => 'API-токен', 'env' => config('services.kinopoisk.key'),
                        'rules' => ['nullable', 'string', 'regex:/^[A-Za-z0-9\-]{8,64}$/'], 'message' => 'Токен — латинські літери, цифри та дефіси.'],
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
                $fail('Адреса має містити '.implode(' або ', $placeholders).'.');
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
