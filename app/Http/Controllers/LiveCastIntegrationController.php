<?php

namespace App\Http\Controllers;

use App\Models\LivecastIntegration;
use App\Services\LiveCast\DonatelloClient;
use App\Services\LiveCast\DonatikClient;
use App\Support\LiveCast\DonationPresets;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Налаштування API Donatik / Donatello для LiveCast (сторінка донатів, токен, колбек).
 */
class LiveCastIntegrationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        app(Plugins::class)->ensure('livecast');
        $rows = LivecastIntegration::query()
            ->where('user_id', $request->user()->id)
            ->get()
            ->keyBy('provider');

        $items = [];
        foreach (DonationPresets::all() as $preset) {
            /** @var LivecastIntegration|null $row */
            $row = $rows->get($preset['key']);
            $items[] = [
                'provider' => $preset['key'],
                'name' => $preset['name'],
                'placeholder' => $preset['placeholder'],
                'page_url' => $row?->page_url,
                'has_api_token' => filled($row?->api_token),
                'has_webhook_key' => filled($row?->webhook_key),
                'webhook_url' => $row?->webhookUrl(),
                'hook_id' => $row?->hook_id,
                'docs' => $preset['key'] === 'donatello'
                    ? 'https://donatello.to/panel/doc-api?tab=callbacks'
                    : 'https://donatik.ua/',
            ];
        }

        return response()->json(['integrations' => $items, 'presets' => DonationPresets::all()]);
    }

    public function update(Request $request, string $provider): JsonResponse
    {
        app(Plugins::class)->ensure('livecast');
        abort_unless(DonationPresets::find($provider) !== null, 404);

        $data = $request->validate([
            'page_url' => ['nullable', 'string', 'max:500'],
            'api_token' => ['nullable', 'string', 'max:500'],
            'webhook_key' => ['nullable', 'string', 'max:200'],
            'clear_api_token' => ['sometimes', 'boolean'],
            'clear_webhook_key' => ['sometimes', 'boolean'],
        ]);

        $pageUrl = null;
        if (array_key_exists('page_url', $data)) {
            $raw = trim((string) ($data['page_url'] ?? ''));
            if ($raw !== '') {
                $urls = DonationPresets::sanitize([['provider' => $provider, 'url' => $raw]]);
                if ($urls === []) {
                    return response()->json(['message' => 'Невірне посилання для '.$provider], 422);
                }
                $pageUrl = $urls[0]['url'];
            }
        }

        $row = LivecastIntegration::query()->firstOrNew([
            'user_id' => $request->user()->id,
            'provider' => $provider,
        ]);
        if (! $row->exists) {
            $row->hook_id = LivecastIntegration::newHookId();
        }
        if (array_key_exists('page_url', $data)) {
            $row->page_url = $pageUrl;
        }
        if (! empty($data['clear_api_token'])) {
            $row->api_token = null;
        } elseif (array_key_exists('api_token', $data) && filled($data['api_token'])) {
            $row->api_token = $data['api_token'];
        }
        if (! empty($data['clear_webhook_key'])) {
            $row->webhook_key = null;
        } elseif (array_key_exists('webhook_key', $data) && filled($data['webhook_key'])) {
            $row->webhook_key = $data['webhook_key'];
        }
        $row->save();

        return $this->index($request);
    }

    public function test(Request $request, string $provider): JsonResponse
    {
        app(Plugins::class)->ensure('livecast');
        $row = LivecastIntegration::query()
            ->where('user_id', $request->user()->id)
            ->where('provider', $provider)
            ->first();
        abort_unless($row && filled($row->api_token), 422, 'Спочатку збережіть API-токен.');

        if ($provider === LivecastIntegration::DONATELLO) {
            $client = new DonatelloClient((string) $row->api_token);
            $me = $client->me();
            abort_unless($me['ok'], 422, $me['message'] ?? 'Donatello відхилив токен');

            return response()->json(['ok' => true, 'provider' => $provider, 'me' => $me]);
        }

        $client = new DonatikClient((string) $row->api_token);
        $ping = $client->ping();
        abort_unless($ping['ok'], 422, $ping['message'] ?? 'Donatik відхилив токен');

        return response()->json(['ok' => true, 'provider' => $provider, 'ping' => $ping]);
    }
}
