<?php

namespace App\Services;

use App\Http\Controllers\Mail\UnsubscribeController;
use App\Mail\SocialActivityMail;
use App\Models\Follow;
use App\Models\GameEvent;
use App\Models\ServerEvent;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

/**
 * Тижневий лист: найближчі події ігор і серверів, на які людина підписана.
 */
class WeeklyLetter
{
    public function sendAll(): int
    {
        $sent = 0;
        User::query()->where('email_social', true)->whereNull('banned_at')->orderBy('id')->chunkById(100, function ($users) use (&$sent) {
            foreach ($users as $user) {
                $intro = $this->intro($user);
                if ($intro === null) {
                    continue;
                }
                Mail::to($user)->queue(new SocialActivityMail(
                    subjectLine: 'Тиждень на GameCon',
                    intro: $intro,
                    actionUrl: url('/feed'),
                    fromName: (string) config('app.name'),
                    unsubscribeUrl: UnsubscribeController::url($user),
                ));
                $sent++;
            }
        });

        return $sent;
    }

    public function intro(User $user): ?string
    {
        $gameIds = Follow::query()->where('user_id', $user->id)->where('kind', Follow::GAME)->pluck('subject_id');
        $serverIds = Follow::query()->where('user_id', $user->id)->where('kind', Follow::SERVER)->pluck('subject_id');
        $titles = [];
        if ($gameIds->isNotEmpty()) {
            GameEvent::query()
                ->where('starts_at', '>=', now())
                ->where('starts_at', '<=', now()->addDays(7))
                ->whereHas('games', fn ($q) => $q->whereIn('games.id', $gameIds))
                ->orderBy('starts_at')
                ->limit(3)
                ->pluck('title')
                ->each(function (string $title) use (&$titles) {
                    $titles[] = $title;
                });
        }
        if ($serverIds->isNotEmpty()) {
            ServerEvent::query()
                ->where('starts_at', '>=', now())
                ->where('starts_at', '<=', now()->addDays(7))
                ->whereIn('gta_server_id', $serverIds)
                ->orderBy('starts_at')
                ->limit(3)
                ->pluck('title')
                ->each(function (string $title) use (&$titles) {
                    $titles[] = $title;
                });
        }

        return $titles === [] ? null : 'Цього тижня: '.implode(', ', array_slice($titles, 0, 4)).'.';
    }
}
