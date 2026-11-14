<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DeveloperApp;
use App\Models\DeveloperToken;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

/** Адмінка → Застосунки розробників: перелік, блокування й розблокування (у журналі). */
class DeveloperAppsController extends Controller
{
    public function index(): Response
    {
        $apps = DeveloperApp::query()->with('user:id,name,username')->latest('id')->paginate(30)
            ->through(fn (DeveloperApp $a) => [
                'id' => $a->id,
                'name' => $a->name,
                'website' => $a->website,
                'client_id' => $a->client_id,
                'owner' => ['name' => $a->user->name, 'username' => $a->user->username],
                'scopes' => $a->scopes,
                'users' => DeveloperToken::query()->where('developer_app_id', $a->id)->whereNull('revoked_at')->distinct()->count('user_id'),
                'last_used_at' => DeveloperToken::query()->where('developer_app_id', $a->id)->max('last_used_at'),
                'blocked' => $a->blocked(),
                'blocked_reason' => $a->blocked_reason,
                'created_at' => $a->created_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/developer-apps', ['apps' => $apps]);
    }

    public function block(Request $request, DeveloperApp $app): RedirectResponse
    {
        $data = $request->validate(['blocked' => ['required', 'boolean'], 'reason' => ['nullable', 'string', 'max:200']]);
        $app->forceFill(['blocked_at' => $data['blocked'] ? now() : null, 'blocked_reason' => $data['blocked'] ? ($data['reason'] ?? null) : null])->save();
        if ($data['blocked']) {
            DeveloperToken::query()->where('developer_app_id', $app->id)->update(['revoked_at' => now()]);
        }
        Log::info('admin.developer_app.block', ['by' => $request->user()->id, 'app' => $app->id, 'blocked' => $data['blocked'], 'reason' => $data['reason'] ?? null]);

        return back()->with('success', $data['blocked'] ? 'Застосунок заблоковано, токени відкликано.' : 'Застосунок розблоковано.');
    }
}
