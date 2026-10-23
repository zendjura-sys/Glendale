<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Season;
use App\Services\Quests\SeasonPass;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** Адмінка → Сезони: тема місяця, очки за рівні й нагороди обох доріжок пропуску. */
class SeasonController extends Controller
{
    public function __construct(private readonly SeasonPass $pass) {}

    public function index(Request $request): Response
    {
        $current = $this->pass->currentKey();
        $start = Carbon::createFromFormat('Y-m', $current, 'Europe/Kyiv')->startOfMonth();
        // Попередній, поточний і три наступні місяці + усі вже налаштовані.
        $keys = collect(range(-1, 3))->map(fn (int $i) => $start->copy()->addMonthsNoOverflow($i)->format('Y-m'))
            ->merge(Season::query()->pluck('key'))->unique()->sortDesc()->values()->all();
        $key = (string) $request->query('season', $current);
        abort_unless(preg_match('/^\d{4}-\d{2}$/', $key) === 1, 404);
        $season = $this->pass->find($key);
        $costs = $this->pass->costs($season);

        return Inertia::render('admin/seasons', [
            'current' => $current,
            'seasons' => array_map(fn (string $k) => ['key' => $k, 'saved' => Season::query()->where('key', $k)->exists()], $keys),
            'edit' => [
                ...$this->pass->seasonCard($season),
                'saved' => $season->exists,
                'levels' => $costs,
                'rewards' => (object) ($season->rewards ?? []),
                'track' => $this->pass->track($season, $costs),
            ],
            'themes' => array_map(fn (array $t) => ['name' => (string) $t['name'], 'colors' => array_values($t['colors'])], (array) config('season_pass.themes')),
            'catalog' => $this->pass->catalog(),
            'defaults' => ['points_per_level' => (int) config('season_pass.points_per_level', 50)],
        ]);
    }

    public function update(Request $request, string $key): RedirectResponse
    {
        abort_unless(preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $key) === 1, 404);
        $max = $this->pass->maxLevel();
        $data = $request->validate([
            'title' => ['required', 'string', 'min:2', 'max:80'],
            'theme' => ['required', 'string', Rule::in(array_keys((array) config('season_pass.themes')))],
            'levels' => ['required', 'array', "size:{$max}"],
            'levels.*' => ['required', 'integer', 'min:1', 'max:10000'],
            'rewards' => ['nullable', 'array'],
            'rewards.*' => ['array'],
            'rewards.*.*' => ['nullable', 'array'],
            'rewards.*.*.type' => ['required_with:rewards.*.*', 'string', Rule::in(SeasonPass::TYPES)],
            'rewards.*.*.value' => ['required_with:rewards.*.*', 'string', 'max:64'],
        ]);

        $rewards = [];
        foreach ((array) ($data['rewards'] ?? []) as $level => $tracks) {
            $level = (int) $level;
            if ($level < 1 || $level > $max || ! is_array($tracks)) {
                continue;
            }
            foreach (SeasonPass::TRACKS as $track) {
                $raw = $tracks[$track] ?? null;
                if (! is_array($raw)) {
                    continue;
                }
                $reward = $this->pass->reward($raw);
                if ($reward === null) {
                    throw ValidationException::withMessages(["rewards.{$level}.{$track}" => "Рівень {$level}: такої нагороди немає в каталозі."]);
                }
                $rewards[(string) $level][$track] = ['type' => $reward['type'], 'value' => $reward['value']];
            }
        }

        $season = Season::query()->updateOrCreate(['key' => $key], [
            'title' => $data['title'],
            'theme' => $data['theme'],
            'levels' => array_map('intval', array_values($data['levels'])),
            'rewards' => $rewards,
        ]);

        Log::info('admin: season pass updated', [
            'season' => $season->key,
            'title' => $season->title,
            'theme' => $season->theme,
            'rewards' => array_sum(array_map('count', $rewards)),
            'by' => $request->user()?->id,
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Сезон збережено.']);

        return back();
    }
}
