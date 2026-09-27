<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Addon;
use App\Models\User;
use App\Support\FamilyStats;
use App\Support\ShellNav;
use App\Support\SystemHealth;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('Admin/Dashboard/Index', [
            // Плитки розділів — той самий список, що й у боковому меню
            // й мобільних чіпах (App\Support\ShellNav), тож нову сторінку
            // адмінки досить додати в одному місці.
            'groups' => ShellNav::tiles($request, $request->user()),
            'stats' => [
                'members' => User::query()->count(),
                'roles' => Role::query()->count(),
                'activeAddons' => Addon::query()->where('status', 'active')->count(),
            ],
            // Технічні показники бачить лише той, хто й так керує
            // налаштуваннями сайту — не варто чіпати модератору звітів.
            'health' => $request->user()->can('settings.manage') ? [
                'failedJobs' => SystemHealth::failedJobsCount(),
                'queuedJobs' => SystemHealth::queuedJobsCount(),
                'disk' => SystemHealth::disk(),
                'lastBackupAt' => SystemHealth::lastBackupAt()?->toIso8601String(),
            ] : null,
            // Той самий гейт, що й health: редактор того, ЩО показує
            // головна сторінка — частина керування сайтом, а не модерації.
            'familyStats' => $request->user()->can('settings.manage') ? [
                'available' => FamilyStats::available(),
                'selectedKeys' => FamilyStats::selectedKeys(),
            ] : null,
        ]);
    }

    public function updateFamilyStats(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'keys' => ['present', 'array'],
            'keys.*' => ['string'],
        ]);

        FamilyStats::save($data['keys']);

        return back()->with('status', 'Статистику головної сторінки оновлено.');
    }
}
