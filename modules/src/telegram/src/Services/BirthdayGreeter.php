<?php

namespace Addons\TelegramBot\Services;

use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Щоденна перевірка "у кого сьогодні день народження" — birth_date учасник
 * заповнює сам у профілі (за бажанням, ProfileController::updateBirthday),
 * рік не має значення, дивимось лише місяць+день.
 *
 * Одне повідомлення на всіх, у кого сьогодні день, а не по одному — на
 * випадок, якщо день народження в кількох учасників збігається.
 */
class BirthdayGreeter
{
    public function greetToday(): void
    {
        $today = Carbon::now('Europe/Kyiv');

        $users = User::query()->inActiveFamily()
            ->whereNotNull('birth_date')
            ->whereMonth('birth_date', $today->month)
            ->whereDay('birth_date', $today->day)
            ->get(['id', 'name']);

        if ($users->isEmpty()) {
            return;
        }

        $client = new TelegramClient();
        $familyGroup = new FamilyGroup($client);
        if (! $familyGroup->isConfigured()) {
            return;
        }

        $names = $users->map(fn (User $u) => '<b>'.e($u->name).'</b>')->implode(', ');
        $text = $users->count() === 1
            ? "🎉  Сьогодні день народження святкує {$names}!\n\nВітаємо й бажаємо всього найкращого від усієї родини! 🥂"
            : "🎉  Сьогодні день народження святкують {$names}!\n\nВітаємо й бажаємо всього найкращого від усієї родини! 🥂";

        $client->sendMessage($familyGroup->id(), $text);
    }
}
