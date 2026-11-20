<?php

namespace App\Http\Controllers\Fun;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\User;
use App\Services\Engagement\Streaks;
use App\Services\PostPresenter;
use App\Support\Countries;
use App\Support\Modules\ModuleManager;
use App\Support\NetworkModes;
use App\Support\Plugins\Plugins;
use App\Support\Seasons;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** «Цього дня» (власні записи минулих років), серія днів поспіль і карта гравців за країнами. */
class MemoriesController extends Controller
{
    public function memories(Request $request, PostPresenter $presenter): Response
    {
        app(Plugins::class)->ensure('memories');
        $user = $request->user();
        $today = CarbonImmutable::now('Europe/Kyiv');
        $posts = self::query($user, $today)->latest('id')->limit(30)->get();

        return Inertia::render('memories/index', [
            'date' => $today->toDateString(),
            'posts' => $presenter->many($posts, $user),
            'streak' => app(Streaks::class)->state($user),
        ]);
    }

    /** Скільки спогадів сьогодні (для банера в стрічці; кеш на день). */
    public static function count(User $user): int
    {
        if (! app(Plugins::class)->on('memories')) {
            return 0;
        }
        $today = CarbonImmutable::now('Europe/Kyiv');

        return (int) Cache::remember('memories:'.$user->id.':'.$today->toDateString(), $today->endOfDay(), fn () => self::query($user, $today)->count());
    }

    /**
     * @return Builder<Post>
     */
    private static function query(User $user, CarbonImmutable $today): Builder
    {
        return Post::query()
            ->where('author_id', $user->id)
            ->where('is_draft', false)
            ->whereMonth('created_at', $today->month)
            ->whereDay('created_at', $today->day)
            ->whereYear('created_at', '<', $today->year);
    }

    /** Рамка свята на аватарі: увімкнути чи вимкнути (діє, поки триває свято). */
    public function eventFrame(Request $request): JsonResponse
    {
        app(Plugins::class)->ensure('event_frames');
        $data = $request->validate(['on' => ['required', 'boolean']]);
        $user = $request->user();
        $user->forceFill(['preferences' => [...($user->preferences ?? []), 'event_frame' => (bool) $data['on']]])->save();

        return response()->json([
            'ok' => true,
            'event_frame' => $user->eventFrame(),
            'message' => $data['on'] ? 'Рамку свята ввімкнено.' : 'Рамку свята вимкнено.',
        ]);
    }

    /**
     * Свято, яке зараз триває (для перемикача рамки), і чи ввімкнена вона в людини.
     *
     * @return array{season: string, on: bool}|null
     */
    public static function frameState(User $user): ?array
    {
        if (! app(Plugins::class)->on('event_frames')) {
            return null;
        }
        $season = app(Seasons::class)->for(null);

        return $season === null ? null : ['season' => $season, 'on' => $user->pref('event_frame') === true];
    }

    /** Віджети головної (права колонка стрічки на сайті й картки в застосунку) — які й у якому порядку. */
    public const WIDGETS = ['streak', 'ready', 'online', 'suggestions', 'birthdays'];

    /**
     * @return list<string>
     */
    public static function widgets(User $user): array
    {
        $saved = $user->pref('home_widgets');
        if (! is_array($saved)) {
            return self::WIDGETS;
        }

        return array_values(array_filter($saved, fn ($key) => is_string($key) && in_array($key, self::WIDGETS, true)));
    }

    public function homeWidgets(Request $request): JsonResponse
    {
        app(Plugins::class)->ensure('home_widgets');
        $data = $request->validate([
            'widgets' => ['present', 'array', 'max:'.count(self::WIDGETS)],
            'widgets.*' => ['string', 'distinct', Rule::in(self::WIDGETS)],
        ]);
        $user = $request->user();
        $user->forceFill(['preferences' => [...($user->preferences ?? []), 'home_widgets' => array_values($data['widgets'])]])->save();

        return response()->json(['ok' => true, 'widgets' => self::widgets($user), 'message' => 'Віджети збережено.']);
    }

    /**
     * Лобі (головна): кожен блок — віджет. Людина сама вирішує, які показувати, у якому порядку
     * й якого розміру («half» — пів ширини на ПК, «full» — на всю). Однаково на сайті й у застосунку.
     */
    public const LAYOUT_WIDGETS = [
        'pulse', 'stories', 'continue', 'requests', 'contacts', 'voice', 'servers', 'season',
        'online', 'playing', 'same_game', 'picks', 'suggestions', 'birthdays', 'media', 'alerts', 'player',
    ];

    /**
     * Усі ключі вибору лобі: категорії (розділи) і «категорія.підкатегорія» (функціонал розділу).
     * Каталог — config/lobby.php.
     *
     * @return list<string>
     */
    public static function lobbyKeys(): array
    {
        $keys = [];
        foreach ((array) config('lobby.categories') as $category => $def) {
            $keys[] = (string) $category;
            foreach (array_keys((array) ($def['subs'] ?? [])) as $sub) {
                $keys[] = $category.'.'.$sub;
            }
        }

        return $keys;
    }

    /**
     * Каталог категорій для людини: лише розділи її режиму й увімкнених модулів.
     *
     * @return list<array{key: string, label: string, new: bool, subs: list<array{key: string, label: string, new: bool}>}>
     */
    public static function lobbyCatalog(User $user): array
    {
        $modules = app(NetworkModes::class)->modulesFor($user);
        $out = [];
        foreach ((array) config('lobby.categories') as $key => $def) {
            $module = $def['module'] ?? null;
            if ($module !== null && (! app(ModuleManager::class)->enabled($module) || ! in_array($module, $modules, true))) {
                continue;
            }
            $subs = [];
            foreach ((array) ($def['subs'] ?? []) as $sub => $item) {
                $label = is_array($item) ? (string) ($item['label'] ?? $sub) : (string) $item;
                $subs[] = ['key' => (string) $sub, 'label' => $label, 'new' => self::isNew(is_array($item) ? ($item['added'] ?? null) : null)];
            }
            $out[] = ['key' => (string) $key, 'label' => (string) $def['label'], 'new' => self::isNew($def['added'] ?? null), 'subs' => $subs];
        }

        return $out;
    }

    /** Додано за останні 7 днів — бірка «New!». */
    private static function isNew(mixed $added): bool
    {
        if (! is_string($added) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $added)) {
            return false;
        }

        return CarbonImmutable::parse($added)->addDays(7)->isFuture();
    }

    /**
     * Вибір людини (без збереженого — усе ввімкнено).
     *
     * @return list<string>
     */
    public static function categories(User $user): array
    {
        $saved = $user->pref('lobby_categories');
        if (! is_array($saved)) {
            return self::lobbyKeys();
        }

        return array_values(array_intersect(self::lobbyKeys(), $saved));
    }

    public function lobbyCategories(Request $request): JsonResponse
    {
        $data = $request->validate([
            'categories' => ['present', 'array', 'max:'.count(self::lobbyKeys())],
            'categories.*' => ['string', 'distinct', Rule::in(self::lobbyKeys())],
        ]);
        $user = $request->user();
        $user->forceFill(['preferences' => [...($user->preferences ?? []), 'lobby_categories' => array_values($data['categories'])]])->save();

        return response()->json(['ok' => true, 'categories' => self::categories($user), 'message' => 'Лобі збережено.']);
    }

    /** Розклад за замовчуванням: спершу «що зараз», далі люди, далі решта. */
    public const LAYOUT_DEFAULT = [
        ['key' => 'stories', 'size' => 'full'],
        ['key' => 'player', 'size' => 'half'],
        ['key' => 'continue', 'size' => 'full'],
        ['key' => 'alerts', 'size' => 'full'],
        ['key' => 'requests', 'size' => 'half'],
        ['key' => 'contacts', 'size' => 'half'],
        ['key' => 'playing', 'size' => 'half'],
        ['key' => 'voice', 'size' => 'half'],
        ['key' => 'season', 'size' => 'half'],
        ['key' => 'servers', 'size' => 'half'],
        ['key' => 'suggestions', 'size' => 'half'],
        ['key' => 'birthdays', 'size' => 'half'],
        ['key' => 'media', 'size' => 'full'],
    ];

    /**
     * @return list<array{key: string, size: string}>
     */
    public static function layout(User $user): array
    {
        $saved = $user->pref('home_layout');
        if (! is_array($saved)) {
            return self::LAYOUT_DEFAULT;
        }
        $out = [];
        foreach ($saved as $item) {
            $key = is_array($item) ? ($item['key'] ?? null) : null;
            if (! is_string($key) || ! in_array($key, self::LAYOUT_WIDGETS, true) || isset($out[$key])) {
                continue;
            }
            $out[$key] = ['key' => $key, 'size' => ($item['size'] ?? 'half') === 'full' ? 'full' : 'half'];
        }

        return array_values($out);
    }

    public function homeLayout(Request $request): JsonResponse
    {
        app(Plugins::class)->ensure('home_widgets');
        $data = $request->validate([
            'layout' => ['present', 'array', 'max:'.count(self::LAYOUT_WIDGETS)],
            'layout.*.key' => ['required', 'string', 'distinct', Rule::in(self::LAYOUT_WIDGETS)],
            'layout.*.size' => ['required', 'string', Rule::in(['half', 'full'])],
        ]);
        $user = $request->user();
        $layout = array_map(fn (array $i) => ['key' => (string) $i['key'], 'size' => (string) $i['size']], array_values($data['layout']));
        $user->forceFill(['preferences' => [...($user->preferences ?? []), 'home_layout' => $layout]])->save();

        return response()->json(['ok' => true, 'layout' => self::layout($user), 'message' => 'Лобі збережено.']);
    }

    /** Карта гравців: скільки людей з кожної країни (лише суми, без імен). */
    public function map(): Response
    {
        app(Plugins::class)->ensure('players_map');

        return Inertia::render('map/index', ['countries' => self::countries()]);
    }

    /**
     * @return list<array{code: string, name: string, count: int}>
     */
    public static function countries(): array
    {
        return Cache::remember('players-map', 600, function () {
            $counts = User::query()->whereNotNull('country')->whereNull('banned_at')
                ->whereIn('country', array_keys(Countries::NAMES))
                ->selectRaw('country, count(*) as total')->groupBy('country')->pluck('total', 'country');
            $rows = [];
            foreach (Countries::NAMES as $code => $name) {
                $rows[] = ['code' => $code, 'name' => $name, 'count' => (int) ($counts[$code] ?? 0)];
            }
            usort($rows, fn (array $a, array $b) => $b['count'] <=> $a['count']);

            return $rows;
        });
    }
}
