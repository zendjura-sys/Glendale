<?php

namespace App\Http\Controllers\Developer;

use App\Http\Controllers\Controller;
use App\Support\Developer\CmsIcons;
use App\Support\Developer\CmsPlugins;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** Розробникам → Плагіни для CMS: каталог, інструкція й завантаження архіву. */
class CmsPluginsController extends Controller
{
    public function index(): Response
    {
        app(Plugins::class)->ensure('developers');

        return Inertia::render('developers/plugins', [
            'plugins' => collect(CmsPlugins::all())->map(fn (array $p, string $key) => $this->card($key, $p))->values(),
            'version' => CmsPlugins::VERSION,
        ]);
    }

    public function show(string $plugin): Response
    {
        app(Plugins::class)->ensure('developers');
        $data = CmsPlugins::find($plugin) ?? abort(404);

        return Inertia::render('developers/plugin', [
            'plugin' => [
                ...$this->card($plugin, $data),
                'steps' => $data['steps'],
                'settings' => $data['settings'],
                'features' => $data['features'],
                'redirect' => $data['redirect'],
            ],
            'base' => url('/'),
            'version' => CmsPlugins::VERSION,
            'others' => collect(CmsPlugins::all())->except($plugin)->map(fn (array $p, string $key) => $this->card($key, $p))->values()->take(6),
        ]);
    }

    public function download(string $plugin): BinaryFileResponse
    {
        app(Plugins::class)->ensure('developers');
        abort_if(CmsPlugins::find($plugin) === null, 404);
        Log::info('developers.plugin.download', ['user_id' => auth()->id(), 'plugin' => $plugin]);

        return response()->download(CmsPlugins::archive($plugin), 'gamecon-'.$plugin.'-'.CmsPlugins::VERSION.'.zip', ['Content-Type' => 'application/zip']);
    }

    /**
     * @param  array<string, mixed>  $p
     * @return array<string, mixed>
     */
    private function card(string $key, array $p): array
    {
        return [
            'key' => $key,
            'name' => $p['name'],
            'kind' => $p['kind'],
            'color' => $p['color'],
            'mark' => $p['mark'],
            'logo' => $p['logo'] ?? null,
            // Фавікон з офіційного сайту рушія (developers:cms-icons).
            'favicon' => CmsIcons::url($key),
            'versions' => $p['versions'],
            'stack' => $p['stack'],
            'package' => $p['package'],
            'href' => '/developers/plugins/'.$key,
            'download' => '/developers/plugins/'.$key.'/download',
        ];
    }
}
