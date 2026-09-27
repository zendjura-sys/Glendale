<?php

namespace Addons\Notifications\Listeners;

use Addons\TelegramBot\Services\FamilyGroup;
use Addons\TelegramBot\Services\TelegramClient;
use Addons\TelegramBot\Support\MessageFormat;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Спільна ціль родини — не особиста подія одного учасника, тому не через
 * NotificationService (він шле в ЛС), а fan-out усім web-сповіщенням
 * (як у BroadcastController::store) плюс ОДНЕ повідомлення в сімейний
 * груп-чат, а не N особистих.
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

        if (class_exists(FamilyGroup::class) && class_exists(TelegramClient::class)) {
            $client = new TelegramClient();
            $familyGroup = new FamilyGroup($client);
            if ($familyGroup->isConfigured()) {
                $client->sendMessage($familyGroup->id(), MessageFormat::card('🎯', $title, e($body)));
            }
        }
    }
}
