<?php

namespace Addons\Notifications\Listeners;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Нагадування за день до події — той самий fan-out, що й
 * при створенні події (NotifyOnFamilyEventCreated).
 */
class NotifyOnFamilyEventReminder
{
    public function handle($event): void
    {
        $familyEvent = $event->event;
        $when = $familyEvent->starts_at->locale('uk')->isoFormat('HH:mm');

        $title = 'Завтра: '.$familyEvent->title;
        $body = 'Початок о '.$when.($familyEvent->location ? ' · '.$familyEvent->location : '');

        $now = now();
        User::query()->inActiveFamily()->select('id')->chunk(200, function ($users) use ($title, $body, $now) {
            DB::table('notifications')->insert($users->map(fn (User $user) => [
                'user_id' => $user->id,
                'type' => 'family_event_reminder',
                'title' => $title,
                'body' => $body,
                'read_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all());
        });
    }
}
