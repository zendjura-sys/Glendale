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
    /**
     * Групи адмінки: [назва групи, [[маршрут, підпис, дозвіл|null, іконка, опис], …]].
     * Один список — і для бокового меню/чіпів (label+icon), і для плиток
     * на головній сторінці адмінки (+description): нову сторінку досить
     * додати сюди раз, і вона одразу з'явиться скрізь.
     */
    private const ADMIN = [
        ['Огляд', [
            ['admin.dashboard', 'Панель керування', null, 'dashboard', 'Загальна статистика й стан сервера.'],
        ]],
        ['Модерація', [
            ['admin.families.index', 'Родини та союзи', 'families.manage', 'crown', 'Розгляд заявок на реєстрацію родин і союзів.'],
            ['admin.reports.index', 'Звіти', 'reports.manage', 'scroll', 'Розгляд звітів учасників за бізварами та контрактами.'],
            ['admin.users.index', 'Учасники', 'users.manage', 'users', 'Список учасників сайту та призначення їм ролей.'],
            ['admin.members.index', 'Кадровий облік', 'members.manage', 'idcard', 'Статуси учасників, кадрові нотатки та заявки на відпустку.'],
            ['admin.discipline.index', 'Покарання', 'members.manage', 'scale', 'Догани, штрафи та інші дисциплінарні рішення.'],
        ]],
        ['Родина', [
            ['admin.progression.index', 'Прогресія', 'progression.manage', 'trending', 'Досвід, ранги, досягнення та тижневі бонуси родини.'],
            ['admin.family-goals.index', 'Цілі родини', 'goals.manage', 'target', 'Спільні цілі з прогресом та стрічка активності.'],
            ['admin.family-events.index', 'Події', 'events.manage', 'calendar', 'Календар родини й кіновечори.'],
            ['admin.bonuses.index', 'Банк', 'bonuses.manage', 'wallet', 'Ставки, тіри інвестицій та історія виплат.'],
            ['admin.broadcasts.index', 'Розсилки', 'broadcasts.manage', 'megaphone', 'Оголошення учасникам — кожен отримує сповіщення.'],
        ]],
        ['Контент', [
            ['admin.cinema.index', 'Кінопортал', 'cinema.manage', 'film', 'Ключі TMDB і Kodik, імпорт фільмів та серіалів.'],
        ]],
        ['Союз', [
            ['admin.union.index', 'Контент і союзники', 'union.manage', 'handshake', 'Головна союзу, правила й список родин-союзників.'],
            ['admin.union.complaints.index', 'Скарги', 'union.manage', 'scroll', 'Скарги гравців на розгляд адміністрації союзу.'],
            ['admin.union.announcements.index', 'Оголошення', 'union.manage', 'megaphone', 'Новини на головній сторінці союзу.'],
            ['admin.union.blacklist.index', 'Чорний список', 'union.manage', 'shieldoff', 'Заблоковані родини й гравці.'],
            ['admin.union.addons.index', 'Аддони союзу', 'union.manage', 'blocks', 'Модулі, доступні лише на домені союзу.'],
        ], 'union'],
        ['Система', [
            ['admin.addons.index', 'Аддони', 'addons.manage', 'blocks', 'Core, модулі й теми — завантаження ZIP-пакетів.'],
            ['admin.roles.index', 'Права доступу', 'roles.manage', 'shield', 'Ролі та права: хто що бачить і чим керує.'],
            ['admin.design.index', 'Оформлення', 'settings.manage', 'palette', 'Фірмові кольори й логотип сайту.'],
            ['admin.changelog.index', 'Що нового', 'settings.manage', 'history', 'Стрічка змін, яку бачать учасники.'],
            ['admin.failed-jobs.index', 'Провалені задачі', 'settings.manage', 'alert', 'Черга: що не виконалось і чому.'],
            ['admin.settings.index', 'Налаштування', 'settings.manage', 'settings', 'Загальні параметри сайту та інтеграції.'],
        ]],
    ];

    /** @return array{mode:string, admin:list<array{label:string, items:list<array{href:string,label:string,icon:string,active:bool}>}>} */
    public static function for(Request $request, ?User $user): array
    {
        $admin = $request->is('admin') || $request->is('admin/*');

        return ['mode' => $admin ? 'admin' : 'app', 'admin' => $admin && $user ? self::admin($request, $user) : []];
    }

    /** Ті самі групи — плитками на головній сторінці адмінки (без «Огляду», бо ми вже там). */
    public static function tiles(Request $request, User $user): array
    {
        return array_values(array_filter(self::admin($request, $user), fn (array $g) => $g['label'] !== 'Огляд'));
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
            foreach ($items as [$name, $title, $permission, $icon, $description]) {
                if (! Route::has($name) || ($permission !== null && ! $user->can($permission))) {
                    continue;
                }
                // admin.families.index активний і на admin.families.* (вкладені сторінки розділу).
                $prefix = preg_replace('/\.index$/', '', $name);
                $visible[] = [
                    'href' => route($name, absolute: false),
                    'label' => $title,
                    'icon' => $icon,
                    'description' => $description,
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
