<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SiteTheme;
use App\Services\Design\SiteThemes;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
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
