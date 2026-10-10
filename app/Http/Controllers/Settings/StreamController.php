<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\UserStream;
use App\Services\Streams\LiveStreams;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/** Свій канал Twitch / YouTube у профілі й ручна позначка «Я в ефірі». */
class StreamController extends Controller
{
    public function __construct(private readonly LiveStreams $streams) {}

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'platform' => ['required', Rule::in(array_keys(UserStream::PLATFORMS))],
            'channel' => ['required', 'string', 'max:200'],
        ]);
        $stream = $this->streams->save($request->user(), $data['platform'], $data['channel']);
        Inertia::flash('toast', ['type' => 'success', 'message' => $stream->is_live ? 'Канал збережено — ви зараз в ефірі!' : 'Канал збережено. Позначка LIVE з’явиться, щойно почнеться ефір.']);

        return back();
    }

    public function destroy(Request $request): RedirectResponse
    {
        UserStream::query()->where('user_id', $request->user()->id)->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Канал прибрано з профілю.']);

        return back();
    }

    public function live(Request $request): RedirectResponse
    {
        $on = $request->boolean('on');
        abort_if($this->streams->manual($request->user(), $on) === null, 422, 'Спершу вкажіть свій канал.');
        Inertia::flash('toast', ['type' => 'success', 'message' => $on ? 'Друзі побачать, що ви в ефірі.' : 'Позначку «в ефірі» знято.']);

        return back();
    }
}
