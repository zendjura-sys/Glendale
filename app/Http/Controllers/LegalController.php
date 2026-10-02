<?php

namespace App\Http\Controllers;

use App\Support\Legal\Documents;
use Inertia\Inertia;
use Inertia\Response;

class LegalController extends Controller
{
    public function policy(Documents $documents): Response
    {
        return Inertia::render('legal/show', $documents->policy());
    }

    public function terms(Documents $documents): Response
    {
        return Inertia::render('legal/show', $documents->terms());
    }

    public function safety(Documents $documents): Response
    {
        return Inertia::render('legal/show', $documents->safety());
    }
}
