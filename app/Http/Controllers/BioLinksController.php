<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Plugins\Plugins;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Сторінка посилань («link in bio»): /l/нік — усі ваші посилання на одній сторінці з лічильником переходів. */
class BioLinksController extends Controller
{
    public const MAX = 12;

    public function edit(Request $request): Response
    {
        app(Plugins::class)->ensure('bio_links');
        $user = $request->user();
        $clicks = (array) ($user->pref('bio_clicks') ?? []);

        return Inertia::render('settings/links', [
            'links' => array_map(fn (array $link) => [...$link, 'clicks' => (int) ($clicks[md5($link['url'])] ?? 0)], $this->links($user)),
            'url' => route('bio.show', $user->username),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        app(Plugins::class)->ensure('bio_links');
        $data = $request->validate([
            'links' => ['present', 'array', 'max:'.self::MAX],
            'links.*.title' => ['required', 'string', 'max:60'],
            'links.*.url' => ['required', 'url:http,https', 'max:300'],
        ]);
        $request->user()->mergePref(['bio_links' => array_map(fn (array $l) => ['title' => trim($l['title']), 'url' => trim($l['url'])], array_values($data['links']))]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Посилання збережено.']);

        return back();
    }

    public function show(User $user): Response
    {
        app(Plugins::class)->ensure('bio_links');
        abort_if($user->isFrozen() || $user->banned_at !== null, 404);
        $links = $this->links($user);
        abort_if($links === [], 404);

        return Inertia::render('links/show', [
            'profile' => [...$user->toCard(), 'about' => $user->is_private ? null : $user->about, 'cover_url' => $user->cover_url],
            'links' => array_map(fn (array $link, int $i) => ['title' => $link['title'], 'host' => (string) parse_url($link['url'], PHP_URL_HOST), 'href' => route('bio.go', [$user->username, $i])], $links, array_keys($links)),
        ]);
    }

    /** Перехід за посиланням: рахуємо й переадресовуємо. */
    public function go(User $user, int $index): RedirectResponse
    {
        $link = $this->links($user)[$index] ?? null;
        abort_if($link === null, 404);
        $clicks = (array) ($user->pref('bio_clicks') ?? []);
        $key = md5($link['url']);
        $clicks[$key] = (int) ($clicks[$key] ?? 0) + 1;
        $user->mergePref(['bio_clicks' => $clicks]);

        return redirect()->away($link['url']);
    }

    /**
     * @return list<array{title: string, url: string}>
     */
    private function links(User $user): array
    {
        $links = $user->pref('bio_links');

        return is_array($links) ? array_values(array_filter($links, fn ($l) => is_array($l) && is_string($l['title'] ?? null) && is_string($l['url'] ?? null) && preg_match('#^https?://#i', $l['url']))) : [];
    }
}
