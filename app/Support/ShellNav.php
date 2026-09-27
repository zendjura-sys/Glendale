<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/**
 * Єдина оболонка сайту (React: шапка, бокове меню, нижня панель) — і на
 * сторінках соцмережі, і на сторінках Vue. Тут — що саме вона показує на
 * сторінці Vue: звичайне меню чи меню адмінки, й пункти адмінки з
 * урахуванням прав (ті самі, що в HandleInertiaRequests::share()['can']).
 */
final class ShellNav
{
    /** Групи адмінки: [назва групи, [[маршрут, підпис, дозвіл|null, іконка], …]]. */
    private const ADMIN = [
        ['Огляд', [
            ['admin.dashboard', 'Панель керування', null, 'dashboard'],
        ]],
        ['Модерація', [
            ['admin.families.index', 'Родини та союзи', 'families.manage', 'crown'],
            ['admin.reports.index', 'Звіти', 'reports.manage', 'scroll'],
            ['admin.users.index', 'Учасники', 'users.manage', 'users'],
            ['admin.members.index', 'Кадровий облік', 'members.manage', 'idcard'],
            ['admin.discipline.index', 'Покарання', 'members.manage', 'scale'],
        ]],
        ['Родина', [
            ['admin.family-profile.index', 'Профіль родини', 'members.manage', 'crown'],
            ['admin.progression.index', 'Прогресія', 'progression.manage', 'trending'],
            ['admin.family-goals.index', 'Цілі родини', 'goals.manage', 'target'],
            ['admin.family-events.index', 'Події', 'events.manage', 'calendar'],
            ['admin.bonuses.index', 'Банк', 'bonuses.manage', 'wallet'],
            ['admin.broadcasts.index', 'Розсилки', 'broadcasts.manage', 'megaphone'],
        ]],
        ['Контент', [
            ['admin.cinema.index', 'Кінопортал', 'cinema.manage', 'film'],
        ]],
        ['Союз', [
            ['admin.union.index', 'Контент і союзники', 'union.manage', 'handshake'],
            ['admin.union.complaints.index', 'Скарги', 'union.manage', 'scroll'],
            ['admin.union.announcements.index', 'Оголошення', 'union.manage', 'megaphone'],
            ['admin.union.blacklist.index', 'Чорний список', 'union.manage', 'shieldoff'],
            ['admin.union.addons.index', 'Аддони союзу', 'union.manage', 'blocks'],
        ], 'union'],
        ['Система', [
            ['admin.addons.index', 'Аддони', 'addons.manage', 'blocks'],
            ['admin.roles.index', 'Права доступу', 'roles.manage', 'shield'],
            ['admin.design.index', 'Оформлення', 'settings.manage', 'palette'],
            ['admin.changelog.index', 'Що нового', 'settings.manage', 'history'],
            ['admin.failed-jobs.index', 'Провалені задачі', 'settings.manage', 'alert'],
            ['admin.settings.index', 'Налаштування', 'settings.manage', 'settings'],
        ]],
    ];

    /** @return array{mode:string, admin:list<array{label:string, items:list<array{href:string,label:string,icon:string,active:bool}>}>} */
    public static function for(Request $request, ?User $user): array
    {
        $admin = $request->is('admin') || $request->is('admin/*');

        return ['mode' => $admin ? 'admin' : 'app', 'admin' => $admin && $user ? self::admin($request, $user) : []];
    }

    private static function admin(Request $request, User $user): array
    {
        $current = Route::currentRouteName() ?? '';
        $groups = [];
        foreach (self::ADMIN as $group) {
            [$label, $items] = $group;
            if (($group[2] ?? null) === 'union' && ! config('app.union_domain')) {
                continue;
            }
            $visible = [];
            foreach ($items as [$name, $title, $permission, $icon]) {
                if (! Route::has($name) || ($permission !== null && ! $user->can($permission))) {
                    continue;
                }
                // admin.families.index активний і на admin.families.* (вкладені сторінки розділу).
                $prefix = preg_replace('/\.index$/', '', $name);
                $visible[] = [
                    'href' => route($name, absolute: false),
                    'label' => $title,
                    'icon' => $icon,
                    'active' => $current === $name || ($prefix !== $name && str_starts_with($current, $prefix.'.')),
                ];
            }
            if ($visible) {
                $groups[] = ['label' => $label, 'items' => $visible];
            }
        }

        return $groups;
    }

    /** Сторінки Vue без оболонки: вхід/реєстрація, публічна головна, домен союзу. */
    public static function enabled(Request $request, array $page): bool
    {
        $component = (string) ($page['component'] ?? '');

        return $request->user() !== null
            && ! str_starts_with($component, 'Auth/')
            && ! str_starts_with($component, 'Union/')
            && $component !== 'Home'
            && ! UnionDomain::matches($request);
    }
}
