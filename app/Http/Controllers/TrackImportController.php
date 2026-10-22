<?php

namespace App\Http\Controllers;

use App\Jobs\ImportTrackFromUrl;
use App\Models\TrackImport;
use App\Services\Music\ImportFailed;
use App\Services\Music\ShareLinks;
use App\Support\Net\PublicUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * «Завантажити за посиланням»: пряме посилання на аудіофайл або файл Google Диска, Dropbox чи OneDrive.
 * Сам файл завантажує задача ImportTrackFromUrl; тут — перевірка посилання, черга й список завантажень.
 */
class TrackImportController extends Controller
{
    /** Скільки завантажень за посиланням може тривати одночасно в одного користувача. */
    public const MAX_ACTIVE = 3;

    /** Скільки останніх завантажень показуємо. */
    public const RECENT = 20;

    public function index(Request $request): JsonResponse
    {
        $userId = (int) $request->user()->id;
        TrackImport::expireStale($userId);

        $imports = TrackImport::query()->where('user_id', $userId)->with('track')
            ->latest('id')->limit(self::RECENT)->get();

        return response()->json(['imports' => $imports->map(fn (TrackImport $import) => $import->toCard())->values()]);
    }

    public function store(Request $request, ShareLinks $links, PublicUrl $net): JsonResponse
    {
        $data = $request->validate([
            'url' => ['required', 'string', 'max:2000', 'url:http,https'],
            'title' => ['nullable', 'string', 'max:150'],
            'artist' => ['nullable', 'string', 'max:150'],
            'album' => ['nullable', 'string', 'max:150'],
            'genre' => ['nullable', 'string', 'max:40'],
        ], [
            'url.required' => 'Вставте посилання на файл.',
            'url.url' => 'Потрібне посилання http або https.',
            'url.max' => 'Посилання задовге.',
        ]);
        $url = trim((string) $data['url']);

        if (($rejection = $links->rejection($url)) !== null) {
            throw ValidationException::withMessages(['url' => $rejection]);
        }
        $reason = $net->inspect($url)['reason'];
        if ($reason !== null) {
            throw ValidationException::withMessages(['url' => ImportFailed::address($reason)]);
        }

        $userId = (int) $request->user()->id;
        TrackImport::expireStale($userId);
        $active = TrackImport::query()->where('user_id', $userId)->whereIn('status', TrackImport::ACTIVE)->count();
        if ($active >= self::MAX_ACTIVE) {
            throw ValidationException::withMessages([
                'url' => 'Одночасно можна завантажувати до '.self::MAX_ACTIVE.' файлів — зачекайте, доки завершаться попередні.',
            ]);
        }

        $hints = array_filter(
            array_map(fn ($value) => is_string($value) ? trim($value) : null, array_intersect_key($data, array_flip(['title', 'artist', 'album', 'genre']))),
            fn (?string $value) => $value !== null && $value !== '',
        );
        $import = TrackImport::query()->create([
            'user_id' => $userId,
            'url' => $url,
            'host' => ShareLinks::host($url),
            'hints' => $hints !== [] ? $hints : null,
            'status' => TrackImport::PENDING,
        ]);
        ImportTrackFromUrl::dispatch($import->id);

        return response()->json(['import' => $import->refresh()->load('track')->toCard()], 202);
    }

    public function destroy(Request $request, TrackImport $import): JsonResponse
    {
        abort_unless((int) $import->user_id === (int) $request->user()->id, 404);
        if ($import->isActive()) {
            throw ValidationException::withMessages(['import' => 'Завантаження ще триває — зачекайте, доки воно завершиться.']);
        }
        // Лише запис про завантаження — сам трек лишається в медіатеці.
        $import->delete();

        return response()->json(['ok' => true]);
    }
}
