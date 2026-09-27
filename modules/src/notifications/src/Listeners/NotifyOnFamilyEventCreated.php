<?php

namespace Addons\Notifications\Listeners;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Нова подія родини — не особиста подія одного учасника, тому не через
 * NotificationService (він шле в ЛС), а fan-out усім web-сповіщенням плюс
 * ОДНЕ повідомлення в сімейний груп-чат, той самий приём, що й у
 * NotifyOnFamilyGoalCompleted.
 */
class NotifyOnFamilyEventCreated
{
    public function handle($event): void
    {
        $familyEvent = $event->event;
        $when = $familyEvent->starts_at->locale('uk')->isoFormat('D MMMM, HH:mm');

        $title = 'Нова подія родини: '.$familyEvent->title;
        $body = $when.($familyEvent->location ? ' · '.$familyEvent->location : '');

        $now = now();
        User::query()->inActiveFamily()->select('id')->chunk(200, function ($users) use ($title, $body, $now) {
            DB::table('notifications')->insert($users->map(fn (User $user) => [
                'user_id' => $user->id,
                'type' => 'family_event_created',
                'title' => $title,
                'body' => $body,
                'read_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all());
        });
    }
}
