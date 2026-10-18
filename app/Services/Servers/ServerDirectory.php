<?php

namespace App\Services\Servers;

use App\Models\GtaServer;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * Онлайн серверів (майстер-листи RAGE:MP, FiveM, alt:V, Discord) і автопошук нових українських проєктів.
 */
class ServerDirectory
{
    public const RAGE_MASTER = 'https://cdn.rage.mp/master/';

    public function __construct(
        private readonly DiscordInvites $discord,
        private readonly SiteSettings $settings,
    ) {}

    /**
     * @return array{updated: int, failed: int}
     */
    public function refreshStats(?GtaServer $only = null): array
    {
        $servers = $only ? collect([$only]) : GtaServer::query()->where('status', GtaServer::STATUS_PUBLISHED)->get();
        $rage = $servers->contains('multiplayer', 'ragemp') ? $this->rageMaster() : [];
        $updated = $failed = 0;

        foreach ($servers as $server) {
            $stats = match (true) {
                $server->multiplayer === 'ragemp' && $server->connect !== null => $this->fromRage($rage, $server->connect),
                $server->multiplayer === 'fivem' && $server->connect !== null => $this->fromFivem($server->connect),
                $server->multiplayer === 'altv' && $server->connect !== null => $this->fromAltv($server->connect),
                default => [],
            };

            if ($server->discord_invite && ($invite = $this->discord->lookup($server->discord_invite))) {
                $stats += ['discord_members' => $invite['members'], 'discord_online' => $invite['online']];
            }

            if ($stats === []) {
                $failed++;

                continue;
            }

            $server->forceFill([...$stats, 'stats_updated_at' => now()])->saveQuietly();
            $this->rememberOnline($server);
            $updated++;
        }

        return ['updated' => $updated, 'failed' => $failed];
    }

    /**
     * Додає українські сервери з майстер-листа RAGE:MP, яких ще немає в каталозі.
     *
     * @return list<GtaServer>
     */
    public function discover(): array
    {
        $known = GtaServer::withTrashed()->get(['id', 'connect', 'website', 'name']);
        $knownConnect = $known->pluck('connect')->filter()->map(fn ($c) => Str::lower((string) $c))->all();
        $knownHosts = $known->pluck('website')->filter()->map(fn ($w) => $this->host((string) $w))->filter()->all();
        $knownNames = $known->pluck('name')->map(fn ($n) => Str::lower(Str::slug((string) $n)))->all();
        $publish = (bool) $this->settings->get('servers_auto_publish');
        $created = [];

        foreach ($this->rageMaster() as $address => $entry) {
            if (! $this->isUkrainian($entry) || in_array(Str::lower($address), $knownConnect, true)) {
                continue;
            }

            $name = $this->cleanName((string) ($entry['name'] ?? ''));
            $website = $this->website((string) ($entry['url'] ?? ''));
            $host = $website ? $this->host($website) : null;
            if ($name === '' || ($host && in_array($host, $knownHosts, true)) || in_array(Str::lower(Str::slug($name)), $knownNames, true)) {
                continue;
            }

            $server = GtaServer::query()->create([
                'slug' => $this->uniqueSlug($name),
                'name' => $name,
                'platform' => 'pc',
                'multiplayer' => 'ragemp',
                'tagline' => $this->tagline((string) ($entry['name'] ?? '')),
                'website' => $website,
                'discord_invite' => preg_match('#discord\.gg/([A-Za-z0-9-]+)#i', (string) $entry['name'], $m) ? $m[1] : null,
                'connect' => $address,
                'status' => $publish ? GtaServer::STATUS_PUBLISHED : GtaServer::STATUS_PENDING,
                'origin' => 'discovered',
            ]);
            $server->forceFill([
                'players_online' => (int) ($entry['players'] ?? 0),
                'players_max' => (int) ($entry['maxplayers'] ?? 0) ?: null,
                'players_peak' => (int) ($entry['peak'] ?? 0) ?: null,
                'stats_updated_at' => now(),
            ])->saveQuietly();

            $knownConnect[] = Str::lower($address);
            $knownNames[] = Str::lower(Str::slug($name));
            if ($host) {
                $knownHosts[] = $host;
            }
            $created[] = $server;
        }

        return $created;
    }

    public function uniqueSlug(string $name): string
    {
        $base = Str::limit(Str::slug(Str::transliterate($name)) ?: 'server', 70, '');
        $slug = $base;
        $i = 2;
        while (GtaServer::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function rageMaster(): array
    {
        return Cache::remember('servers.rage.master', now()->addMinutes(4), function () {
            try {
                $response = Http::timeout(20)->acceptJson()->get(self::RAGE_MASTER);
            } catch (Throwable) {
                return [];
            }

            return $response->successful() && is_array($response->json()) ? $response->json() : [];
        });
    }

    private function rememberOnline(GtaServer $server): void
    {
        if ($server->players_online === null) {
            return;
        }

        DB::table('server_online_samples')->upsert([
            [
                'gta_server_id' => $server->id,
                'sampled_on' => now()->toDateString(),
                'players_online' => $server->players_online,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ], ['gta_server_id', 'sampled_on'], ['players_online', 'updated_at']);
    }

    /**
     * @param  array<string, array<string, mixed>>  $master
     * @return array<string, int|null>
     */
    private function fromRage(array $master, string $connect): array
    {
        $entry = $master[$connect] ?? $master[Str::lower($connect)] ?? null;
        if (! is_array($entry)) {
            return [];
        }

        return [
            'players_online' => (int) ($entry['players'] ?? 0),
            'players_max' => (int) ($entry['maxplayers'] ?? 0) ?: null,
            'players_peak' => (int) ($entry['peak'] ?? 0) ?: null,
        ];
    }

    /**
     * @return array<string, int|null>
     */
    private function fromFivem(string $code): array
    {
        $code = preg_replace('#^(https?://)?cfx\.re/join/#i', '', $code) ?? $code;

        try {
            $data = Http::timeout(10)->withUserAgent('Mozilla/5.0 GameConBot')->acceptJson()
                ->get('https://servers-frontend.fivem.net/api/servers/single/'.rawurlencode($code))->json('Data');
        } catch (Throwable) {
            return [];
        }

        return is_array($data) && isset($data['clients']) ? [
            'players_online' => (int) $data['clients'],
            'players_max' => (int) ($data['sv_maxclients'] ?? $data['svMaxclients'] ?? 0) ?: null,
        ] : [];
    }

    /**
     * @return array<string, int|null>
     */
    private function fromAltv(string $id): array
    {
        try {
            $data = Http::timeout(10)->acceptJson()->get('https://api.alt-mp.com/servers/'.rawurlencode($id))->json();
        } catch (Throwable) {
            return [];
        }

        return is_array($data) && isset($data['playersCount']) ? [
            'players_online' => (int) $data['playersCount'],
            'players_max' => (int) ($data['maxPlayersCount'] ?? 0) ?: null,
        ] : [];
    }

    /**
     * @param  array<string, mixed>  $entry
     */
    private function isUkrainian(array $entry): bool
    {
        $name = Str::lower((string) ($entry['name'] ?? ''));

        return in_array($entry['lang'] ?? null, ['ua', 'uk'], true)
            || preg_match('/\[(ua|ukr|ukraine)\]|україн|ukraine/u', $name) === 1;
    }

    /**
     * «🔮 Quant RP | Ми разом! | Fix [UKRAINE] [1.1]» → «Quant RP».
     */
    public function cleanName(string $raw): string
    {
        $raw = preg_replace('/\[[^\]]*\]/u', ' ', $raw) ?? $raw;
        $first = trim(explode('|', $raw)[0]);
        $first = preg_replace('/[^\p{L}\p{N}\s.\-\'’:!&+]/u', '', $first) ?? $first;

        return Str::limit(trim(preg_replace('/\s+/u', ' ', $first) ?? $first), 80, '');
    }

    private function tagline(string $raw): ?string
    {
        $raw = preg_replace('/\[[^\]]*\]/u', ' ', $raw) ?? $raw;
        $parts = array_map('trim', explode('|', $raw));
        $tag = collect(array_slice($parts, 1))->first(fn (string $p) => $p !== '' && ! str_contains(Str::lower($p), 'discord'));
        $tag = $tag ? trim(preg_replace('/[^\p{L}\p{N}\s.\-\'’:!&+%#]/u', '', $tag) ?? '') : null;

        return $tag ? Str::limit($tag, 160, '') : null;
    }

    private function website(string $url): ?string
    {
        $url = trim($url);
        if ($url === '' || Str::contains(Str::lower($url), ['rage.mp']) || ! preg_match('/[a-z0-9-]+\.[a-z]{2,}/i', $url)) {
            return null;
        }

        return preg_match('#^https?://#i', $url) ? $url : 'https://'.$url;
    }

    private function host(string $url): ?string
    {
        $host = parse_url(preg_match('#^https?://#i', $url) ? $url : 'https://'.$url, PHP_URL_HOST);

        return is_string($host) ? preg_replace('/^www\./', '', Str::lower($host)) : null;
    }
}
