<?php

namespace App\Http\Controllers;

use App\Models\SiteEvent;
use App\Services\Events\SiteEvents;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Сезонні події сайту: поточна подія з завданнями, архів минулих, забрати нагороду. */
class SiteEventController extends Controller
{
    public function __construct(private readonly SiteEvents $events) {}

    public function index(Request $request): Response|RedirectResponse
    {
        $active = $this->events->active();
        if ($active) {
            return redirect()->route('events.site.show', $active->slug);
        }

        return $this->page($request, null);
    }

    public function show(Request $request, string $slug): Response
    {
        $event = SiteEvent::query()->where('slug', $slug)->where('starts_at', '<=', now())->firstOrFail();

        return $this->page($request, $event);
    }

    public function claim(Request $request, string $slug): RedirectResponse
    {
        $event = SiteEvent::query()->where('slug', $slug)->firstOrFail();
        $this->events->claim($event, $request->user());

        return back()->with('success', 'Нагороду додано в інвентар.');
    }

    private function page(Request $request, ?SiteEvent $event): Response
    {
        $past = SiteEvent::query()->where('starts_at', '<=', now())
            ->when($event, fn ($q) => $q->whereKeyNot($event->id))
            ->latest('starts_at')->limit(6)->get()
            ->map(fn (SiteEvent $e) => ['slug' => $e->slug, 'title' => $e->title, 'theme' => $e->theme, 'starts_at' => $e->starts_at->toIso8601String(), 'ends_at' => $e->ends_at->toIso8601String(), 'active' => $e->isActive()]);
        $next = SiteEvent::query()->where('starts_at', '>', now())->orderBy('starts_at')->first(['title', 'starts_at']);

        return Inertia::render('events/site', [
            'event' => $event ? $this->events->card($event, $request->user()) : null,
            'past' => $past,
            'next' => $next ? ['title' => $next->title, 'starts_at' => $next->starts_at->toIso8601String()] : null,
        ]);
    }
}
