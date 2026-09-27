<?php

namespace App\Http\Middleware;

use App\Support\DesignSettings;
use App\Support\UnreadCounters;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
            ],
            // Оформление задаётся в админке (Дизайн), а не собирается в
            // бандл, поэтому уезжает на фронт с каждым ответом.
            'design' => DesignSettings::all(),
            // Публічний VAPID-ключ потрібен клієнту для pushManager.subscribe();
            // приватний ключ на фронт ніколи не потрапляє. null, поки не
            // налаштовано в .env — форма підписки просто себе ховає.
            'webPushPublicKey' => config('webpush.vapid.public_key'),
            // Пункт «Союз» у навігації адмінки ховається, поки фіча вимкнена
            // (UNION_DOMAIN порожній) — так само, як сам union.gamecon.online.
            'unionEnabled' => (bool) config('app.union_domain'),
            'flash' => [
                'status' => fn () => $request->session()->get('status'),
            ],
            'can' => [
                'manageAddons' => $request->user()?->can('addons.manage') ?? false,
                'manageReports' => $request->user()?->can('reports.manage') ?? false,
                'manageProgression' => $request->user()?->can('progression.manage') ?? false,
                'manageSettings' => $request->user()?->can('settings.manage') ?? false,
                'manageRoles' => $request->user()?->can('roles.manage') ?? false,
                'manageUsers' => $request->user()?->can('users.manage') ?? false,
                'manageMembers' => $request->user()?->can('members.manage') ?? false,
                'manageGoals' => $request->user()?->can('goals.manage') ?? false,
                'manageBroadcasts' => $request->user()?->can('broadcasts.manage') ?? false,
                'manageTelegram' => $request->user()?->can('telegram.manage') ?? false,
                'manageBonuses' => $request->user()?->can('bonuses.manage') ?? false,
                'manageEvents' => $request->user()?->can('events.manage') ?? false,
                'manageUnion' => $request->user()?->can('union.manage') ?? false,
                'manageFamilies' => $request->user()?->can('families.manage') ?? false,
            ],
            // Бейдж у навігації видно з будь-якої сторінки, тому лічильник
            // рахується тут, а не в NotificationController — той бачить
            // "непрочитане" лише той, хто вже й так відкрив "Сповіщення".
            // Через таблицю, а не Addons\Notifications\Models\Notification:
            // ядро ніде не імпортує класи аддонів (лише Settings/permissions
            // як спільні джерела), і Schema::hasTable() рятує від помилки,
            // якщо модуль Notifications ще не встановлено взагалі.
            'unreadNotifications' => $this->unreadNotificationsCount($request),
            'unreadMessages' => $this->unreadMessagesCount($request),
        ];
    }

    private function unreadNotificationsCount(Request $request): int
    {
        return $request->user() ? UnreadCounters::notifications($request->user()->id) : 0;
    }

    private function unreadMessagesCount(Request $request): int
    {
        return $request->user() ? UnreadCounters::messages($request->user()->id) : 0;
    }
}
