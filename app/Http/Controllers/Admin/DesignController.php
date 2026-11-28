<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SiteTheme;
use App\Models\VideoBackground;
use App\Services\Design\SiteThemes;
use App\Services\ImageStorage;
use App\Support\AppFiles;
use App\Support\AuthImages;
use App\Support\Backgrounds;
use App\Support\Seasons;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Адмінка → Дизайн: стилі сайту. Завантажити CSS (новий стиль чи нову версію), увімкнути для всіх,
 * переглянути в себе, повернути стандартний вигляд, видалити. Кожна дія пишеться в журнал (design: …).
 */
class DesignController extends Controller
{
    public function __construct(private readonly SiteThemes $themes) {}

    public function index(): Response
    {
        return Inertia::render('admin/design', [
            'themes' => SiteTheme::query()->with('uploader:id,name')->latest('updated_at')->get()
                ->map(fn (SiteTheme $theme) => [
                    'id' => $theme->id,
                    'name' => $theme->name,
                    'description' => $theme->description,
                    'author' => $theme->author,
                    'url' => $theme->url(),
                    'size' => $theme->size,
                    'version' => $theme->version,
                    'is_active' => $theme->is_active,
                    'uploaded_by' => $theme->uploader?->name,
                    'updated_at' => $theme->updated_at->toIso8601String(),
                ]),
            'limits' => ['max_kb' => intdiv(SiteThemes::MAX_BYTES, 1024)],
            'seasonal' => app(Seasons::class)->setting(),
            'seasons' => Seasons::ALL,
            'background' => Backgrounds::image(),
            'videos' => VideoBackground::query()->orderBy('position')->orderBy('id')->get()
                ->map(fn (VideoBackground $video) => [...$video->card(), 'is_active' => $video->is_active]),
            'authImages' => AuthImages::urls(),
            // Разом зі старим посиланням Google Play із загальних налаштувань (якщо нове ще не задане).
            'appLinks' => (object) app(SiteSettings::class)->appLinks(),
            'appFiles' => (object) AppFiles::all(),
            'appFileTypes' => AppFiles::PLATFORMS,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request, true);
        $theme = $this->themes->save((string) $request->file('file')->get(), $data, $request->user());
        if ($request->boolean('activate')) {
            $this->themes->activate($theme);
        }
        Log::info('design: theme uploaded', ['theme' => $theme->id, 'active' => $theme->fresh()?->is_active, 'by' => $request->user()->id]);

        Inertia::flash('toast', ['type' => 'success', 'message' => $request->boolean('activate')
            ? 'Стиль «'.$theme->name.'» завантажено й увімкнено для всього сайту.'
            : 'Стиль «'.$theme->name.'» завантажено. Перегляньте його, перш ніж вмикати.']);

        return back();
    }

    /** Назва й опис; з файлом — нова версія стилю. */
    public function update(Request $request, SiteTheme $theme): RedirectResponse
    {
        $data = $this->validated($request, false);
        if ($request->hasFile('file')) {
            $this->themes->save((string) $request->file('file')->get(), $data, $request->user(), $theme);
        } else {
            $theme->update($data);
        }
        Log::info('design: theme updated', ['theme' => $theme->id, 'version' => $theme->version, 'by' => $request->user()->id]);

        Inertia::flash('toast', ['type' => 'success', 'message' => $request->hasFile('file')
            ? 'Нову версію стилю завантажено (v'.$theme->version.').'
            : 'Стиль оновлено.']);

        return back();
    }

    public function activate(Request $request, SiteTheme $theme): RedirectResponse
    {
        $this->themes->activate($theme);
        Log::info('design: theme activated', ['theme' => $theme->id, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Стиль «'.$theme->name.'» тепер бачать усі. Відкриті сторінки зміняться після оновлення.']);

        return back();
    }

    /** Повернути стандартний вигляд сайту (жоден стиль не активний). */
    public function reset(Request $request): RedirectResponse
    {
        $this->themes->activate(null);
        Log::info('design: default look restored', ['by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Повернуто стандартний вигляд сайту.']);

        return back();
    }

    public function destroy(Request $request, SiteTheme $theme): RedirectResponse
    {
        $this->themes->delete($theme);
        Log::info('design: theme deleted', ['theme' => $theme->id, 'name' => $theme->name, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => $theme->is_active
            ? 'Стиль видалено, сайт повернувся до стандартного вигляду.'
            : 'Стиль видалено.']);

        return back();
    }

    /** Посилання на застосунок у магазинах; порожнє поле — кнопки магазину на сайті не видно. */
    public function appLinks(Request $request): RedirectResponse
    {
        $rules = [];
        foreach (SiteSettings::APP_STORES as $store) {
            $rules[$store] = ['nullable', 'string', 'max:500', 'regex:#\Ahttps://[^\s<>"]+\z#i'];
        }
        $data = $request->validate($rules, ['regex' => 'Посилання має починатися з https://']);
        $links = array_filter(array_map(fn ($v) => is_string($v) ? trim($v) : null, $data));
        // Посилання Google Play тепер лише тут: старе налаштування вимикаємо, щоб не підставлялося.
        app(SiteSettings::class)->put(['app_links' => $links, 'play_store_enabled' => false]);
        Log::info('design: app store links', ['stores' => array_keys($links), 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Посилання на застосунок збережено.']);

        return back();
    }

    /**
     * Частина файлу застосунку для прямого завантаження (APK, Windows, macOS, Linux). Файл іде частинами
     * по 4 МБ; коли прийшла остання — сервер складає його, перевіряє й публікує замість посилання.
     */
    public function appFileChunk(Request $request, string $platform): JsonResponse
    {
        $maxParts = (int) ceil(AppFiles::MAX_BYTES / AppFiles::CHUNK_BYTES);
        $data = $request->validate([
            'upload_id' => ['required', 'uuid'],
            'index' => ['required', 'integer', 'min:0'],
            'total' => ['required', 'integer', 'min:1', 'max:'.$maxParts],
            'name' => ['required', 'string', 'max:200'],
            'chunk' => ['required', 'file', 'max:'.intdiv(AppFiles::CHUNK_BYTES, 1024) + 64],
        ], ['total.max' => 'Файл більший за 1 ГБ.']);
        $name = (string) $data['name'];
        if (! AppFiles::allowed($platform, $name)) {
            throw ValidationException::withMessages(['name' => 'Для цієї платформи підходять файли: '.implode(', ', AppFiles::PLATFORMS[$platform]).'.']);
        }
        $index = (int) $data['index'];
        $total = (int) $data['total'];
        if ($index >= $total) {
            throw ValidationException::withMessages(['index' => 'Неправильний номер частини.']);
        }

        $chunk = $request->file('chunk');
        if (! $chunk instanceof UploadedFile) {
            throw ValidationException::withMessages(['chunk' => 'Частина файлу не дійшла.']);
        }

        try {
            $file = AppFiles::receive($platform, (string) $data['upload_id'], $index, $total, $name, $chunk);
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['chunk' => $e->getMessage()]);
        }
        if ($file === null) {
            return response()->json(['done' => false]);
        }
        Log::info('design: app file uploaded', ['platform' => $platform, 'name' => $file['name'], 'size' => $file['size'], 'sha256' => $file['sha256'], 'by' => $request->user()->id]);

        return response()->json(['done' => true, 'file' => $file]);
    }

    public function deleteAppFile(Request $request, string $platform): RedirectResponse
    {
        AppFiles::delete($platform);
        Log::info('design: app file deleted', ['platform' => $platform, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Файл видалено.']);

        return back();
    }

    /** Сезонні прикраси: автоматично за датою, вимкнено або показати потрібний сезон уже зараз. */
    public function seasonal(Request $request): RedirectResponse
    {
        $data = $request->validate(['seasonal' => ['required', 'string', 'in:'.implode(',', ['auto', 'off', ...Seasons::ALL])]]);
        app(SiteSettings::class)->put([Seasons::SETTING => $data['seasonal']]);
        Log::info('design: seasonal decorations', ['value' => $data['seasonal'], 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Сезонні прикраси збережено.']);

        return back();
    }

    /**
     * Фірмовий фон: картинка для комп'ютера та/або для телефона, і чи показувати її всім за замовчуванням.
     * Нова картинка замінює стару того ж формату (стару видаляємо з диска).
     */
    public function background(Request $request, ImageStorage $images): RedirectResponse
    {
        $image = ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:12288', 'dimensions:min_width=600,min_height=600'];
        $data = $request->validate([
            'desktop' => $image,
            'mobile' => $image,
            'default' => ['sometimes', 'boolean'],
        ]);
        $stored = Backgrounds::stored();
        foreach (['desktop', 'mobile'] as $kind) {
            $file = $request->file($kind);
            if ($file !== null) {
                $path = $images->store($file, 'backgrounds', $kind === 'desktop' ? 3200 : 2400)['path'];
                $images->delete($stored[$kind]);
                $stored[$kind] = $path;
            }
        }
        if (array_key_exists('default', $data)) {
            $stored['default'] = (bool) $data['default'];
        }
        app(SiteSettings::class)->put([Backgrounds::SETTING => $stored]);
        Log::info('design: background updated', ['desktop' => $request->hasFile('desktop'), 'mobile' => $request->hasFile('mobile'), 'default' => $stored['default'], 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Фон сайту збережено.']);

        return back();
    }

    /** Прибрати картинку фону для комп'ютера чи для телефона. */
    public function deleteBackground(Request $request, ImageStorage $images, string $kind): RedirectResponse
    {
        $stored = Backgrounds::stored();
        $kind = $kind === 'mobile' ? 'mobile' : 'desktop';
        $images->delete($stored[$kind]);
        $stored[$kind] = null;
        if ($stored['desktop'] === null && $stored['mobile'] === null) {
            $stored['default'] = false;
        }
        app(SiteSettings::class)->put([Backgrounds::SETTING => $stored]);
        Log::info('design: background removed', ['kind' => $kind, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Картинку фону видалено.']);

        return back();
    }

    /**
     * Новий відеофон для учасників GameCon+: файл для смартфона (вертикальний) та/або для ПК і планшета,
     * обкладинка — для слабких пристроїв і режиму без руху.
     */
    public function storeVideo(Request $request): RedirectResponse
    {
        $video = ['nullable', 'file', 'mimetypes:video/mp4,video/webm', 'max:'.(60 * 1024)];
        $data = $request->validate([
            'title' => ['required', 'string', 'max:60'],
            'mobile' => $video,
            'desktop' => $video,
            'poster' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);
        if (! $request->hasFile('mobile') && ! $request->hasFile('desktop')) {
            throw ValidationException::withMessages(['mobile' => 'Додайте відео для смартфона або для ПК/планшета.']);
        }
        $paths = [];
        foreach (['mobile', 'desktop', 'poster'] as $kind) {
            $file = $request->file($kind);
            $paths[$kind.'_path'] = $file instanceof UploadedFile ? $file->store('backgrounds/videos', 'public') : null;
        }
        $created = VideoBackground::create([
            'title' => $data['title'],
            ...$paths,
            'position' => (int) VideoBackground::query()->max('position') + 1,
            'created_by' => $request->user()->id,
        ]);
        Backgrounds::forgetVideos();
        Log::info('design: video background added', ['id' => $created->id, 'title' => $created->title, 'mobile' => $paths['mobile_path'] !== null, 'desktop' => $paths['desktop_path'] !== null, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Відеофон додано.']);

        return back();
    }

    /** Показати чи сховати відеофон у виборі (вибір людей зберігається, поки фон знову не ввімкнуть). */
    public function toggleVideo(Request $request, VideoBackground $video): RedirectResponse
    {
        $video->update(['is_active' => ! $video->is_active]);
        Backgrounds::forgetVideos();
        Log::info('design: video background toggled', ['id' => $video->id, 'active' => $video->is_active, 'by' => $request->user()->id]);

        return back();
    }

    public function destroyVideo(Request $request, VideoBackground $video): RedirectResponse
    {
        Storage::disk('public')->delete(array_values(array_filter([$video->mobile_path, $video->desktop_path, $video->poster_path])));
        $video->delete();
        Backgrounds::forgetVideos();
        Log::info('design: video background deleted', ['id' => $video->id, 'title' => $video->title, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Відеофон видалено.']);

        return back();
    }

    /** Фони входу й реєстрації: сайт (комп'ютер/планшет, телефон) і застосунок (телефон, планшет). */
    public function authImages(Request $request, ImageStorage $images): RedirectResponse
    {
        $rules = [];
        foreach (array_keys(AuthImages::KINDS) as $kind) {
            $rules[$kind] = ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:12288', 'dimensions:min_width=600,min_height=600'];
        }
        $request->validate($rules);
        $stored = AuthImages::stored();
        $changed = [];
        foreach (AuthImages::KINDS as $kind => $size) {
            $file = $request->file($kind);
            if ($file !== null) {
                $path = $images->store($file, 'auth', $size)['path'];
                $images->delete($stored[$kind]);
                $stored[$kind] = $path;
                $changed[] = $kind;
            }
        }
        AuthImages::save($stored);
        Log::info('design: auth image updated', ['kinds' => $changed, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Фон входу збережено.']);

        return back();
    }

    public function deleteAuthImage(Request $request, ImageStorage $images, string $kind): RedirectResponse
    {
        $stored = AuthImages::stored();
        abort_unless(array_key_exists($kind, $stored), 404);
        $images->delete($stored[$kind]);
        $stored[$kind] = null;
        AuthImages::save($stored);
        Log::info('design: auth image removed', ['kind' => $kind, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Фон входу видалено.']);

        return back();
    }

    /** Шаблон зі змінними теми, від якого починають новий стиль. */
    public function template(): BinaryFileResponse
    {
        return response()->download(base_path(SiteThemes::TEMPLATE), 'gamecon-style-template.css', ['Content-Type' => 'text/css; charset=utf-8']);
    }

    /**
     * @return array{name: string, description: string|null, author: string|null}
     */
    private function validated(Request $request, bool $fileRequired): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'description' => ['nullable', 'string', 'max:300'],
            'author' => ['nullable', 'string', 'max:80'],
            'file' => [$fileRequired ? 'required' : 'nullable', 'file', 'extensions:css', 'mimetypes:text/css,text/plain', 'max:'.intdiv(SiteThemes::MAX_BYTES, 1024)],
            'activate' => ['sometimes', 'boolean'],
        ], [
            'file.required' => 'Оберіть CSS-файл стилю.',
            'file.extensions' => 'Потрібен файл .css.',
            'file.mimetypes' => 'Потрібен текстовий CSS-файл.',
            'file.max' => 'Файл стилю завеликий: до '.intdiv(SiteThemes::MAX_BYTES, 1024).' КБ.',
        ]);

        return [
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'author' => $data['author'] ?? null,
        ];
    }
}
