<?php

namespace App\Services\Servers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Публічний API запрошень Discord: назва, іконка й кількість учасників без токена бота.
 */
class DiscordInvites
{
    /**
     * «discord.gg/abc», «https://discord.com/invite/abc» або «abc» → «abc».
     */
    public static function code(?string $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }
        if (preg_match('#(?:discord(?:app)?\.(?:gg|com|io|me)/(?:invite/)?)([A-Za-z0-9-]{2,64})#i', $value, $m)) {
            return $m[1];
        }

        return preg_match('/^[A-Za-z0-9-]{2,64}$/', $value) ? $value : null;
    }

    /**
     * @return array{guild_id: string, name: string, icon: string|null, members: int|null, online: int|null}|null
     */
    public function lookup(string $code): ?array
    {
        return Cache::remember('discord.invite.'.$code, now()->addMinutes(30), function () use ($code) {
            try {
                $response = Http::timeout(10)->acceptJson()
                    ->get('https://discord.com/api/v10/invites/'.rawurlencode($code), ['with_counts' => 'true']);
            } catch (Throwable) {
                return null;
            }
            $guild = $response->json('guild');
            if (! $response->successful() || ! is_array($guild) || ! isset($guild['id'])) {
                return null;
            }

            return [
                'guild_id' => (string) $guild['id'],
                'name' => (string) ($guild['name'] ?? ''),
                'icon' => isset($guild['icon']) && is_string($guild['icon'])
                    ? "https://cdn.discordapp.com/icons/{$guild['id']}/{$guild['icon']}.png?size=256"
                    : null,
                'members' => is_numeric($response->json('approximate_member_count')) ? (int) $response->json('approximate_member_count') : null,
                'online' => is_numeric($response->json('approximate_presence_count')) ? (int) $response->json('approximate_presence_count') : null,
            ];
        });
    }

    public function icon(string $code): ?string
    {
        return $this->lookup($code)['icon'] ?? null;
    }
}
