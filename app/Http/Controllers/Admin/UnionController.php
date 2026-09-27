<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\DesignSettings;
use App\Support\FamilyContent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Розділ «Союз» в адмінці — контент union.gamecon.online, перелік
 * зареєстрованих союзників. Скарги й оголошення — у своїх контролерах
 * (UnionComplaintController, UnionAnnouncementController), об'єднані тут
 * лише спільною навігацією (AdminLayout).
 */
class UnionController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Union/Index', [
            'domain' => config('app.union_domain'),
            'content' => [
                'title' => DesignSettings::unionTitle(),
                'tagline' => DesignSettings::unionTagline(),
                'about' => FamilyContent::unionAbout(),
                'rules' => FamilyContent::unionRules(),
                'terms' => FamilyContent::unionTerms(),
            ],
            'members' => User::query()
                ->whereNotNull('union_family_name')
                ->orderBy('union_family_name')
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'union_family_name', 'union_role', 'created_at']),
            'unionRoles' => User::UNION_ROLES,
        ]);
    }

    public function updateContent(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'tagline' => ['nullable', 'string', 'max:255'],
            'about' => ['present', 'array', 'max:12'],
            'about.*' => ['string', 'max:600'],
            'rules' => ['present', 'array', 'max:20'],
            'rules.*' => ['string', 'max:400'],
            'terms' => ['present', 'array', 'max:20'],
            'terms.*' => ['string', 'max:400'],
        ]);

        DesignSettings::saveUnion($data['title'], $data['tagline'] ?? null);
        FamilyContent::save('union_about', $data['about']);
        FamilyContent::save('union_rules', $data['rules']);
        FamilyContent::save('union_terms', $data['terms']);

        return back()->with('status', 'Контент союзу оновлено.');
    }
}
