<?php

namespace App\Families;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Інструменти родини (звіти, банк, цілі…) — лише для учасників активної
 * родини. Хто ще не в родині — у каталог «Моя родина»: знайти свою чи
 * зареєструвати.
 */
class EnsureFamilyMember
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && (FamilyContext::isMember($user) || $user->can('families.manage'))) {
            return $next($request);
        }
        if ($request->expectsJson()) {
            return response()->json(['message' => 'Інструменти родини доступні учасникам родини.', 'code' => 'no_family'], 403);
        }

        return redirect('/families')->with('status', 'Інструменти родини доступні її учасникам — знайдіть свою родину або зареєструйте нову.');
    }
}
