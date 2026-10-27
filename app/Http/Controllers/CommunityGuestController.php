<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\CommunityChannel;
use App\Services\Communities\CommunityGuests;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Сторінка спільноти для гостей без акаунта: опис, відкриті канали (лише читання)
 * і гостьовий чат, якщо адміністрація його увімкнула. Учасники сайту йдуть на звичайну сторінку.
 */
class CommunityGuestController extends Controller
{
    public function __construct(private readonly CommunityGuests $guests) {}

    public function show(Request $request, Community $community): RedirectResponse|Response
    {
        if ($request->user() !== null) {
            return redirect("/c/{$community->slug}");
        }
        abort_unless($this->guests->canView($community), 404);

        $channels = $this->guests->channels($community);
        $chat = $this->guests->chatChannel($community);
        $wanted = (int) $request->query('channel', 0);
        $active = $channels->firstWhere('id', $wanted) ?? ($chat ?? $channels->first());

        return Inertia::render('communities/guest', [
            'community' => [
                ...$community->toCard(),
                'description' => $community->description,
                'created_at' => $community->created_at->toIso8601String(),
            ],
            'channels' => array_values($channels->map(fn (CommunityChannel $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'type' => $c->type,
                'topic' => $c->topic,
                'guest_chat' => $chat?->id === $c->id,
            ])->all()),
            'channel_id' => $active?->id,
            'messages' => $active ? $this->guests->history($active) : [],
            'can_write' => $active !== null && $chat?->id === $active->id,
            'guest_name' => $request->session()->get('guest_chat_name'),
        ]);
    }

    public function store(Request $request, Community $community, CommunityChannel $channel): RedirectResponse
    {
        abort_if($request->user() !== null, 403, 'Ви вже увійшли — пишіть у каналі як учасник.');
        abort_unless($channel->community_id === $community->id, 404);
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:24', 'regex:/^[\p{L}\p{N} _.\-]+$/u'],
            'body' => ['required', 'string', 'max:500'],
            // Пастка для ботів: людина це поле не бачить.
            'website' => ['nullable', 'max:0'],
        ], [
            'name.regex' => 'Ім’я — лише літери, цифри, пробіл, «_», «.» і «-».',
            'website.max' => 'Не вдалося надіслати.',
        ]);
        $name = trim(preg_replace('/\s+/u', ' ', $data['name']) ?? '');
        $channel->setRelation('community', $community);
        $this->guests->post($community, $channel, $name, $data['body'], (string) $request->ip());
        $request->session()->put('guest_chat_name', $name);

        return redirect("/c/{$community->slug}/guest?channel={$channel->id}");
    }
}
