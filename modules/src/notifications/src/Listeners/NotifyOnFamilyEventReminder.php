<?php

namespace Addons\Notifications\Listeners;

use Addons\TelegramBot\Services\FamilyGroup;
use Addons\TelegramBot\Services\TelegramClient;
use Addons\TelegramBot\Support\MessageFormat;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Нагадування за день до події — той самий fan-out + груп-чат приём, що й
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

        if (class_exists(FamilyGroup::class) && class_exists(TelegramClient::class)) {
            $client = new TelegramClient();
            $familyGroup = new FamilyGroup($client);
            if ($familyGroup->isConfigured()) {
                $client->sendMessage($familyGroup->id(), MessageFormat::card('⏰', $title, e($body)));
            }
        }
    }
}
