<?php

namespace App\Services\Shifts;

use App\Models\Clan;
use App\Models\ClanShift;
use App\Models\Family;
use App\Models\FamilyShift;
use App\Notifications\EventReminder;

/**
 * Нагадування за годину до зміни (сім’ї й клани), якщо в налаштуваннях групи воно увімкнене.
 * Кожна зміна нагадує лише раз (reminded_at).
 */
class ShiftReminders
{
    public function remind(): int
    {
        $sent = 0;
        $window = [now(), now()->addHour()];

        FamilyShift::query()->with('member.user')->whereNull('reminded_at')->whereNotNull('member_id')
            ->whereBetween('starts_at', $window)->limit(500)->get()
            ->each(function (FamilyShift $s) use (&$sent) {
                $s->forceFill(['reminded_at' => now()])->save();
                $family = Family::query()->find($s->family_id);
                $user = $s->member?->user;
                if ($family === null || $user === null || ! $family->sectionEnabled('shifts') || ! $family->setting('shifts.remind', true)) {
                    return;
                }
                $user->notify(new EventReminder(
                    'Зміна «'.$s->title.'» о '.$s->starts_at->timezone('Europe/Kyiv')->format('H:i').' — '.$family->name,
                    '/f/'.$family->slug.'/shifts',
                    $family->id,
                ));
                $sent++;
            });

        ClanShift::query()->with('user')->whereNull('reminded_at')->whereNotNull('user_id')
            ->whereBetween('starts_at', $window)->limit(500)->get()
            ->each(function (ClanShift $s) use (&$sent) {
                $s->forceFill(['reminded_at' => now()])->save();
                $clan = Clan::query()->find($s->clan_id);
                if ($clan === null || $s->user === null || ! $clan->hasFeature('shifts') || ! $clan->setting('shifts_remind')) {
                    return;
                }
                $s->user->notify(new EventReminder(
                    'Зміна «'.$s->title.'» о '.$s->starts_at->timezone('Europe/Kyiv')->format('H:i').' — '.$clan->name,
                    '/clans/'.$clan->slug.'?tab=shifts',
                ));
                $sent++;
            });

        return $sent;
    }
}
