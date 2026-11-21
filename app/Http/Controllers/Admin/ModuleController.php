<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\Maintenance;
use App\Support\Modules\ModuleManager;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class ModuleController extends Controller
{
    public function __construct(private readonly ModuleManager $modules) {}

    public function index(): Response
    {
        return Inertia::render('admin/modules', [
            'modules' => $this->modules->all()->values()->all(),
            'maintenance' => Maintenance::all(),
        ]);
    }

    public function update(Request $request, string $module): RedirectResponse
    {
        abort_unless($this->modules->exists($module), 404);
        $data = $request->validate(['enabled' => ['required', 'boolean']]);

        try {
            $this->modules->set($module, $data['enabled']);
        } catch (InvalidArgumentException) {
            abort(422, 'Цей модуль не можна перемкнути.');
        }

        Log::info('modules: toggled', ['module' => $module, 'enabled' => $data['enabled'], 'by' => $request->user()?->id]);
        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $data['enabled'] ? 'Модуль увімкнено.' : 'Модуль вимкнено.',
        ]);

        return back();
    }

    /** Техроботи в розділі: повідомлення для людей (порожнє — розділ знову працює). Команда заходить як завжди. */
    public function maintenance(Request $request, string $module): RedirectResponse
    {
        abort_unless($this->modules->exists($module), 404);
        $data = $request->validate(['message' => ['nullable', 'string', 'max:300']]);
        $all = Maintenance::all();
        $message = trim((string) ($data['message'] ?? ''));
        if ($request->boolean('on') && $message === '') {
            $message = Maintenance::DEFAULT_MESSAGE;
        }
        if ($message === '') {
            unset($all[$module]);
        } else {
            $all[$module] = $message;
        }
        app(SiteSettings::class)->put(['maintenance_modules' => $all]);
        Log::info('modules: maintenance', ['module' => $module, 'on' => $message !== '', 'by' => $request->user()?->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => $message === '' ? 'Розділ знову працює.' : 'Розділ закрито на техроботи.']);

        return back();
    }
}
