<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\Modules\ModuleManager;
use App\Support\NetworkModes;
use App\Support\Plugins\Plugins;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Адмінка → Режими: які режими соцмережі є, що в кожному видно (модулі, функції, плагіни),
 * який типовий для новачків. Кожна дія пишеться в журнал (modes: …).
 */
class ModesController extends Controller
{
    public function __construct(private readonly NetworkModes $modes) {}

    public function index(ModuleManager $modules, Plugins $plugins): Response
    {
        return Inertia::render('admin/modes', [
            'config' => $this->modes->config(),
            'modules' => $modules->all()->values()->map(fn (array $module) => [
                'key' => $module['key'],
                'name' => $module['name'],
                'core' => $module['core'],
                'enabled' => $module['enabled'],
            ]),
            'plugins' => $plugins->catalog(),
            'features' => NetworkModes::FEATURES,
            'icons' => NetworkModes::ICONS,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'default' => ['required', 'string', 'max:32'],
            'modes' => ['required', 'array', 'min:1', 'max:20'],
            'modes.*.id' => ['required', 'string', 'regex:/^[a-z0-9-]{2,32}$/', 'distinct'],
            'modes.*.name' => ['required', 'string', 'max:40'],
            'modes.*.description' => ['nullable', 'string', 'max:200'],
            'modes.*.icon' => ['required', 'string', 'in:'.implode(',', NetworkModes::ICONS)],
            'modes.*.enabled' => ['required', 'boolean'],
            'modes.*.builtin' => ['sometimes', 'boolean'],
            'modes.*.modules' => ['present', 'array'],
            'modes.*.modules.*' => ['string'],
            'modes.*.plugins_off' => ['present', 'array'],
            'modes.*.plugins_off.*' => ['string'],
            'modes.*.features' => ['present', 'array'],
        ]);
        $enabled = array_column(array_filter($data['modes'], fn (array $mode) => (bool) $mode['enabled']), 'id');
        if ($enabled === []) {
            throw ValidationException::withMessages(['modes' => 'Залиште увімкненим хоча б один режим.']);
        }
        if (! in_array($data['default'], $enabled, true)) {
            throw ValidationException::withMessages(['default' => 'Типовий режим має бути увімкненим.']);
        }

        $this->modes->save(['default' => $data['default'], 'modes' => array_values($data['modes'])]);
        Log::info('modes: updated', ['by' => $request->user()->id, 'default' => $data['default'], 'modes' => array_column($data['modes'], 'id')]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Режими збережено. Люди побачать зміни з наступної сторінки.']);

        return back();
    }

    public function reset(Request $request): RedirectResponse
    {
        $this->modes->save(['default' => 'all', 'modes' => $this->modes->presets()]);
        Log::info('modes: reset to presets', ['by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Повернуто типові режими.']);

        return back();
    }
}
