<?php

namespace App\Services\Presence;

use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

/**
 * Steam: у що людина грає зараз (GetPlayerSummaries) → статус «Граю в…».
 * Профіль і «Деталі гри» в Steam мають бути відкриті.
 */
class SteamPresence
{
    /** Скільки хвилин діє статус без підтвердження (опитуємо що дві хвилини). */
    public const MINUTES = 5;

    public function __construct(
        private readonly SiteSettings $settings,
        private readonly PlayingStatus $status,
    ) {}

    public function key(): ?string
    {
        $value = $this->settings->secret('steam_api_key') ?? config('services.steam.key');

        return is_string($value) && $value !== '' ? $value : null;
    }

    public function configured(): bool
    {
        return $this->key() !== null;
    }

    /** Перевірка ключа з адмінки (публічний профіль Valve). */
    public function test(): bool
    {
        return $this->summaries(['76561197960287930']) !== null;
    }

    /**
     * Прив’язати профіль: SteamID64, посилання /profiles/{id} або /id/{нік}.
     */
    public function link(User $user, string $profile): string
    {
        $profile = trim($profile);
        $id = null;
        if (preg_match('/^\d{17}$/', $profile) === 1) {
            $id = $profile;
        } elseif (preg_match('#steamcommunity\.com/profiles/(\d{17})#', $profile, $m) === 1) {
            $id = $m[1];
        } else {
            $vanity = preg_match('#steamcommunity\.com/id/([A-Za-z0-9_\-]{2,32})#', $profile, $m) === 1 ? $m[1] : (preg_match('/^[A-Za-z0-9_\-]{2,32}$/', $profile) === 1 ? $profile : null);
            $id = $vanity !== null ? $this->resolve($vanity) : null;
        }
        if ($id === null) {
            throw ValidationException::withMessages(['steam' => 'Не вдалося знайти профіль Steam. Вставте посилання на свій профіль.']);
        }
        if (User::query()->where('steam_id', $id)->whereKeyNot($user->id)->exists()) {
            throw ValidationException::withMessages(['steam' => 'Цей профіль Steam уже прив’язаний до іншого акаунта.']);
        }
        $user->forceFill(['steam_id' => $id])->save();

        return $id;
    }

    public function unlink(User $user): void
    {
        if ($user->playing_source === PlayingStatus::SOURCE_STEAM) {
            $this->status->clear($user);
        }
        $user->forceFill(['steam_id' => null])->save();
    }

    /**
     * Опитування: по 100 профілів за запит.
     *
     * @return int скільки людей зараз грають
     */
    public function sync(): int
    {
        if (! $this->configured()) {
            return 0;
        }
        $playing = 0;
        User::query()->whereNotNull('steam_id')->where('playing_auto', true)->orderBy('id')
            ->chunk(100, function ($users) use (&$playing) {
                $players = $this->summaries($users->pluck('steam_id')->filter()->values()->all());
                if ($players === null) {
                    return;
                }
                $byId = [];
                foreach ($players as $p) {
                    if (is_array($p) && is_string($p['steamid'] ?? null)) {
                        $byId[$p['steamid']] = $p;
                    }
                }
                foreach ($users as $user) {
                    $p = $byId[(string) $user->steam_id] ?? null;
                    $appId = is_array($p) && isset($p['gameid']) && is_scalar($p['gameid']) ? (string) $p['gameid'] : null;
                    $name = is_array($p) && is_string($p['gameextrainfo'] ?? null) ? $p['gameextrainfo'] : null;
                    if ($appId !== null && $name !== null) {
                        $this->status->apply($user, $this->status->fromSteam($appId, $name), PlayingStatus::SOURCE_STEAM, self::MINUTES);
                        $playing++;
                    } else {
                        $this->status->apply($user, null, PlayingStatus::SOURCE_STEAM, self::MINUTES);
                    }
                }
            });

        return $playing;
    }

    /**
     * @param  list<string>  $ids
     * @return list<mixed>|null
     */
    private function summaries(array $ids): ?array
    {
        $data = $this->get('ISteamUser/GetPlayerSummaries/v2/', ['steamids' => implode(',', $ids)]);
        $players = is_array($data['response'] ?? null) ? ($data['response']['players'] ?? null) : null;

        return is_array($players) ? array_values($players) : null;
    }

    private function resolve(string $vanity): ?string
    {
        $data = $this->get('ISteamUser/ResolveVanityURL/v1/', ['vanityurl' => $vanity]);
        $id = is_array($data['response'] ?? null) ? ($data['response']['steamid'] ?? null) : null;

        return is_string($id) && preg_match('/^\d{17}$/', $id) === 1 ? $id : null;
    }

    /**
     * @param  array<string, string>  $query
     * @return array<string, mixed>|null
     */
    private function get(string $path, array $query): ?array
    {
        $key = $this->key();
        if ($key === null) {
            return null;
        }
        try {
            $response = Http::timeout(15)->acceptJson()->get(rtrim((string) config('services.steam.url', 'https://api.steampowered.com'), '/').'/'.$path, [...$query, 'key' => $key]);
        } catch (ConnectionException) {
            return null;
        }
        $data = $response->successful() ? $response->json() : null;

        return is_array($data) ? $data : null;
    }
}
