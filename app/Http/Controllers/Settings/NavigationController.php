<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Modules\ModuleManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Нижня панель на телефоні: які розділи закріплені поруч із «Меню» (спільно для сайту й застосунку).
 */
class NavigationController extends Controller
{
    public function __construct(private readonly ModuleManager $modules) {}

    public function edit(): Response
    {
        return Inertia::render('settings/navigation', [
            'defaults' => User::DEFAULT_NAV,
            'max' => User::MAX_NAV,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'tabs' => ['required', 'array', 'min:1', 'max:'.User::MAX_NAV],
            'tabs.*' => ['string', 'distinct', Rule::in(array_column($this->modules->navigation(), 'key'))],
        ], [
            'tabs.max' => 'У панелі поміщається не більше '.User::MAX_NAV.' розділів.',
            'tabs.min' => 'Залиште в панелі хоча б один розділ.',
            'tabs.*.in' => 'Цей розділ недоступний.',
        ]);

        $tabs = array_values($data['tabs']);
        $request->user()->forceFill(['nav_tabs' => $tabs === User::DEFAULT_NAV ? null : $tabs])->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Нижню панель оновлено.']);

        return back();
    }
}
