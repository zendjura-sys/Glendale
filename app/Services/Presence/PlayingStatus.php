<?php

namespace App\Services\Presence;

use App\Models\Game;
use App\Models\GtaServer;
use App\Models\PlayedPlace;
use App\Models\User;
use App\Services\FollowAlerts;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * «Граю в…»: де людина зараз — сервер GTA або гра з каталогу.
 * Ставиться автоматично (Discord Rich Presence, Steam) або вручну; ручний статус
 * автоматика не перезаписує, поки він діє.
 */
class PlayingStatus
{
    public const SOURCE_MANUAL = 'manual';

    public const SOURCE_DISCORD = 'discord';

    public const SOURCE_STEAM = 'steam';

    public const SOURCE_MOBILE = 'mobile';

    /** Скільки годин можна поставити вручну. */
    public const MANUAL_HOURS = [1, 3, 6, 12, 24];

    /**
     * Встановити статус. $target — що показувати; null — прибрати статус цього джерела.
     *
     * @param  array{kind: string, id: int|null, label: string, icon: string|null, url: string|null, note: string|null}|null  $target
     */
    public function apply(User $user, ?array $target, string $source, int $minutes): void
    {
        $manualActive = $user->playing_source === self::SOURCE_MANUAL && $user->playing_until?->isFuture();
        if ($source !== self::SOURCE_MANUAL && (! $user->playing_auto || $manualActive)) {
            return;
        }

        if ($target === null) {
            if ($user->playing_source === $source || $source === self::SOURCE_MANUAL) {
                $this->clear($user);
            }

            return;
        }

        // Те саме й ще довго діє — не пишемо в базу на кожен сигнал.
        $changedTarget = $user->playing_kind !== $target['kind'] || (int) $user->playing_ref_id !== (int) ($target['id'] ?? 0);
        $same = $user->playing_kind === $target['kind'] && $user->playing_ref_id === $target['id']
            && $user->playing_label === $target['label'] && $user->playing_note === $target['note'] && $user->playing_source === $source;
        if ($same && $user->playing_until?->gt(now()->addMinutes(intdiv($minutes, 2)))) {
            return;
        }

        $user->forceFill([
            'playing_kind' => $target['kind'],
            'playing_ref_id' => $target['id'],
            'playing_label' => Str::limit($target['label'], 160, ''),
            'playing_icon' => $target['icon'],
            'playing_url' => $target['url'],
            'playing_note' => $target['note'] !== null ? Str::limit($target['note'], 60, '') : null,
            'playing_until' => now()->addMinutes($minutes),
            'playing_source' => $source,
        ])->save();

        if (in_array($target['kind'], [PlayedPlace::GAME, PlayedPlace::SERVER], true) && $target['id'] !== null) {
            PlayedPlace::query()->firstOrCreate([
                'user_id' => $user->id,
                'kind' => $target['kind'],
                'subject_id' => $target['id'],
            ]);
            // День гри — для «Підсумків року» (топ ігор і серверів за кількістю днів).
            DB::table('play_days')->insertOrIgnore([
                'user_id' => $user->id,
                'kind' => $target['kind'],
                'subject_id' => $target['id'],
                'day' => now()->toDateString(),
            ]);
        }

        if ($changedTarget) {
            app(FollowAlerts::class)->friendsStarted($user->fresh());
        }
    }

    public function clear(User $user): void
    {
        $user->forceFill([
            'playing_kind' => null, 'playing_ref_id' => null, 'playing_label' => null, 'playing_icon' => null,
            'playing_url' => null, 'playing_note' => null, 'playing_until' => null, 'playing_source' => null,
        ])->save();
    }

    /**
     * Ручний вибір: сервер GTA або гра з каталогу.
     */
    public function manual(User $user, string $kind, int $id, ?string $note, int $hours): void
    {
        $target = $kind === 'server' ? $this->serverTarget(GtaServer::query()->findOrFail($id)) : $this->gameTarget(Game::query()->findOrFail($id));
        $target['note'] = $note !== null && trim($note) !== '' ? trim($note) : null;
        $this->apply($user, $target, self::SOURCE_MANUAL, $hours * 60);
    }

    /**
     * Активність із Discord: спершу шукаємо сервер GTA в назві й деталях (RAGE MP, alt:V, FiveM,
     * мобільні проєкти пишуть його туди), потім гру з каталогу, інакше показуємо назву як є.
     *
     * @return array{kind: string, id: int|null, label: string, icon: string|null, url: string|null, note: string|null}
     */
    public function fromActivity(string $name, ?string $details = null, ?string $state = null): array
    {
        $server = $this->matchServer(implode(' | ', array_filter([$name, $details, $state])));
        if ($server !== null) {
            return [...$this->serverTarget($server), 'note' => null];
        }
        $game = $this->matchGame($name);
        if ($game !== null) {
            return [...$this->gameTarget($game), 'note' => $details !== null ? Str::limit($details, 60, '') : null];
        }

        return ['kind' => 'game', 'id' => null, 'label' => Str::limit(trim($name), 80, ''), 'icon' => null, 'url' => null, 'note' => null];
    }

    /** Посилання на сторінку гри в каталозі за Steam appid. */
    public function steamGameHref(string $appId): ?string
    {
        $id = $this->steamApps()[$appId] ?? null;
        $slug = $id !== null ? Game::query()->whereKey($id)->value('slug') : null;

        return is_string($slug) && $slug !== '' ? '/games/'.$slug : null;
    }

    /**
     * Гра Steam за appid (з посилань каталогу на store.steampowered.com/app/{id}).
     *
     * @return array{kind: string, id: int|null, label: string, icon: string|null, url: string|null, note: string|null}
     */
    public function fromSteam(string $appId, string $name): array
    {
        $gameId = $this->steamApps()[$appId] ?? null;
        $game = $gameId !== null ? Game::query()->find($gameId) : $this->matchGame($name);

        return $game instanceof Game
            ? [...$this->gameTarget($game), 'note' => null]
            : ['kind' => 'game', 'id' => null, 'label' => Str::limit(trim($name), 80, ''), 'icon' => null, 'url' => 'https://store.steampowered.com/app/'.$appId.'/', 'note' => null];
    }

    /**
     * Гра з телефона (застосунок GameCon на Android): мобільний проєкт GTA за назвою застосунку —
     * як сервер; інакше гра каталогу за пакетом Google Play або за назвою.
     *
     * @return array{kind: string, id: int|null, label: string, icon: string|null, url: string|null, note: string|null}|null
     */
    public function fromPackage(string $package, ?string $label): ?array
    {
        $label = $label !== null ? trim($label) : '';
        // Мобільний проєкт GTA показуємо як сервер (там сім’ї й хто грає), навіть якщо він є й у каталозі ігор.
        $server = $label !== '' ? $this->matchServer($label) : null;
        if ($server !== null) {
            return [...$this->serverTarget($server), 'note' => null];
        }
        $gameId = $this->playPackages()[$package] ?? null;
        $game = $gameId !== null ? Game::query()->find($gameId) : null;
        if ($game instanceof Game) {
            return [...$this->gameTarget($game), 'note' => null];
        }

        return $label !== '' ? $this->fromActivity($label) : null;
    }

    /**
     * Пакети Google Play з каталогу — застосунок надсилає лише їх (і застосунки категорії «Ігри»).
     *
     * @return list<string>
     */
    public function knownPackages(): array
    {
        return array_keys($this->playPackages());
    }

    /**
     * Хто зараз грає на сервері чи в грі — для їхніх сторінок; друзі першими.
     *
     * @param  list<int>  $friendIds
     * @return list<array<string, mixed>>
     */
    public function playingNow(string $kind, int $id, array $friendIds = [], int $limit = 24): array
    {
        $base = fn () => User::query()->where('playing_kind', $kind)->where('playing_ref_id', $id)->where('playing_until', '>', now());
        $friends = $base()->whereIn('id', $friendIds ?: [0])->orderByDesc('last_seen_at')->limit($limit)->get();
        $others = $base()->whereNotIn('id', $friends->pluck('id')->all() ?: [0])->orderByDesc('last_seen_at')->limit(max(0, $limit - $friends->count()))->get();

        return array_values($friends->concat($others)->map(fn (User $u) => $u->toCard())->all());
    }

    public function countNow(string $kind, int $id): int
    {
        return User::query()->where('playing_kind', $kind)->where('playing_ref_id', $id)->where('playing_until', '>', now())->count();
    }

    /**
     * @return array{kind: string, id: int, label: string, icon: string|null, url: string, note: null}
     */
    private function serverTarget(GtaServer $server): array
    {
        return ['kind' => 'server', 'id' => $server->id, 'label' => $server->name, 'icon' => $server->icon, 'url' => '/servers/'.$server->slug, 'note' => null];
    }

    /**
     * @return array{kind: string, id: int, label: string, icon: string|null, url: string, note: null}
     */
    private function gameTarget(Game $game): array
    {
        return ['kind' => 'game', 'id' => $game->id, 'label' => $game->name, 'icon' => $game->cover, 'url' => '/games/'.$game->slug, 'note' => null];
    }

    private function matchServer(string $text): ?GtaServer
    {
        $haystack = self::normalize($text);
        if ($haystack === '') {
            return null;
        }
        $best = null;
        $bestLength = 0;
        foreach ($this->serverNames() as $id => $name) {
            if (strlen($name) >= 4 && strlen($name) > $bestLength && str_contains($haystack, $name)) {
                $best = $id;
                $bestLength = strlen($name);
            }
        }

        return $best !== null ? GtaServer::query()->find($best) : null;
    }

    private function matchGame(string $name): ?Game
    {
        $key = self::normalize($name);
        $id = $key !== '' ? ($this->gameNames()[$key] ?? null) : null;

        return $id !== null ? Game::query()->find($id) : null;
    }

    /**
     * @return array<int, string>
     */
    private function serverNames(): array
    {
        /** @var array<int, string> */
        return Cache::remember('presence.servers', now()->addMinutes(10), fn () => GtaServer::query()
            ->where('status', GtaServer::STATUS_PUBLISHED)->pluck('name', 'id')
            ->map(fn ($name) => self::normalize((string) $name))->all());
    }

    /**
     * Назви й альтернативні назви ігор каталогу → id.
     *
     * @return array<string, int>
     */
    private function gameNames(): array
    {
        /** @var array<string, int> */
        return Cache::remember('presence.games', now()->addMinutes(30), function () {
            $map = [];
            Game::query()->published()->orderBy('popularity')->select(['id', 'name', 'aliases'])->cursor()->each(function (Game $g) use (&$map) {
                foreach ([$g->name, ...explode(' | ', (string) $g->aliases)] as $name) {
                    $key = self::normalize($name);
                    if ($key !== '') {
                        $map[$key] = $g->id;
                    }
                }
            });

            return $map;
        });
    }

    /**
     * Steam appid → id гри каталогу.
     *
     * @return array<string, int>
     */
    private function steamApps(): array
    {
        /** @var array<string, int> */
        return Cache::remember('presence.steam', now()->addMinutes(30), function () {
            $map = [];
            Game::query()->published()->whereNotNull('links')->select(['id', 'links'])->cursor()->each(function (Game $g) use (&$map) {
                foreach ($g->links ?? [] as $link) {
                    if ($link['store'] === 'steam' && preg_match('#/app/(\d+)#', $link['url'], $m) === 1) {
                        $map[$m[1]] = $g->id;
                    }
                }
            });

            return $map;
        });
    }

    /**
     * Пакет Google Play → id гри каталогу.
     *
     * @return array<string, int>
     */
    private function playPackages(): array
    {
        /** @var array<string, int> */
        return Cache::remember('presence.gplay', now()->addMinutes(30), function () {
            $map = [];
            Game::query()->published()->whereNotNull('links')->select(['id', 'links'])->cursor()->each(function (Game $g) use (&$map) {
                foreach ($g->links ?? [] as $link) {
                    if ($link['store'] === 'gplay' && preg_match('#[?&]id=([A-Za-z0-9_.]+)#', $link['url'], $m) === 1) {
                        $map[$m[1]] = $g->id;
                    }
                }
            });

            return $map;
        });
    }

    /** Порівнюємо без регістру, пробілів і розділових знаків: «Majestic RP» = «majestic-rp». */
    public static function normalize(?string $text): string
    {
        return (string) preg_replace('/[^\p{L}\p{N}]+/u', '', mb_strtolower((string) $text));
    }
}
