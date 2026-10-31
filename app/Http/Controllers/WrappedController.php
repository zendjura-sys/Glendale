<?php

namespace App\Http\Controllers;

use App\Services\Wrapped\YearInReview;
use App\Support\Plugins\Plugins;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** «Підсумки року» — сторінка-історія з картками про рік людини в GameCon. */
class WrappedController extends Controller
{
    public function __construct(private readonly YearInReview $review, private readonly Plugins $plugins) {}

    public function show(Request $request): Response
    {
        $this->plugins->ensure('wrapped');
        $user = $request->user();
        $year = $this->review->yearFor($user);

        return Inertia::render('wrapped', [
            // null — ще не сезон: сторінка каже, коли з’являться підсумки.
            'wrapped' => $year === null ? null : $this->review->build($user, $year),
            'opens_at' => now()->month(12)->startOfMonth()->toDateString(),
            'preview' => $this->review->season() === null && $year !== null,
        ]);
    }
}
