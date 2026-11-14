<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Geo\CountryRestrictions;
use App\Services\Geo\VisitorCountry;
use App\Support\Modules\ModuleManager;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Locale;

/**
 * Адмінка → Країни → Обмеження: окремі розділи (модулі) й функції (плагіни),
 * вимкнені для відвідувачів із вибраної країни. Рекомендації — лише підказка.
 */
class GeoRestrictionController extends Controller
{
    public function __construct(
        private readonly CountryRestrictions $restrictions,
        private readonly ModuleManager $modules,
        private readonly Plugins $plugins,
    ) {}

    public function index(Request $request): Response
    {
        $countries = [];
        foreach (GeoController::codes() as $code) {
            $name = Locale::getDisplayRegion('-'.$code, app()->getLocale()) ?: '';
            $countries[] = ['code' => $code, 'name' => $name !== '' ? $name : $code];
        }
        usort($countries, fn (array $a, array $b) => strcmp($a['name'], $b['name']));

        $moduleTags = $this->restrictions->featureTags('modules');
        $pluginTags = $this->restrictions->featureTags('plugins');
        $recommended = [];
        foreach ($this->restrictions->rules() as $rule) {
            foreach ($rule['countries'] as $code) {
                $recommended[$code] ??= $this->restrictions->recommendations($code);
            }
        }

        return Inertia::render('admin/geo-restrictions', [
            'countries' => $countries,
            'restrictions' => (object) $this->restrictions->all(),
            'modules' => array_map(fn (array $module) => [
                'key' => $module['key'],
                'name' => $module['name'],
                'description' => $module['description'],
                'enabled' => $module['enabled'],
                'tags' => $moduleTags[$module['key']] ?? [],
            ], $this->restrictableModules()),
            'plugins' => array_map(fn (array $plugin) => [
                ...$plugin,
                'tags' => $pluginTags[$plugin['key']] ?? [],
            ], $this->plugins->catalog()),
            'tags' => (object) $this->restrictions->tagLabels(),
            'recommended' => (object) $recommended,
            'me' => app(VisitorCountry::class)->of($request),
        ]);
    }

    public function update(Request $request, string $country): RedirectResponse
    {
        abort_unless(in_array($country, GeoController::codes(), true), 404);
        $data = $request->validate([
            'modules' => ['present', 'array', 'max:100'],
            'modules.*' => ['string', Rule::in(array_column($this->restrictableModules(), 'key'))],
            'plugins' => ['present', 'array', 'max:200'],
            'plugins.*' => ['string', Rule::in(array_column($this->plugins->catalog(), 'key'))],
            'note' => ['nullable', 'string', 'max:500'],
        ]);
        $before = $this->restrictions->for($country);
        $modules = array_values(array_unique(array_map('strval', $data['modules'])));
        $plugins = array_values(array_unique(array_map('strval', $data['plugins'])));
        $this->restrictions->save($country, $modules, $plugins, (string) ($data['note'] ?? ''));

        Log::info('geo: country restrictions updated', [
            'country' => $country,
            'modules' => $modules,
            'plugins' => $plugins,
            'before' => ['modules' => $before['modules'], 'plugins' => $before['plugins']],
            'by' => $request->user()?->id,
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => $modules === [] && $plugins === []
            ? 'Обмеження для країни знято.'
            : 'Обмеження для країни збережено.']);

        return back();
    }

    /** Рекомендовані обмеження для країни (підказка, нічого не змінює). */
    public function recommendations(string $country): JsonResponse
    {
        abort_unless(in_array($country, GeoController::codes(), true), 404);

        return response()->json(['country' => $country, ...$this->restrictions->recommendations($country)]);
    }

    /**
     * Модулі, які можна закрити для країни: реалізовані й не з ядра.
     *
     * @return list<array{key: string, name: string, description: string, enabled: bool}>
     */
    private function restrictableModules(): array
    {
        $out = [];
        foreach ($this->modules->all() as $module) {
            if (! $module['core'] && $module['available']) {
                $out[] = ['key' => $module['key'], 'name' => $module['name'], 'description' => $module['description'], 'enabled' => $module['enabled']];
            }
        }

        return $out;
    }
}
