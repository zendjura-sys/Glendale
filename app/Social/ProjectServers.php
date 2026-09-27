<?php

namespace App\Social;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * Автозаповнення серверів проєкту з публічного майстер-списку RAGE MP:
 * { "ip:port": { name, gamemode, url, lang, players, peak, maxplayers } }.
 * Сервер проєкту впізнається за доменом його сайту в полі url або за
 * назвою проєкту в назві сервера. Нові сервери додаються підтвердженими,
 * у наявних оновлюються адреса й онлайн; ручні записи не видаляються.
 */
final class ProjectServers
{
    public const SOURCES = ['ragemp' => 'RAGE MP (GTA V)'];

    public const RAGEMP_MASTER = 'https://cdn.rage.mp/master/';

    /** @return array<string, array<string, mixed>>|null */
    public static function rageMaster(): ?array
    {
        try {
            $res = Http::timeout(20)->connectTimeout(8)->acceptJson()->get(self::RAGEMP_MASTER);
        } catch (\Throwable) {
            return null;
        }
        $data = $res->successful() ? $res->json() : null;

        return is_array($data) ? $data : null;
    }

    /**
     * @param  array<string, array<string, mixed>>|null  $master  майстер-список (щоб не качати його на кожен проєкт)
     * @return int|null кількість знайдених серверів; null — джерело недоступне
     */
    public static function sync(object $project, ?array $master = null): ?int
    {
        if ($project->servers_source !== 'ragemp') {
            return null;
        }
        $master ??= self::rageMaster();
        if ($master === null) {
            return null;
        }

        $found = [];
        foreach ($master as $address => $info) {
            if (is_array($info) && self::belongs($project, (string) ($info['name'] ?? ''), (string) ($info['url'] ?? ''))) {
                $found[(string) $address] = $info;
            }
        }
        ksort($found, SORT_NATURAL);

        $existing = DB::table('game_servers')->where('project_id', $project->id)->get();
        $used = $existing->pluck('name')->map(fn ($n) => mb_strtolower($n))->all();
        foreach ($found as $address => $info) {
            $row = $existing->firstWhere('address', $address);
            $stats = [
                'players' => max(0, (int) ($info['players'] ?? 0)),
                'max_players' => max(0, (int) ($info['maxplayers'] ?? 0)) ?: null,
                'synced_at' => now(),
                'updated_at' => now(),
            ];
            if ($row) {
                DB::table('game_servers')->where('id', $row->id)->update($stats);

                continue;
            }
            $name = self::serverName($project->name, (string) ($info['name'] ?? ''), $used);
            $match = $existing->first(fn ($s) => $s->address === null && mb_strtolower($s->name) === mb_strtolower($name));
            if ($match) {
                DB::table('game_servers')->where('id', $match->id)->update(['address' => $address, 'approved' => true] + $stats);

                continue;
            }
            DB::table('game_servers')->insert(['project_id' => $project->id, 'name' => $name, 'address' => $address, 'approved' => true, 'created_at' => now()] + $stats);
            $used[] = mb_strtolower($name);
        }

        // Сервери, яких більше немає в списку, — онлайн невідомий.
        DB::table('game_servers')->where('project_id', $project->id)->whereNotNull('address')
            ->whereNotIn('address', array_map('strval', array_keys($found)))->update(['players' => null]);
        DB::table('game_projects')->where('id', $project->id)->update(['servers_synced_at' => now()]);

        return count($found);
    }

    public static function belongs(object $project, string $name, string $url): bool
    {
        $host = $project->website ? preg_replace('/^www\./', '', (string) parse_url($project->website, PHP_URL_HOST)) : '';
        if ($host !== '' && $url !== '' && str_contains(mb_strtolower($url), mb_strtolower($host))) {
            return true;
        }
        $needle = self::plain($project->name);

        return $needle !== '' && str_contains(self::plain($name), $needle);
    }

    /**
     * Коротка назва: без емодзі, службових [тегів] і назви проєкту —
     * «🔮 Quant RP | Server 2 | [UKRAINE]» → «Server 2». Якщо нічого не
     * лишилось — «Сервер N».
     *
     * @param  list<string>  $used
     */
    public static function serverName(string $project, string $raw, array $used): string
    {
        $name = preg_replace('/[^\p{L}\p{N}\s#№|:\-.]+/u', ' ', $raw);
        $name = preg_replace('/\[[^\]]*\]/u', ' ', $name);
        $name = preg_replace('/'.preg_quote($project, '/').'/iu', ' ', $name);
        $parts = array_values(array_filter(array_map(fn ($p) => trim($p, " \t-.:"), preg_split('/\|/u', $name)), fn ($p) => $p !== ''));
        // Перша змістовна частина, в якій є цифра (номер сервера), або просто перша.
        $pick = collect($parts)->first(fn ($p) => preg_match('/\d/', $p)) ?? ($parts[0] ?? '');
        $pick = mb_substr(trim(preg_replace('/\s+/u', ' ', $pick)), 0, 60);

        if ($pick === '' || in_array(mb_strtolower($pick), $used, true)) {
            $n = 1;
            while (in_array(mb_strtolower("Сервер {$n}"), $used, true)) {
                $n++;
            }
            $pick = "Сервер {$n}";
        }

        return $pick;
    }

    /** Номер сервера з назви: «1», «#1», «Server 1», «Сервер №1» → 1. */
    public static function number(string $name): ?int
    {
        return preg_match('/^\s*(?:(?:server|сервер|серв|s)\s*)?[#№]?\s*(\d{1,4})\s*$/iu', $name, $m) ? (int) $m[1] : null;
    }

    /** Сервер, введений вручну: номер 1–999 або назва літерами. */
    public const NAME_RULE = '/^(?:[1-9]\d{0,2}|[A-Za-zА-Яа-яЁёЇїІіЄєҐґ]+(?:[ \'’-][A-Za-zА-Яа-яЁёЇїІіЄєҐґ]+)*)$/u';

    public const NAME_HINT = 'Сервер — номер від 1 до 999 або назва літерами (А–Я, а–я, A–Z, a–z).';

    public static function valid(string $name): bool
    {
        return mb_strlen($name) <= 40 && preg_match(self::NAME_RULE, $name) === 1;
    }

    private static function plain(string $s): string
    {
        return trim(preg_replace('/[^\p{L}\p{N}]+/u', ' ', mb_strtolower($s)));
    }
}
