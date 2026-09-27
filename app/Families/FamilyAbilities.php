<?php

namespace App\Families;

/**
 * Права на інструменти родини, які лідер і заступники мають у СВОЇЙ
 * активній родині (без ролі адміністратора платформи). Платформні права
 * (користувачі сайту, ролі, аддони, налаштування, Telegram-бот) — ні.
 */
final class FamilyAbilities
{
    public const MANAGER = [
        'reports.manage',
        'bonuses.manage',
        'events.manage',
        'goals.manage',
        'members.manage',
        'broadcasts.manage',
        'progression.manage',
    ];
}
