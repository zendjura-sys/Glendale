<?php

namespace Addons\Notifications\Listeners;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Нагадування "за 15 хвилин до початку" — друге, окреме від денного
 * (NotifyOnFamilyEventReminder), той самий fan-out.
 * На відміну від денного, веб-сповіщення НЕ шле тим, хто явно відповів
 * "не піду" на RSVP — денне ще запрошує визначитись, а це вже фінальний
 * пінг для тих, хто (ймовірно) прийде.
 */
class NotifyOnFamilyEventStartingSoon
{
    public function handle($event): void
    {
        $familyEvent = $event->event;
        $when = $familyEvent->starts_at->locale('uk')->isoFormat('HH:mm');

        $title = 'Скоро починається: '.$familyEvent->title;
        $body = 'Початок о '.$when.' (через 15 хв)'.($familyEvent->location ? ' · '.$familyEvent->location : '');

        $skipUserIds = $familyEvent->rsvps()->where('status', 'not_going')->pluck('user_id');

        $now = now();
        User::query()->inActiveFamily()->select('id')->whereNotIn('id', $skipUserIds)->chunk(200, function ($users) use ($title, $body, $now) {
            DB::table('notifications')->insert($users->map(fn (User $user) => [
                'user_id' => $user->id,
                'type' => 'family_event_starting_soon',
                'title' => $title,
                'body' => $body,
                'read_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all());
        });
    }
}
