<?php

namespace App\Http\Controllers;

use App\Models\UnionAnnouncement;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Особистий кабінет союзу — те, що бачить на /dashboard кожен, хто
 * зайшов на union.gamecon.online (авторизація спільна з рештою сайту,
 * маршрут той самий: routes/web.php вирішує, кому яку сторінку віддати,
 * за ПОТОЧНИМ ДОМЕНОМ, дивись UnionDomain). Тому сюди може потрапити і
 * звичайний учасник родини Monsory (union_family_name порожнє) — блок
 * "своя родина" тоді просто порожній, решта (союз загалом, оголошення)
 * лишається видимою всім. Профіль і форми редагування — ProfileController,
 * тут лише огляд.
 */
class UnionCabinetController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        // where('union_family_name', null) Laravel сам перетворює на
        // "IS NULL" — без цієї явної перевірки роль'я Monsory-учасника
        // (яка теж null) підхопила б у "родину" усіх ІНШИХ Monsory-
        // учасників, а не порожній список.
        $familyMembers = $user->union_family_name === null
            ? collect()
            : User::query()
                ->where('union_family_name', $user->union_family_name)
                ->orderByRaw("case when union_role = 'leader' then 0 when union_role = 'deputy' then 1 else 2 end")
                ->orderBy('name')
                ->get(['id', 'name', 'union_role', 'created_at']);

        return Inertia::render('Union/Cabinet', [
            'family' => [
                'name' => $user->union_family_name,
                'members' => $familyMembers,
            ],
            'unionStats' => [
                'families' => User::query()->whereNotNull('union_family_name')->distinct('union_family_name')->count('union_family_name'),
                'members' => User::query()->whereNotNull('union_family_name')->count(),
            ],
            'announcements' => UnionAnnouncement::query()
                ->where('published_at', '<=', now())
                ->with('author:id,name')
                ->orderByDesc('published_at')
                ->limit(10)
                ->get(),
        ]);
    }
}
