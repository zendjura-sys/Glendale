<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SiteEvent;
use App\Services\Events\SiteEvents;
use App\Services\Quests\SeasonPass;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Адмінка → Події: сезонні події сайту (завдання, спільна мета, нагорода). Кожна дія — в журнал. */
class SiteEventController extends Controller
{
    public function index(SeasonPass $pass): Response
    {
        $catalog = $pass->catalog();

        return Inertia::render('admin/site-events', [
            'events' => SiteEvent::query()->latest('starts_at')->limit(50)->get()->map(fn (SiteEvent $e) => [
                'id' => $e->id,
                'slug' => $e->slug,
                'title' => $e->title,
                'description' => $e->description,
                'theme' => $e->theme,
                'starts_at' => $e->starts_at->format('Y-m-d\TH:i'),
                'ends_at' => $e->ends_at->format('Y-m-d\TH:i'),
                'tasks' => $e->tasks,
                'goal_metric' => $e->goal_metric,
                'goal_target' => $e->goal_target,
                'reward' => $e->reward,
                'active' => $e->isActive(),
                'claimers' => DB::table('site_event_claims')->where('site_event_id', $e->id)->count(),
            ]),
            'metrics' => array_keys(SiteEvents::METRICS),
            'themes' => ['none', 'newyear', 'valentine', 'easter', 'independence', 'halloween'],
            'catalog' => array_intersect_key($catalog, array_flip(SiteEvents::REWARD_TYPES)),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $event = SiteEvent::query()->create([...$this->validated($request), 'created_by' => $request->user()->id]);
        $this->forget();
        Log::info('admin: site event created', ['admin' => $request->user()->id, 'event' => $event->id, 'slug' => $event->slug]);

        return back()->with('success', 'Подію створено.');
    }

    public function update(Request $request, SiteEvent $event): RedirectResponse
    {
        $event->update($this->validated($request, $event));
        $this->forget($event);
        Log::info('admin: site event updated', ['admin' => $request->user()->id, 'event' => $event->id]);

        return back()->with('success', 'Подію збережено.');
    }

    public function destroy(Request $request, SiteEvent $event): RedirectResponse
    {
        // Видаляємо лише подію; косметика, яку вже забрали, лишається в інвентарях людей.
        Log::info('admin: site event deleted', ['admin' => $request->user()->id, 'event' => $event->id, 'slug' => $event->slug]);
        $event->delete();
        $this->forget();

        return back()->with('success', 'Подію видалено.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?SiteEvent $event = null): array
    {
        $metrics = array_keys(SiteEvents::METRICS);
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:80'],
            'slug' => ['nullable', 'string', 'max:60', 'regex:/^[a-z0-9-]+$/', Rule::unique('site_events', 'slug')->ignore($event?->id)],
            'description' => ['nullable', 'string', 'max:500'],
            'theme' => ['required', Rule::in(['none', 'newyear', 'valentine', 'easter', 'independence', 'halloween'])],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'tasks' => ['required', 'array', 'min:1', 'max:5'],
            'tasks.*.metric' => ['required', Rule::in($metrics)],
            'tasks.*.target' => ['required', 'integer', 'min:1', 'max:1000'],
            'goal_metric' => ['nullable', Rule::in($metrics)],
            'goal_target' => ['nullable', 'required_with:goal_metric', 'integer', 'min:1', 'max:10000000'],
            'reward' => ['required', 'array', 'min:1', 'max:3'],
            'reward.*.type' => ['required', Rule::in(SiteEvents::REWARD_TYPES)],
            'reward.*.value' => ['required', 'string', 'max:40'],
        ]);
        foreach ($data['reward'] as $i => $r) {
            if (! is_array(config("season_pass.cosmetics.{$r['type']}.{$r['value']}"))) {
                abort(422, "Нагорода #{$i}: такої косметики немає.");
            }
        }

        return [
            ...$data,
            'slug' => $data['slug'] ?: ($event->slug ?? Str::slug(Str::ascii($data['title'])).'-'.now()->format('Y')),
            'tasks' => array_values(array_map(fn ($t) => ['metric' => $t['metric'], 'target' => (int) $t['target']], $data['tasks'])),
            'reward' => array_values(array_map(fn ($r) => ['type' => $r['type'], 'value' => $r['value']], $data['reward'])),
            'goal_metric' => $data['goal_metric'] ?? null,
            'goal_target' => isset($data['goal_metric']) ? ($data['goal_target'] ?? null) : null,
        ];
    }

    private function forget(?SiteEvent $event = null): void
    {
        Cache::forget('site_event.active');
        if ($event) {
            Cache::forget("site_event.goal.{$event->id}");
        }
    }
}
