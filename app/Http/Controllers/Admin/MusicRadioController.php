<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\RadioStation;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Psr\Http\Message\UriInterface;
use RuntimeException;

/**
 * Інтернет-радіо для вкладки «Радіо»: станції з потоком https, логотипом і жанром.
 * Кожна дія пишеться в журнал (`music: …`, хто зробив — `by`).
 */
class MusicRadioController extends Controller
{
    public function stations(): Response
    {
        $stations = RadioStation::query()->orderBy('position')->orderBy('id')->get();

        return Inertia::render('admin/music-radio', [
            'stations' => $stations->map(fn (RadioStation $s) => [
                'id' => $s->id,
                'name' => $s->name,
                'slug' => $s->slug,
                'tagline' => $s->tagline,
                'stream_url' => $s->stream_url,
                'homepage' => $s->homepage,
                'logo_url' => $s->logo_url,
                'logo_external' => str_starts_with((string) $s->logo_path, 'https://'),
                'genre' => $s->genre,
                'country' => $s->country,
                'is_active' => $s->is_active,
                'position' => $s->position,
            ])->values()->all(),
            'genres' => $stations->pluck('genre')->filter()->unique()->sort()->values()->all(),
            'stats' => [
                'total' => $stations->count(),
                'active' => $stations->where('is_active', true)->count(),
            ],
        ]);
    }

    public function storeStation(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $base = Str::slug(Str::transliterate($data['name'])) ?: 'station';
        $slug = Str::limit($base, 80, '');
        for ($i = 2; RadioStation::query()->where('slug', $slug)->exists(); $i++) {
            $slug = Str::limit($base, 80, '').'-'.$i;
        }

        $station = RadioStation::query()->create([
            ...$this->attributes($data),
            'slug' => $slug,
            'logo_path' => $this->logo($request, $data, null),
            'is_active' => $data['is_active'] ?? true,
            'position' => (int) RadioStation::query()->max('position') + 1,
        ]);

        Log::info('music: radio station created', ['station' => $station->id, 'name' => $station->name, 'by' => $request->user()?->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Станцію «{$station->name}» додано."]);

        return back();
    }

    public function updateStation(Request $request, RadioStation $station): RedirectResponse
    {
        $data = $this->validated($request);
        $station->update([
            ...$this->attributes($data),
            'logo_path' => $this->logo($request, $data, $station->logo_path),
            'is_active' => $data['is_active'] ?? $station->is_active,
        ]);

        Log::info('music: radio station updated', ['station' => $station->id, 'changes' => array_keys($station->getChanges()), 'by' => $request->user()?->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Станцію збережено.']);

        return back();
    }

    /** Увімкнути/вимкнути станцію або пересунути її вище чи нижче у списку. */
    public function flagStation(Request $request, RadioStation $station): RedirectResponse
    {
        $data = $request->validate([
            'is_active' => ['sometimes', 'boolean'],
            'move' => ['sometimes', Rule::in(['up', 'down'])],
        ]);

        if (isset($data['move'])) {
            $this->move($station, $data['move']);
        }
        if (array_key_exists('is_active', $data)) {
            $station->update(['is_active' => (bool) $data['is_active']]);
        }

        Log::info('music: radio station flags', ['station' => $station->id, ...$data, 'by' => $request->user()?->id]);

        return back();
    }

    public function destroyStation(Request $request, RadioStation $station): RedirectResponse
    {
        $this->forgetLogo($station->logo_path);
        $station->delete();

        Log::info('music: radio station deleted', ['station' => $station->id, 'name' => $station->name, 'by' => $request->user()?->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Станцію «{$station->name}» видалено."]);

        return back();
    }

    /**
     * «Перевірити потік»: короткий запит до адреси (лише заголовки, тіло не читаємо) — код відповіді
     * й тип вмісту. Ходимо лише на публічні адреси https, переадресації — теж лише https.
     */
    public function probeStation(Request $request, RadioStation $station): RedirectResponse
    {
        $result = $this->probe($station->stream_url);

        Log::info('music: radio stream checked', ['station' => $station->id, 'ok' => $result['ok'], 'by' => $request->user()?->id]);
        Inertia::flash('toast', ['type' => $result['ok'] ? 'success' : 'error', 'message' => $result['message']]);

        return back();
    }

    /**
     * @return array{ok: bool, message: string}
     */
    private function probe(string $url): array
    {
        if (! $this->publicHttps($url)) {
            return ['ok' => false, 'message' => 'Адреса потоку недоступна: потрібна публічна адреса https.'];
        }

        try {
            $response = Http::withOptions([
                'stream' => true,
                'allow_redirects' => [
                    'max' => 3,
                    'protocols' => ['https'],
                    'on_redirect' => function ($request, $response, UriInterface $uri): void {
                        if (! $this->publicHttps((string) $uri)) {
                            throw new RuntimeException('redirect');
                        }
                    },
                ],
            ])->withHeaders(['Icy-MetaData' => '0'])->connectTimeout(4)->timeout(6)->get($url);
        } catch (ConnectionException|RuntimeException) {
            return ['ok' => false, 'message' => 'Потік не відповів за 6 секунд або переадресував на недозволену адресу.'];
        }

        $type = strtolower(trim(explode(';', $response->header('Content-Type'))[0]));
        $status = $response->status();
        $response->toPsrResponse()->getBody()->close();

        if (! $response->successful()) {
            return ['ok' => false, 'message' => "Потік відповів кодом {$status}."];
        }
        $audio = str_starts_with($type, 'audio/') || in_array($type, ['application/ogg', 'application/vnd.apple.mpegurl', 'application/x-mpegurl'], true);

        return $audio
            ? ['ok' => true, 'message' => "Потік працює: {$status}, {$type}."]
            : ['ok' => false, 'message' => 'Відповідь '.$status.', але це не аудіо ('.($type ?: 'тип невідомий').').'];
    }

    /** Публічна адреса https (не localhost і не внутрішня мережа). */
    private function publicHttps(string $url): bool
    {
        $parts = parse_url($url);
        $host = strtolower((string) ($parts['host'] ?? ''));
        if (($parts['scheme'] ?? '') !== 'https' || $host === '' || isset($parts['user'])
            || $host === 'localhost' || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) {
            return false;
        }
        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);

        return $ips !== [] && collect($ips)->every(
            fn (string $ip) => filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false,
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'tagline' => ['nullable', 'string', 'max:160'],
            'stream_url' => ['required', 'string', 'max:500', 'url:https'],
            'homepage' => ['nullable', 'string', 'max:300', 'url:https,http'],
            'genre' => ['nullable', 'string', 'max:40'],
            'country' => ['nullable', 'string', 'size:2', 'alpha'],
            'is_active' => ['sometimes', 'boolean'],
            'logo' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
            'logo_url' => ['nullable', 'string', 'max:255', 'url:https'],
            'remove_logo' => ['sometimes', 'boolean'],
        ], [
            'stream_url.url' => 'Потрібна адреса потоку https://',
            'logo_url.url' => 'Логотип — лише за адресою https://',
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function attributes(array $data): array
    {
        return [
            'name' => trim((string) $data['name']),
            'tagline' => filled($data['tagline'] ?? null) ? trim((string) $data['tagline']) : null,
            'stream_url' => trim((string) $data['stream_url']),
            'homepage' => filled($data['homepage'] ?? null) ? trim((string) $data['homepage']) : null,
            'genre' => filled($data['genre'] ?? null) ? trim((string) $data['genre']) : null,
            'country' => filled($data['country'] ?? null) ? strtoupper((string) $data['country']) : null,
        ];
    }

    /**
     * Логотип: завантажений файл, адреса https або попередній. Старий файл з диска прибираємо.
     *
     * @param  array<string, mixed>  $data
     */
    private function logo(Request $request, array $data, ?string $current): ?string
    {
        $file = $request->file('logo');
        if ($file instanceof UploadedFile) {
            $this->forgetLogo($current);

            return $file->store('radio', 'public') ?: null;
        }
        if (filled($data['logo_url'] ?? null)) {
            if ($data['logo_url'] !== $current) {
                $this->forgetLogo($current);
            }

            return (string) $data['logo_url'];
        }
        if ($request->boolean('remove_logo')) {
            $this->forgetLogo($current);

            return null;
        }

        return $current;
    }

    private function forgetLogo(?string $path): void
    {
        if ($path !== null && ! str_starts_with($path, 'https://')) {
            Storage::disk('public')->delete($path);
        }
    }

    private function move(RadioStation $station, string $direction): void
    {
        $ordered = RadioStation::query()->orderBy('position')->orderBy('id')->get()->values();
        $index = $ordered->search(fn (RadioStation $s) => $s->is($station));
        if ($index === false) {
            return;
        }
        $swap = $direction === 'up' ? $index - 1 : $index + 1;
        if (! isset($ordered[$swap])) {
            return;
        }

        $ordered->each(fn (RadioStation $s, int $i) => $s->position = $i);
        [$ordered[$index]->position, $ordered[$swap]->position] = [$ordered[$swap]->position, $ordered[$index]->position];
        $ordered->each->save();
    }
}
