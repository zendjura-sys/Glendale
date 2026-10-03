<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function __construct(private readonly SiteSettings $settings) {}

    public function edit(): Response
    {
        return Inertia::render('admin/settings', [
            'settings' => $this->settings->public(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'site_name' => ['required', 'string', 'max:60'],
            'tagline' => ['nullable', 'string', 'max:140'],
            'seo_description' => ['nullable', 'string', 'max:300'],
            'play_store_enabled' => ['boolean'],
            'play_store_url' => ['nullable', 'string', 'max:300', 'url:http,https'],
            'play_store_badge' => ['nullable', 'in:get,preregister'],
            'registration_open' => ['boolean'],
            'email_verification' => ['boolean'],
            'max_post_length' => ['required', 'integer', 'min:100', 'max:50000'],
            'max_attachments' => ['required', 'integer', 'min:1', 'max:30'],
            'max_upload_mb' => ['required', 'integer', 'min:1', 'max:200'],
            'max_message_file_mb' => ['required', 'integer', 'min:1', 'max:500'],
            'music_max_track_mb' => ['required', 'integer', 'min:1', 'max:500'],
            'maintenance_message' => ['nullable', 'string', 'max:500'],
        ]);

        $this->settings->put($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування збережено.']);

        return back();
    }
}
