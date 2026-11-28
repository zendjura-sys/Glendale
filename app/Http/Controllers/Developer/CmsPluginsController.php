<?php

namespace App\Http\Controllers\Developer;

use App\Http\Controllers\Controller;
use App\Support\Developer\CmsIcons;
use App\Support\Developer\CmsPlugins;
use App\Support\Plugins\Plugins;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;
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
                // Встановлення командою (Linux): персональне підписане посилання на добу — лише після входу.
                'installable' => (bool) ($data['install'] ?? false),
                'install' => ($data['install'] ?? false) && auth()->check()
                    ? 'curl -fsSL "'.URL::temporarySignedRoute('developers.plugins.install', now()->addDay(), ['plugin' => $plugin]).'" | sh'
                    : null,
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

    /** install.sh за підписаним посиланням: ставить gamecon-auth у ~/.local/bin. */
    public function install(string $plugin): HttpResponse
    {
        abort_unless((CmsPlugins::find($plugin)['install'] ?? false) === true, 404);
        $cli = URL::temporarySignedRoute('developers.plugins.cli', now()->addDay(), ['plugin' => $plugin]);
        Log::info('developers.plugin.install', ['plugin' => $plugin, 'ip' => request()->ip()]);
        $script = <<<SH
#!/bin/sh
# GameCon: встановлення gamecon-auth (вхід через GameCon для Linux).
set -eu
command -v python3 >/dev/null 2>&1 || { echo "Потрібен python3 (sudo apt install python3 / sudo dnf install python3)."; exit 1; }
DIR="\${XDG_DATA_HOME:-\$HOME/.local/share}/gamecon"
BIN="\$HOME/.local/bin"
mkdir -p "\$DIR" "\$BIN"
curl -fsSL "{$cli}" -o "\$DIR/gamecon_auth.py"
chmod 755 "\$DIR/gamecon_auth.py"
ln -sf "\$DIR/gamecon_auth.py" "\$BIN/gamecon-auth"
echo "✓ gamecon-auth встановлено в \$BIN"
case ":\$PATH:" in *":\$BIN:"*) ;; *) echo 'Додайте до PATH (наприклад, у ~/.profile): export PATH="\$HOME/.local/bin:\$PATH"';; esac
echo "Далі: gamecon-auth login --client-id ВАШ_CLIENT_ID"

SH;

        return response($script, 200, ['Content-Type' => 'text/x-shellscript; charset=utf-8']);
    }

    public function cli(string $plugin): HttpResponse
    {
        abort_unless((CmsPlugins::find($plugin)['install'] ?? false) === true, 404);

        return response((string) file_get_contents(resource_path('cms-plugins/linux/gamecon-auth/gamecon_auth.py')), 200, ['Content-Type' => 'text/x-python; charset=utf-8']);
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
