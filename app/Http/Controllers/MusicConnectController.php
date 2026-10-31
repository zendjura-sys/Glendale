<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Music\MusicConnect;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * GameCon Connect: пристрої користувача звітують, що на них грає (heartbeat), і керують одне одним.
 * Сайт і застосунок (через міст /api/v1/site) ходять сюди однаково.
 */
class MusicConnectController extends Controller
{
    private const DEVICE_ID = ['required', 'string', 'regex:/^[A-Za-z0-9_-]{8,64}$/'];

    public function __construct(private readonly MusicConnect $connect) {}

    public function heartbeat(Request $request): JsonResponse
    {
        $data = $request->validate([
            'device_id' => self::DEVICE_ID,
            'name' => ['required', 'string', 'max:80'],
            'kind' => ['required', Rule::in(['web', 'app'])],
            'state' => ['nullable', 'array'],
            'state.track' => ['nullable', 'array', 'max:40'],
            'state.track.key' => ['required_with:state.track', 'string', 'max:120'],
            'state.track.title' => ['required_with:state.track', 'string', 'max:300'],
            'state.playing' => ['required_with:state', 'boolean'],
            'state.position' => ['nullable', 'numeric', 'min:0', 'max:86400'],
            'state.duration' => ['nullable', 'numeric', 'min:0', 'max:86400'],
            'state.volume' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'state.shuffle' => ['nullable', 'boolean'],
            'state.repeat' => ['nullable', Rule::in(['off', 'all', 'one'])],
            'state.updated_at' => ['nullable', 'string', 'max:40'],
            'state.queue' => ['nullable', 'array', 'max:200'],
            'state.queue.*' => ['array', 'max:40'],
            'state.queue.*.key' => ['required', 'string', 'max:120'],
            'state.index' => ['nullable', 'integer', 'min:0', 'max:199'],
        ]);

        $hasState = $request->has('state');
        $raw = $data['state'] ?? null;
        $state = is_array($raw) ? [
            'track' => $this->card($raw['track'] ?? null),
            'playing' => (bool) $raw['playing'],
            'position' => (float) ($raw['position'] ?? 0),
            'duration' => (float) ($raw['duration'] ?? 0),
            'volume' => (float) ($raw['volume'] ?? 1),
            'shuffle' => (bool) ($raw['shuffle'] ?? false),
            'repeat' => (string) ($raw['repeat'] ?? 'off'),
            'updated_at' => (string) ($raw['updated_at'] ?? ''),
        ] : null;
        $queue = is_array($raw) && isset($raw['queue'])
            ? array_values(array_filter(array_map(fn ($t) => $this->card(is_array($t) ? $t : null), $raw['queue'])))
            : null;

        return response()->json($this->connect->heartbeat(
            $this->user($request),
            ['id' => $data['device_id'], 'name' => $data['name'], 'kind' => $data['kind']],
            $hasState,
            $state,
            $queue,
            isset($raw['index']) ? (int) $raw['index'] : null,
        ));
    }

    public function command(Request $request): JsonResponse
    {
        $data = $request->validate([
            'target_device_id' => self::DEVICE_ID,
            'device_id' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_-]{8,64}$/'],
            'action' => ['required', Rule::in(MusicConnect::ACTIONS)],
            'value' => ['nullable', 'numeric', 'min:0', 'max:86400'],
        ]);

        $sent = $this->connect->command(
            $this->user($request),
            $data['target_device_id'],
            $data['action'],
            isset($data['value']) ? (float) $data['value'] : null,
            $data['device_id'] ?? null,
        );
        abort_unless($sent, 404, 'Пристрій не в мережі.');

        return response()->json(['ok' => true], 202);
    }

    /**
     * Картка треку як її надіслав плеєр — лише прості значення (без вкладених масивів), щоб у кеш не
     * потрапляло зайве.
     *
     * @param  array<array-key, mixed>|null  $track
     * @return array<string, scalar|null>|null
     */
    private function card(?array $track): ?array
    {
        if ($track === null || ! isset($track['key'])) {
            return null;
        }

        $card = [];
        foreach ($track as $key => $value) {
            if (is_string($key) && (is_scalar($value) || $value === null) && (! is_string($value) || mb_strlen($value) <= 2000)) {
                $card[$key] = $value;
            }
        }

        return $card;
    }

    private function user(Request $request): User
    {
        /** @var User */
        return $request->user();
    }
}
