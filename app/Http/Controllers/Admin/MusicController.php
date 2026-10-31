<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\EnrichTrackMetadata;
use App\Models\Playlist;
use App\Models\SpotifyAccount;
use App\Models\Track;
use App\Services\Music\AcoustId;
use App\Services\Music\AudioProbe;
use App\Services\Music\Discogs;
use App\Services\Music\LastFm;
use App\Services\Music\MetadataEnricher;
use App\Services\Music\MusicBrainz;
use App\Services\Spotify\SpotifyClient;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class MusicController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'trashed' => ['nullable', 'boolean'],
        ]);

        $tracks = Track::query()
            ->with('user')
            ->when($filters['trashed'] ?? false, fn (Builder $q) => $q->onlyTrashed())
            ->search($filters['q'] ?? null)
            ->latest('id')
            ->paginate(30)
            ->withQueryString()
            ->through(fn (Track $t) => [
                ...$t->toCard(),
                'size' => $t->size,
                'adds_count' => $t->adds_count,
                'user' => $t->user?->toCard(),
                'created_at' => $t->created_at->toIso8601String(),
                'deleted_at' => $t->deleted_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/music', [
            'tracks' => $tracks,
            'filters' => ['q' => $filters['q'] ?? '', 'trashed' => (bool) ($filters['trashed'] ?? false)],
            'stats' => [
                'tracks' => Track::query()->count(),
                'plays' => (int) Track::query()->sum('plays_count'),
                'size' => (int) Track::query()->sum('size'),
                'playlists' => Playlist::query()->count(),
                'spotify' => SpotifyAccount::query()->count(),
                'trashed' => Track::onlyTrashed()->count(),
            ],
            'metadata' => $this->metadataStatus(),
        ]);
    }

    /**
     * «Музичні метадані»: що з інструментів і джерел доступне на сервері, скільки треків ще не оброблено.
     *
     * @return array<string, mixed>
     */
    private function metadataStatus(): array
    {
        $probe = app(AudioProbe::class);
        $online = app(MetadataEnricher::class)->online();
        // status: ok — працює, missing — немає (потрібно встановити чи додати ключ), public — відкрите джерело без ключа.
        $row = fn (string $key, string $label, string $status, string $hint) => compact('key', 'label', 'status', 'hint');
        $public = $online ? 'public' : 'missing';

        return [
            'online' => $online,
            'pending' => Track::query()->whereNull('enriched_at')->count(),
            'enriched' => Track::query()->whereNotNull('enriched_at')->count(),
            'recognized' => Track::query()->whereNotNull('mbid')->count(),
            'sources' => [
                $row('ffprobe', 'ffprobe / ffmpeg', $probe->available() ? 'ok' : 'missing', $probe->available() ? 'Розбір кодеків, копії AAC для браузера' : ($probe->ffprobeAvailable() ? 'Є лише ffprobe — без копій AAC' : 'sudo apt-get install ffmpeg')),
                $row('getid3', 'getID3', $probe->id3Available() ? 'ok' : 'missing', 'Запасний розбір тегів і якості без ffprobe'),
                $row('fpcalc', 'Chromaprint (fpcalc)', $probe->fpcalc() !== null ? 'ok' : 'missing', $probe->fpcalc() !== null ? 'Відбиток звуку для AcoustID' : 'sudo apt-get install libchromaprint-tools'),
                $row('acoustid', 'AcoustID', app(AcoustId::class)->configured() ? 'ok' : 'missing', 'Ключ — Адмінка → Інтеграції'),
                $row('spotify', 'Spotify', app(SpotifyClient::class)->configured() ? 'ok' : 'missing', 'Client ID і Secret — Адмінка → Інтеграції'),
                $row('discogs', 'Discogs', app(Discogs::class)->configured() ? 'ok' : 'missing', 'Токен — Адмінка → Інтеграції'),
                $row('lastfm', 'Last.fm', app(LastFm::class)->configured() ? 'ok' : 'missing', 'Ключ — Адмінка → Інтеграції'),
                $row('musicbrainz', 'MusicBrainz', $public, 'Відкритий каталог, 1 запит/с'),
                $row('coverartarchive', 'Cover Art Archive', $public, 'Обкладинки релізів MusicBrainz'),
                $row('lrclib', 'LRCLIB', $public, 'Тексти пісень із часом рядків'),
            ],
        ];
    }

    /**
     * «Перевірити зараз»: справжній запит до кожного джерела — чи відповідає, за скільки мс і що не так.
     * «Готово» в списку означає лише «ключ збережено»; ця перевірка показує, чи ключ і сервіс справді працюють.
     */
    public function checkMetadata(Request $request): JsonResponse
    {
        $ua = ['User-Agent' => MusicBrainz::USER_AGENT];
        $http = fn () => Http::timeout(8)->acceptJson()->withHeaders($ua);
        $results = [];
        $run = function (string $key, callable $check) use (&$results) {
            $started = microtime(true);
            try {
                [$ok, $message] = $check();
            } catch (Throwable $e) {
                [$ok, $message] = [false, Str::limit($e->getMessage(), 120)];
            }
            $results[$key] = ['ok' => $ok, 'ms' => (int) round((microtime(true) - $started) * 1000), 'message' => $message];
        };

        $release = null;
        $run('musicbrainz', function () use ($http, &$release) {
            $response = $http()->get('https://musicbrainz.org/ws/2/recording', ['query' => 'recording:"Yesterday" AND artist:"The Beatles"', 'limit' => 1, 'fmt' => 'json']);
            $release = $response->json('recordings.0.releases.0.id');

            return [$response->ok() && $response->json('count') > 0, $response->ok() ? 'Знайдено «Yesterday» — The Beatles' : 'HTTP '.$response->status()];
        });
        $run('coverartarchive', function () use ($http, $release) {
            if (! is_string($release)) {
                return [false, 'Немає релізу для перевірки (MusicBrainz не відповів)'];
            }
            $response = $http()->withOptions(['allow_redirects' => false])->get('https://coverartarchive.org/release/'.$release);
            // 404 — у релізу немає обкладинки, але сервіс відповів; збій — лише 5xx чи тайм-аут.
            $ok = $response->status() < 500;

            return [$ok, $ok ? 'Сервіс відповідає (HTTP '.$response->status().')' : 'HTTP '.$response->status()];
        });
        $run('lrclib', function () use ($http) {
            $response = $http()->get('https://lrclib.net/api/search', ['track_name' => 'Yesterday', 'artist_name' => 'The Beatles']);
            $found = count((array) $response->json());

            return [$response->ok(), $response->ok() ? "Знайдено текстів: {$found}" : 'HTTP '.$response->status()];
        });
        $keyed = [
            'acoustid' => app(AcoustId::class),
            'discogs' => app(Discogs::class),
            'lastfm' => app(LastFm::class),
        ];
        foreach ($keyed as $key => $service) {
            $run($key, fn () => ! $service->configured() ? [false, 'Ключ не додано — Адмінка → Інтеграції']
                : ($service->test() ? [true, 'Ключ дійсний'] : [false, 'Ключ відхилено або сервіс недоступний']));
        }
        $spotify = app(SpotifyClient::class);
        $run('spotify', fn () => ! $spotify->configured() ? [false, 'Ключі не додано — Адмінка → Інтеграції']
            : ($spotify->testCredentials() ? [true, 'Ключі дійсні'] : [false, 'Ключі відхилено']));

        Log::info('music: metadata sources checked', ['by' => $request->user()->id, 'failed' => array_keys(array_filter($results, fn ($r) => ! $r['ok']))]);

        return response()->json(['results' => $results]);
    }

    /** «Оновити метадані»: у чергу — треки, які ще не збагачувались (з all — усі). */
    public function enrich(Request $request, MetadataEnricher $enricher): RedirectResponse
    {
        if (! $enricher->online()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => 'Зовнішні запити метаданих вимкнено на сервері (MUSIC_METADATA=false).']);

            return back();
        }
        $all = $request->boolean('all');
        $count = EnrichTrackMetadata::dispatchPending($all);
        Log::info('music: metadata refresh', ['tracks' => $count, 'all' => $all, 'by' => $request->user()->id]);

        Inertia::flash('toast', ['type' => 'success', 'message' => $count > 0
            ? "Метадані оновлюються у фоні: {$count} треків."
            : 'Усі треки вже оброблено.']);

        return back();
    }

    public function destroy(int $track): RedirectResponse
    {
        $model = Track::withTrashed()->findOrFail($track);

        if ($model->trashed()) {
            Storage::disk('public')->delete(array_filter([$model->path, $model->cover_path]));
            $model->forceDelete();
            $message = 'Трек видалено назавжди.';
        } else {
            $model->delete();
            $message = 'Трек переміщено в кошик.';
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }

    public function restore(int $track): RedirectResponse
    {
        Track::onlyTrashed()->findOrFail($track)->restore();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Трек відновлено.']);

        return back();
    }
}
