<?php

namespace App\Services\Quality;

use App\Models\Community;
use App\Models\Game;
use App\Models\GameGiveaway;
use App\Models\GtaServer;
use App\Models\Movie;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Нічна перевірка битих посилань і картинок: ігри (обкладинки, магазини), кіно (постери, фони),
 * сервери й спільноти (сайти), роздачі (картинки). Нічого не видаляє й не змінює — лише звіт
 * в адмінці. Битою адреса вважається після двох невдач поспіль (щоб не шуміти через збої).
 */
class LinkChecker
{
    /** Скільки адрес перевіряти за ніч. */
    public const PER_RUN = 400;

    /** Після скількох невдач поспіль показувати в звіті. */
    public const BROKEN_AFTER = 2;

    /** Повторна перевірка справних адрес — раз на тиждень. */
    public const RECHECK_DAYS = 7;

    /** Позначка «не перевіряли» (локальна адреса) — не рахується як невдача. */
    private const SKIP = 'skip';

    public const SOURCES = [
        'game' => 'Гра',
        'movie' => 'Кіно',
        'server' => 'Сервер',
        'community' => 'Спільнота',
        'giveaway' => 'Роздача',
    ];

    /**
     * Зібрати адреси з розділів у таблицю (нові додаються, наявні лишаються як є).
     */
    public function collect(): int
    {
        $rows = [];
        $add = function (string $source, int $id, string $field, ?string $url, ?string $label) use (&$rows) {
            $url = trim((string) $url);
            if ($url === '') {
                return;
            }
            $kind = str_starts_with($url, 'http://') || str_starts_with($url, 'https://') ? 'remote' : 'file';
            $hash = sha1("{$source}:{$id}:{$field}:{$url}");
            $rows[$hash] = ['hash' => $hash, 'source' => $source, 'source_id' => $id, 'field' => $field, 'kind' => $kind, 'url' => Str::limit($url, 2000, ''), 'label' => Str::limit((string) $label, 150), 'created_at' => now(), 'updated_at' => now()];
        };

        Game::query()->where('is_published', true)->select(['id', 'name', 'cover', 'links'])->chunkById(500, function ($games) use ($add) {
            foreach ($games as $g) {
                $add('game', $g->id, 'cover', $g->cover, $g->name);
                foreach ($g->links ?? [] as $link) {
                    $add('game', $g->id, 'link:'.Str::limit($link['store'] ?? 'site', 18, ''), $link['url'] ?? null, $g->name);
                }
            }
        });
        Movie::query()->where('is_published', true)->select(['id', 'title', 'poster_url', 'poster_path', 'backdrop_url', 'backdrop_path'])->chunkById(500, function ($movies) use ($add) {
            foreach ($movies as $m) {
                $add('movie', $m->id, 'poster', $m->poster_path ?: $m->poster_url, $m->title);
                $add('movie', $m->id, 'backdrop', $m->backdrop_path ?: $m->backdrop_url, $m->title);
            }
        });
        GtaServer::query()->select(['id', 'name', 'website'])->chunkById(500, fn ($items) => $items->each(fn (GtaServer $s) => $add('server', $s->id, 'website', $s->website, $s->name)));
        Community::query()->whereNotNull('website')->select(['id', 'name', 'website'])->chunkById(500, fn ($items) => $items->each(fn (Community $c) => $add('community', $c->id, 'website', $c->website, $c->name)));
        GameGiveaway::query()->where('active', true)->select(['id', 'title', 'image'])->get()->each(fn (GameGiveaway $g) => $add('giveaway', $g->id, 'image', $g->image, $g->title));

        foreach (array_chunk(array_values($rows), 500) as $chunk) {
            DB::table('link_checks')->insertOrIgnore($chunk);
        }

        return count($rows);
    }

    /**
     * Перевірити чергову порцію: спершу ніколи не перевірені й ті, що вже падали, потім застарілі.
     *
     * @return array{checked: int, broken: int}
     */
    public function run(int $limit = self::PER_RUN): array
    {
        $this->collect();
        $due = DB::table('link_checks')->where('ignored', false)
            ->where(fn ($q) => $q->whereNull('checked_at')->orWhere('fails', '>', 0)->orWhere('checked_at', '<', now()->subDays(self::RECHECK_DAYS)))
            ->orderByRaw('checked_at is not null')->orderByDesc('fails')->orderBy('checked_at')
            ->limit($limit)->get();

        $checked = 0;
        foreach ($due->chunk(20) as $batch) {
            $results = $this->probe($batch->all());
            foreach ($batch as $row) {
                [$status, $error] = $results[$row->id] ?? [null, 'Немає відповіді'];
                if ($error === self::SKIP) {
                    DB::table('link_checks')->where('id', $row->id)->update(['checked_at' => now(), 'fails' => 0, 'error' => 'Локальна адреса — не перевіряємо', 'updated_at' => now()]);

                    continue;
                }
                $ok = $error === null && $status !== null && $status < 400;
                DB::table('link_checks')->where('id', $row->id)->update([
                    'status' => $status,
                    'error' => $ok ? null : Str::limit((string) ($error ?? "HTTP {$status}"), 150),
                    'fails' => $ok ? 0 : $row->fails + 1,
                    'failing_since' => $ok ? null : ($row->failing_since ?? now()),
                    'checked_at' => now(),
                    'updated_at' => now(),
                ]);
                $checked++;
            }
        }

        return ['checked' => $checked, 'broken' => DB::table('link_checks')->where('ignored', false)->where('fails', '>=', self::BROKEN_AFTER)->count()];
    }

    /** Перевірити одну адресу зараз (кнопка «Перевірити» в адмінці). */
    public function recheck(int $id): void
    {
        $row = DB::table('link_checks')->where('id', $id)->first();
        if ($row === null) {
            return;
        }
        [$status, $error] = $this->probe([$row])[$row->id] ?? [null, 'Немає відповіді'];
        $ok = $error === self::SKIP || ($error === null && $status !== null && $status < 400);
        DB::table('link_checks')->where('id', $id)->update([
            'status' => $status,
            'error' => $ok ? null : Str::limit((string) ($error ?? "HTTP {$status}"), 150),
            'fails' => $ok ? 0 : max(self::BROKEN_AFTER, $row->fails + 1),
            'failing_since' => $ok ? null : ($row->failing_since ?? now()),
            'checked_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** Де виправити: сторінка розділу в адмінці або на сайті. */
    public static function editUrl(string $source, ?string $label): ?string
    {
        $q = '?q='.rawurlencode((string) $label);

        return match ($source) {
            'game' => '/admin/games'.$q,
            'movie' => '/admin/cinema'.$q,
            'server' => '/admin/servers'.$q,
            'community' => '/admin/communities'.$q,
            'giveaway' => '/games/deals',
            default => null,
        };
    }

    /**
     * @param  list<object>  $rows
     * @return array<int, array{0: int|null, 1: string|null}>
     */
    private function probe(array $rows): array
    {
        $out = [];
        $remote = [];
        foreach ($rows as $row) {
            if ($row->kind === 'file') {
                $path = ltrim((string) preg_replace('#^/?storage/#', '', $row->url), '/');
                $out[$row->id] = Storage::disk('public')->exists($path) ? [200, null] : [404, 'Файлу немає на диску'];
            } elseif (! $this->publicHost($row->url)) {
                $out[$row->id] = [null, self::SKIP];
            } else {
                $remote[$row->id] = $row->url;
            }
        }
        if ($remote === []) {
            return $out;
        }

        $client = fn (Pool $pool, int $id, string $url) => $pool->as((string) $id)
            ->withHeaders(['User-Agent' => 'GameConLinkCheck/1.0'])->timeout(8)->connectTimeout(5)->withoutRedirecting();
        $responses = Http::pool(function (Pool $pool) use ($remote, $client) {
            foreach ($remote as $id => $url) {
                $client($pool, $id, $url)->head($url);
            }
        });
        // Деякі сервери не вміють HEAD (405/403) — пробуємо GET.
        $retry = [];
        foreach ($remote as $id => $url) {
            $r = $responses[(string) $id] ?? null;
            if ($r instanceof Response && in_array($r->status(), [403, 405, 501], true)) {
                $retry[$id] = $url;
            } else {
                $out[$id] = $this->result($r);
            }
        }
        if ($retry !== []) {
            $again = Http::pool(function (Pool $pool) use ($retry, $client) {
                foreach ($retry as $id => $url) {
                    $client($pool, $id, $url)->withHeaders(['Range' => 'bytes=0-1023'])->get($url);
                }
            });
            foreach ($retry as $id => $url) {
                $out[$id] = $this->result($again[(string) $id] ?? null);
            }
        }

        return $out;
    }

    /** @return array{0: int|null, 1: string|null} */
    private function result(mixed $r): array
    {
        if ($r instanceof Response) {
            // Переадресація — це не поломка.
            return [$r->status(), null];
        }
        if ($r instanceof ConnectionException) {
            return [null, 'Не вдалося з’єднатися'];
        }

        return [null, $r instanceof Throwable ? class_basename($r) : 'Немає відповіді'];
    }

    /** Лише публічні адреси: не стукаємо в локальну мережу сервера. */
    private function publicHost(string $url): bool
    {
        $host = parse_url($url, PHP_URL_HOST);
        if (! is_string($host) || $host === '' || $host === 'localhost') {
            return false;
        }
        $ip = filter_var($host, FILTER_VALIDATE_IP) ? $host : gethostbyname($host);
        // Не вдалося розв’язати ім’я тут (запити йдуть через проксі) — нехай вирішить сам запит.
        if (! filter_var($ip, FILTER_VALIDATE_IP)) {
            return true;
        }

        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
    }
}
