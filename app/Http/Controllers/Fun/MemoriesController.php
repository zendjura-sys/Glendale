<?php

namespace App\Http\Controllers\Fun;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\User;
use App\Services\Engagement\Streaks;
use App\Services\PostPresenter;
use App\Support\Countries;
use App\Support\Plugins\Plugins;
use App\Support\Seasons;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
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
