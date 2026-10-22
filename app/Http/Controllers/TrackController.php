<?php

namespace App\Http\Controllers;

use App\Models\Track;
use App\Services\Music\AudioProbe;
use App\Services\Music\LyricsFinder;
use App\Services\MusicService;
use App\Support\Plugins\Plugins;
use App\Support\Settings\SiteSettings;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TrackController extends Controller
{
    public function __construct(private readonly MusicService $music) {}

    public function store(Request $request, SiteSettings $settings, AudioProbe $probe): JsonResponse
    {
        $formats = Track::uploadFormats();
        $data = $request->validate([
            'audio' => ['required', 'file', 'max:'.(int) $settings->get('music_max_track_mb') * 1024, function (string $attribute, mixed $file, Closure $fail) use ($probe, $formats) {
                if (! $this->acceptsAudio($file, $probe)) {
                    $fail('Підтримуються аудіофайли: '.implode(', ', $formats).'.');
                }
            }],
            'cover' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'cover_url' => ['nullable', 'url:https', 'max:500'],
            'title' => ['required', 'string', 'max:150'],
            'artist' => ['required', 'string', 'max:150'],
            'album' => ['nullable', 'string', 'max:150'],
            'genre' => ['nullable', 'string', 'max:40'],
            'duration' => ['nullable', 'integer', 'min:0', 'max:7200'],
        ], [
            'audio.max' => 'Файл завеликий (максимум '.(int) $settings->get('music_max_track_mb').' МБ).',
        ]);

        $track = $this->music->upload($request->user(), $request->file('audio'), $data, $request->file('cover'));

        return response()->json(['track' => $track->toCard(true)], 201);
    }

    /**
     * Формат за вмістом файлу (як правило mimes) — для «рідних» форматів; решту (AIFF, APE, WMA…)
     * за вмістом не розпізнати, тому їх приймаємо лише тоді, коли ffprobe бачить у файлі звук.
     */
    private function acceptsAudio(mixed $file, AudioProbe $probe): bool
    {
        if (! $file instanceof UploadedFile || ! $file->isValid() || $file->getPath() === '') {
            return false;
        }
        if (in_array($file->guessExtension(), Track::AUDIO_MIMES, true)) {
            return true;
        }
        $extension = strtolower($file->getClientOriginalExtension());

        return in_array($extension, Track::FFMPEG_MIMES, true) && $probe->available() && $probe->probe($file->getRealPath() ?: $file->getPathname()) !== null;
    }

    public function update(Request $request, Track $track): JsonResponse
    {
        abort_unless($this->music->canManageTrack($track, $request->user()), 403);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'artist' => ['required', 'string', 'max:150'],
            'album' => ['nullable', 'string', 'max:150'],
            'genre' => ['nullable', 'string', 'max:40'],
            'lyrics' => ['nullable', 'string', 'max:8000'],
            'cover' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'cover_url' => ['nullable', 'url:https', 'max:500'],
        ], [
            'cover.image' => 'Обкладинка має бути картинкою (JPG, PNG або WebP).',
            'cover.mimes' => 'Обкладинка має бути картинкою (JPG, PNG або WebP).',
            'cover.max' => 'Обкладинка завелика (максимум 5 МБ).',
        ]);
        $coverUrl = $data['cover_url'] ?? null;
        unset($data['cover_url'], $data['cover']);
        if (! app(Plugins::class)->on('lyrics')) {
            unset($data['lyrics']);
        }
        $track->fill(array_map(fn ($v) => is_string($v) ? (trim($v) ?: null) : $v, $data));
        // Змінене вручну (зокрема очищене) — тепер «від користувача»: автоматика його не чіпає.
        $track->markUserFields(array_keys($track->getDirty()));
        $track->save();

        // Обкладинка з файлу (вікно редагування) або з автозаповнення (каталог iTunes);
        // стару видаляємо лише після успішного збереження нової. Файл — POST з _method=PATCH.
        $file = $request->file('cover');
        $cover = $file !== null ? $this->music->storeCover($file)
            : (filled($coverUrl) ? $this->music->coverFromUrl((string) $coverUrl) : null);
        if ($cover !== null) {
            $old = $track->cover_path;
            $track->markUserFields(['cover']);
            $track->update(['cover_path' => $cover]);
            if ($old) {
                Storage::disk('public')->delete($old);
            }
        }

        return response()->json(['track' => $track->toCard(true)]);
    }

    public function lyrics(Track $track): JsonResponse
    {
        app(Plugins::class)->ensure('lyrics');

        // Немає свого тексту — шукаємо у відкритому каталозі й зберігаємо в трек (лише додаємо).
        if (blank($track->lyrics) && ($found = app(LyricsFinder::class)->find($track->artist, $track->title, $track->album, $track->duration ?: null))) {
            $track->forceFill(['lyrics' => $found, 'metadata_meta' => [...($track->metadata_meta ?? []), 'lyrics' => ['source' => 'lrclib', 'score' => 50]]])->saveQuietly();
        }

        return response()->json(['lyrics' => $track->lyrics]);
    }

    /** Текст для пісні не з нашого каталогу (Spotify): за виконавцем, назвою й тривалістю. */
    public function findLyrics(Request $request, LyricsFinder $finder): JsonResponse
    {
        app(Plugins::class)->ensure('lyrics');
        $data = $request->validate([
            'artist' => ['required', 'string', 'max:200'],
            'title' => ['required', 'string', 'max:200'],
            'album' => ['nullable', 'string', 'max:200'],
            'duration' => ['nullable', 'integer', 'min:0', 'max:7200'],
        ]);

        return response()->json(['lyrics' => $finder->find($data['artist'], $data['title'], $data['album'] ?? null, $data['duration'] ?? null)]);
    }

    public function destroy(Request $request, Track $track): JsonResponse
    {
        $user = $request->user();

        if (! $this->music->canManageTrack($track, $user)) {
            $this->music->remove($user, $track);

            return response()->json(['removed' => true]);
        }

        $track->delete();

        return response()->json(['deleted' => true]);
    }

    public function add(Request $request, Track $track): JsonResponse
    {
        $this->music->add($request->user(), $track);

        return response()->json(['in_library' => true]);
    }

    public function remove(Request $request, Track $track): JsonResponse
    {
        $this->music->remove($request->user(), $track);

        return response()->json(['in_library' => false]);
    }

    public function download(Track $track): StreamedResponse
    {
        $name = trim($track->artist.' - '.$track->title).'.'.pathinfo($track->path, PATHINFO_EXTENSION);

        return Storage::disk('public')->download($track->path, $name);
    }
}
