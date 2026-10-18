<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\Plugins\Plugins;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PluginController extends Controller
{
    public function __construct(private readonly Plugins $plugins) {}

    public function index(): Response
    {
        return Inertia::render('admin/plugins', [
            'plugins' => $this->plugins->catalog(),
        ]);
    }

    public function update(Request $request, string $plugin): RedirectResponse
    {
        $data = $request->validate(['enabled' => ['required', 'boolean']]);
        $this->plugins->set($plugin, $data['enabled']);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $data['enabled'] ? 'Плагін увімкнено.' : 'Плагін вимкнено.',
        ]);

        return back();
    }
}
