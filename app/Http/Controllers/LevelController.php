<?php

namespace App\Http\Controllers;

use App\Services\Profile\ProfileLevel;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Рівень профілю: досвід, звідки він, назви рівнів і нагороди за віхи. */
class LevelController extends Controller
{
    public function index(Request $request, ProfileLevel $levels): Response
    {
        return Inertia::render('level/index', $levels->page($request->user()));
    }
}
