<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * union.gamecon.online (UNION_DOMAIN) — той самий застосунок/база/логін,
 * що й gamecon.online, різниться лише те, ЩО рендериться. Хто саме бачить
 * союзну версію сторінки (реєстрація, кабінет) вирішує ПОТОЧНИЙ ДОМЕН,
 * а не тип акаунту: учасник родини, який зайшов на union.gamecon.online,
 * бачить кабінет союзу так само, як союзник, що зайшов на gamecon.online,
 * бачить звичайний кабінет родини.
 */
class UnionDomain
{
    public static function matches(Request $request): bool
    {
        $domain = config('app.union_domain');

        return $domain && $request->getHost() === $domain;
    }
}
