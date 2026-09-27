<?php

namespace Addons\Notifications\Listeners;

use Addons\FamilyEvents\Models\FamilyEvent;
use Addons\TelegramBot\Services\FamilyGroup;
use Addons\TelegramBot\Services\TelegramClient;
use Addons\TelegramBot\Support\MessageFormat;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Ручний дайджест усіх майбутніх подій — адмін тисне кнопку, коли треба
 * разово нагадати всім про повний список, а не про одну подію.
 */
class NotifyOnFamilyEventsDigest
{
    public function handle($event): void
    {
        $events = FamilyEvent::query()
            ->where('starts_at', '>=', FamilyEvent::nowAsStored())
            ->orderBy('starts_at')
            ->get(['title', 'location', 'starts_at']);

        if ($events->isEmpty()) {
            return;
        }

        $lines = $events->map(function (FamilyEvent $e) {
            $when = $e->starts_at->locale('uk')->isoFormat('D MMMM, HH:mm');
            $line = $when.' — '.$e->title;

            return $e->location ? $line.' ('.$e->location.')' : $line;
        });

        $title = 'Найближчі події родини';
        $body = $lines->implode("\n");

        $now = now();
        User::query()->inActiveFamily()->select('id')->chunk(200, function ($users) use ($title, $body, $now) {
            DB::table('notifications')->insert($users->map(fn (User $user) => [
                'user_id' => $user->id,
                'type' => 'family_events_digest',
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
                $lines = $events->map(function (FamilyEvent $e) {
                    $when = $e->starts_at->locale('uk')->isoFormat('D MMMM, HH:mm');
                    $line = e($when).' — '.e($e->title);

                    return $e->location ? $line.' ('.e($e->location).')' : $line;
                });

                $client->sendMessage(
                    $familyGroup->id(),
                    MessageFormat::card('📅', $title, $lines->implode("\n"))
                );
            }
        }
    }
}
