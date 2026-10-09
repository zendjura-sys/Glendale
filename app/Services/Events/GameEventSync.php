<?php

namespace App\Services\Events;

use App\Models\Game;
use App\Models\GameEvent;
use App\Services\EventCalendar;
use App\Services\Games\Igdb;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Автоматичні події ігор з IGDB: шоукейси й трансляції та дати виходу ігор каталогу.
 * Що зникло з IGDB (перенесли, скасували) — прибираємо з календаря, якщо ще не почалося.
 * Обидва джерела вмикаються окремо: Адмінка → Ігри → Можливості.
 */
class GameEventSync
{
    public function __construct(private readonly Igdb $igdb, private readonly SiteSettings $settings) {}

    /**
     * @return array{events: int, releases: int}
     */
    public function sync(): array
    {
        $on = Game::features($this->settings->get('games_features'));
        if (! $this->igdb->configured()) {
            return ['events' => 0, 'releases' => 0];
        }

        return [
            'events' => $on['events'] ? $this->events() : 0,
            'releases' => $on['release_events'] ? $this->releases() : 0,
        ];
    }

    private function events(): int
    {
        $from = now()->subDay();
        $to = now()->addDays(EventCalendar::DAYS);
        $rows = $this->igdb->events($from->getTimestamp(), $to->getTimestamp());
        if ($rows === null) {
            return 0;
        }
        $catalog = $this->catalogIds(array_merge(...array_map(fn (array $r) => is_array($r['games'] ?? null) ? $r['games'] : [], $rows)));
        $seen = [];
        foreach ($rows as $row) {
            $id = (int) ($row['id'] ?? 0);
            $start = (int) ($row['start_time'] ?? 0);
            $name = trim((string) ($row['name'] ?? ''));
            if ($id <= 0 || $start <= 0 || $name === '') {
                continue;
            }
            $networks = array_values(array_filter(array_map(fn ($n) => is_array($n) ? (string) ($n['url'] ?? '') : '', is_array($row['event_networks'] ?? null) ? $row['event_networks'] : [])));
            $url = $this->url((string) ($row['live_stream_url'] ?? '')) ?? $this->url($networks[0] ?? '');
            $logo = is_array($row['event_logo'] ?? null) ? ($row['event_logo']['image_id'] ?? null) : null;
            $event = GameEvent::query()->updateOrCreate(['source' => 'igdb', 'external_id' => 'e'.$id], [
                'title' => Str::limit($name, 157),
                'type' => $url !== null && str_contains((string) $url, 'twitch.tv') ? 'stream' : 'showcase',
                'description' => isset($row['description']) ? Str::limit(trim((string) $row['description']), 997) : null,
                'starts_at' => Carbon::createFromTimestamp($start),
                'ends_at' => isset($row['end_time']) && (int) $row['end_time'] > $start ? Carbon::createFromTimestamp((int) $row['end_time']) : null,
                'url' => $url,
                'image' => Igdb::image(is_string($logo) ? $logo : null, 'logo_med'),
            ]);
            $games = [];
            foreach (is_array($row['games'] ?? null) ? $row['games'] : [] as $igdbId) {
                if (isset($catalog[(int) $igdbId])) {
                    $games[] = $catalog[(int) $igdbId];
                }
            }
            $event->games()->sync(array_values(array_unique($games)));
            $seen[] = $event->id;
        }
        $this->forgetMissing('e', $seen);

        return count($seen);
    }

    private function releases(): int
    {
        $from = now()->startOfDay();
        $to = now()->addDays(EventCalendar::DAYS);
        $games = Game::query()->published()->whereNotNull('igdb_id')->get(['id', 'name', 'slug', 'igdb_id'])->keyBy('igdb_id');
        $byDay = [];
        foreach ($games->keys()->chunk(400) as $chunk) {
            $rows = $this->igdb->releaseDates(array_values(array_map('intval', $chunk->all())), $from->getTimestamp(), $to->getTimestamp());
            if ($rows === null) {
                // IGDB не відповів — нічого не прибираємо, спробуємо наступного разу.
                return 0;
            }
            foreach ($rows as $row) {
                $game = $games->get((int) ($row['game'] ?? 0));
                $date = (int) ($row['date'] ?? 0);
                if (! $game instanceof Game || $date <= 0) {
                    continue;
                }
                $day = Carbon::createFromTimestamp($date)->utc()->toDateString();
                $key = $game->id.'-'.$day;
                $byDay[$key]['game'] = $game;
                $byDay[$key]['day'] = $day;
                $platform = Igdb::PLATFORMS[(int) ($row['platform'] ?? 0)] ?? null;
                if ($platform !== null) {
                    $byDay[$key]['platforms'][$platform] = Game::PLATFORMS[$platform];
                }
            }
        }
        $seen = [];
        foreach ($byDay as $key => $release) {
            /** @var Game $game */
            $game = $release['game'];
            $platforms = array_values($release['platforms'] ?? []);
            $event = GameEvent::query()->updateOrCreate(['source' => 'igdb', 'external_id' => 'r'.$key], [
                'title' => Str::limit('Вихід: '.$game->name, 157),
                'type' => 'release',
                'description' => $platforms === [] ? null : 'Платформи: '.implode(', ', $platforms),
                'starts_at' => Carbon::parse($release['day'].' 12:00', 'Europe/Kyiv'),
                'all_day' => true,
                'url' => null,
            ]);
            $event->games()->sync([$game->id]);
            $seen[] = $event->id;
        }
        $this->forgetMissing('r', $seen);

        return count($seen);
    }

    /**
     * Майбутні події IGDB цього виду, яких більше немає у відповіді.
     *
     * @param  list<int>  $seen
     */
    private function forgetMissing(string $prefix, array $seen): void
    {
        GameEvent::query()->where('source', 'igdb')->where('external_id', 'like', $prefix.'%')
            ->where('starts_at', '>', now())->whereNotIn('id', $seen ?: [0])->delete();
    }

    /**
     * @param  array<int, mixed>  $igdbIds
     * @return array<int, int> igdb id → id гри в каталозі
     */
    private function catalogIds(array $igdbIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $igdbIds))));

        $out = [];
        if ($ids !== []) {
            foreach (Game::query()->published()->whereIn('igdb_id', $ids)->get(['id', 'igdb_id']) as $game) {
                $out[(int) $game->igdb_id] = $game->id;
            }
        }

        return $out;
    }

    private function url(string $url): ?string
    {
        return preg_match('#^https://\S{4,490}$#', trim($url)) === 1 ? trim($url) : null;
    }
}
