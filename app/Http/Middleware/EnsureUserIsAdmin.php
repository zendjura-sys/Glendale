<?php

namespace App\Http\Middleware;

use App\Support\Staff\StaffRoles;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    /** Адміністратору — уся адмінка; модератору — лише доручені розділи (ролі команди). */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        abort_if($user === null, 403);
        if ($user->isAdmin()) {
            return $next($request);
        }
        $section = StaffRoles::sectionOf($request);
        $allowed = StaffRoles::sections($user);
        // Головна адмінки — перший доручений розділ.
        if ($section === null && $allowed !== [] && $request->isMethod('GET')) {
            return redirect('/admin/'.$allowed[0]);
        }
        abort_unless(StaffRoles::allows($user, $section), 403);

        return $next($request);
    }
}
