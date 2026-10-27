<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** Сховати картку «Тиждень новачка». */
class NewcomerController extends Controller
{
    public function hide(Request $request): RedirectResponse
    {
        $request->user()->mergePref(['newcomer_hidden' => true]);

        return back();
    }
}
