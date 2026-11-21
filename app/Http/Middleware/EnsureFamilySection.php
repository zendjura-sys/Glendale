<?php

namespace App\Http\Middleware;

use App\Models\Family;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Розділ сім’ї, який лідер вимкнув у налаштуваннях («Розділи сім’ї»), відповідає 404 —
 * і сторінка, і всі дії в ньому (сайт і застосунок).
 */
class EnsureFamilySection
{
    public function handle(Request $request, Closure $next, string $section): Response
    {
        $family = $request->route('family');
        if ($family instanceof Family) {
            abort_unless($family->sectionEnabled($section), 404, 'Цей розділ у сім’ї вимкнено.');
        }

        return $next($request);
    }
}
