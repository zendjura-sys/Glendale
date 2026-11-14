<?php

namespace App\Http\Controllers;

use App\Services\Engagement\LoginRewards;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Календар нагород за щоденний вхід. */
class LoginRewardController extends Controller
{
    public function __construct(private readonly LoginRewards $rewards) {}

    public function index(Request $request): Response
    {
        return Inertia::render('rewards/index', [
            ...$this->rewards->board($request->user()),
            'got' => $request->session()->get('reward_got'),
        ]);
    }

    public function claim(Request $request): RedirectResponse
    {
        $reward = $this->rewards->claim($request->user());

        return back()->with('reward_got', $reward);
    }
}
