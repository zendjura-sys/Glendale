<?php

namespace App\Jobs;

use App\Models\LiveShow;
use App\Models\LiveShowMember;
use App\Services\Shows\LiveShows;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Carbon;

/** Час питання гостя в шоу вийшов — забираємо мікрофон (якщо ведучий не дав слово ще раз). */
class EndShowQuestion implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public function __construct(public readonly int $showId, public readonly int $userId, public readonly string $until) {}

    public function handle(LiveShows $shows): void
    {
        $show = LiveShow::query()->find($this->showId);
        $member = LiveShowMember::query()->with('user')->where('live_show_id', $this->showId)->where('user_id', $this->userId)->first();
        if ($show === null || $member === null || $member->user === null || $member->role !== 'guest') {
            return;
        }
        // Ведучий міг дати слово ще раз — тоді діє новий час.
        if ($member->mic_until !== null && $member->mic_until->gt(Carbon::parse($this->until))) {
            return;
        }
        $shows->takeFloor($show, $member->user);
    }
}
