<?php

namespace Addons\Notifications\Listeners;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Спільна ціль родини — не особиста подія одного учасника, тому не через
 * NotificationService (він шле в ЛС), а fan-out усім web-сповіщенням
 * (як у BroadcastController::store) .
 */
class NotifyOnFamilyGoalCompleted
{
    public function handle($event): void
    {
        $goal = $event->goal;
        $title = 'Ціль родини досягнута!';
        $body = "«{$goal->title}» — {$goal->current_value}".($goal->unit ? " {$goal->unit}" : '');

        $now = now();
        User::query()->inActiveFamily()->select('id')->chunk(200, function ($users) use ($title, $body, $now) {
            DB::table('notifications')->insert($users->map(fn (User $user) => [
                'user_id' => $user->id,
                'type' => 'family_goal_completed',
                'title' => $title,
                'body' => $body,
                'read_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all());
        });
    }
}
