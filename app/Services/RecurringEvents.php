<?php

namespace App\Services;

use App\Models\ClanEvent;
use App\Models\FamilyEvent;
use App\Models\ServerEvent;

/**
 * Щотижнева подія після старту отримує наступну копію через сім днів.
 */
class RecurringEvents
{
    public function spawn(): int
    {
        $count = 0;

        FamilyEvent::query()->where('repeat', 'weekly')->whereNull('spawned_at')->where('starts_at', '<=', now())->get()
            ->each(function (FamilyEvent $event) use (&$count) {
                $event->forceFill(['spawned_at' => now()])->save();
                FamilyEvent::query()->create([
                    'family_id' => $event->family_id,
                    'created_by' => $event->created_by,
                    'title' => $event->title,
                    'type' => $event->type,
                    'description' => $event->description,
                    'starts_at' => $event->starts_at->copy()->addWeek(),
                    'points' => $event->points,
                    'reward' => $event->reward,
                    'status' => FamilyEvent::STATUS_PLANNED,
                    'repeat' => 'weekly',
                ]);
                $count++;
            });

        ServerEvent::query()->where('repeat', 'weekly')->whereNull('spawned_at')->where('starts_at', '<=', now())->get()
            ->each(function (ServerEvent $event) use (&$count) {
                $event->forceFill(['spawned_at' => now()])->save();
                ServerEvent::query()->create([
                    'gta_server_id' => $event->gta_server_id,
                    'user_id' => $event->user_id,
                    'family_id' => $event->family_id,
                    'title' => $event->title,
                    'type' => $event->type,
                    'description' => $event->description,
                    'starts_at' => $event->starts_at->copy()->addWeek(),
                    'is_official' => $event->is_official,
                    'source' => $event->source,
                    'repeat' => 'weekly',
                ]);
                $count++;
            });

        ClanEvent::query()->where('repeat', 'weekly')->whereNull('spawned_at')->where('starts_at', '<=', now())->get()
            ->each(function (ClanEvent $event) use (&$count) {
                $event->forceFill(['spawned_at' => now()])->save();
                ClanEvent::query()->create([
                    'clan_id' => $event->clan_id,
                    'user_id' => $event->user_id,
                    'title' => $event->title,
                    'description' => $event->description,
                    'starts_at' => $event->starts_at->copy()->addWeek(),
                    'repeat' => 'weekly',
                ]);
                $count++;
            });

        return $count;
    }
}
