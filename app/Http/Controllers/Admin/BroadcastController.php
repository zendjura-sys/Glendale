<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SendBroadcast;
use App\Models\Broadcast;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Розсилки: сповіщення в дзвіночок і push усім, власникам GameCon+, користувачам застосунку чи команді. */
class BroadcastController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/broadcasts', [
            'broadcasts' => Broadcast::query()->with('user')->latest()->limit(50)->get()->map(fn (Broadcast $b) => [
                'id' => $b->id,
                'title' => $b->title,
                'body' => $b->body,
                'url' => $b->url,
                'audience' => $b->audience,
                'sent_count' => $b->sent_count,
                'finished' => $b->finished_at !== null,
                'by' => $b->user?->name,
                'created_at' => $b->created_at->toIso8601String(),
            ]),
            'audiences' => array_combine(Broadcast::AUDIENCES, array_map(fn (string $a) => SendBroadcast::audience($a)->count(), Broadcast::AUDIENCES)),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:80'],
            'body' => ['required', 'string', 'min:3', 'max:500'],
            'url' => ['nullable', 'string', 'max:300', 'regex:#^(/[^\s]*|https://[^\s]+)$#'],
            'audience' => ['required', Rule::in(Broadcast::AUDIENCES)],
        ]);
        $broadcast = Broadcast::query()->create([...$data, 'user_id' => $request->user()?->id]);
        SendBroadcast::dispatch($broadcast->id);
        Log::info('broadcast: queued', ['broadcast' => $broadcast->id, 'audience' => $broadcast->audience, 'by' => $request->user()?->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Розсилку поставлено в чергу — сповіщення підуть за кілька хвилин.']);

        return back();
    }
}
