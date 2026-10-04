<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class LegalController extends Controller
{
    public function terms(): Response
    {
        return Inertia::render('legal', ['document' => 'terms']);
    }

    public function privacy(): Response
    {
        return Inertia::render('legal', ['document' => 'privacy']);
    }
}
