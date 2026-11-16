<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\Modules\ModuleManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $data['enabled'] ? 'Модуль увімкнено.' : 'Модуль вимкнено.',
        ]);

        return back();
    }
}
