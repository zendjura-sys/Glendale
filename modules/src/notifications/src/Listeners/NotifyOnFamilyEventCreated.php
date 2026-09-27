<?php

namespace Addons\Notifications\Listeners;

use Addons\TelegramBot\Services\FamilyGroup;
use Addons\TelegramBot\Services\TelegramClient;
use Addons\TelegramBot\Support\MessageFormat;
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

        if (class_exists(FamilyGroup::class) && class_exists(TelegramClient::class)) {
            $client = new TelegramClient();
            $familyGroup = new FamilyGroup($client);
            if ($familyGroup->isConfigured()) {
                $lines = e($body);
                if ($familyEvent->description) {
                    $lines .= "\n".e($familyEvent->description);
                }
                $client->sendMessage($familyGroup->id(), MessageFormat::card('🗓', $title, $lines));
            }
        }
    }
}
