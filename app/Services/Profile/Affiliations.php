<?php

namespace App\Services\Profile;

use App\Jobs\FetchGameLogo;
use App\Models\Clan;
use App\Models\ClanMember;
use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\Game;
use App\Models\User;
use App\Services\Games\GameLogoFetcher;
use App\Support\Modules\ModuleManager;
use Illuminate\Support\Collection;

/**
 * Значки біля ніка: зменшені копії логотипів сім'ї, клану (гільдії), сервера й гри, у якій людина зараз
 * (BadgeIcons). Кожен значок — логотип із відповідного розділу, назва й рядки для підказки при наведенні.
 *
 * Групи: сім'я (+ сервер ГТА), кожен клан чи гільдія (+ гра клану), гра, у яку людина зараз грає.
 * Порядок груп людина обирає в налаштуваннях (preferences.badge_order).
 *
 * @phpstan-type Badge array{kind: string, name: string, tag: string|null, logo: string|null, href: string, role: string|null, lines: list<string>}
 * @phpstan-type GroupedBadge array{kind: string, name: string, tag: string|null, logo: string|null, href: string, role: string|null, lines: list<string>, group: string}
 */
class Affiliations
{
    /** @var array<int, list<GroupedBadge>> значки, уже зібрані в цьому запиті */
    private array $memo = [];

    /**
     * Зібрати значки одним запитом для всіх людей сторінки (стрічка, коментарі, список).
     *
     * @param  iterable<User|null>  $users
     */
    public function prime(iterable $users): void
    {
        $missing = collect($users)->filter(fn ($u) => $u instanceof User && ! array_key_exists($u->id, $this->memo));
        if ($missing->isNotEmpty()) {
            $this->memo = $this->forUsers($missing) + $this->memo;
        }
    }

    /** @return list<GroupedBadge> */
    public function of(User $user): array
    {
        if (! $user->exists) {
            return [];
        }
        $this->prime([$user]);

        return $this->memo[$user->id] ?? [];
    }

    /** Після змін (вступ у сім'ю, новий логотип) — забути зібране. */
    public function forget(): void
    {
        $this->memo = [];
    }

    /**
     * @param  iterable<User>  $users
     * @return array<int, list<GroupedBadge>>
     */
    public function forUsers(iterable $users): array
    {
        $users = collect($users)->filter()->unique('id')->values();
        if ($users->isEmpty()) {
            return [];
        }
        $ids = $users->pluck('id')->all();
        $modules = app(ModuleManager::class);
        $out = array_fill_keys($ids, []);

        $families = collect();
        if ($modules->enabled('families')) {
            /** @var Collection<int, FamilyMember> $families */
            $families = FamilyMember::query()->with('family.server')
                ->whereIn('user_id', $ids)
                ->where('status', FamilyMember::STATUS_ACTIVE)
                ->whereHas('family', fn ($q) => $q->where('status', Family::STATUS_VERIFIED))
                ->get()->unique('user_id')->keyBy('user_id');
        }
        $clans = collect();
        if ($modules->enabled('clans')) {
            // Усі клани й гільдії людини (у кожному — свій значок і гра клану).
            $clans = ClanMember::query()->with('clan.game')
                ->whereIn('user_id', $ids)
                ->where('status', ClanMember::STATUS_ACTIVE)
                ->orderBy('id')
                ->get()->filter(fn (ClanMember $m) => $m->clan !== null)->groupBy('user_id');
        }

        // Ігри, у які люди грають зараз, — щоб узяти їхні логотипи одним запитом.
        $playingIds = $users->map(fn (User $u) => $u->playing())->filter(fn ($p) => $p !== null && $p['kind'] === 'game' && $p['id'] !== null)->pluck('id')->unique()->all();
        $playingGames = $playingIds === [] ? collect() : Game::query()->whereIn('id', $playingIds)->get()->keyBy('id');

        $icons = app(BadgeIcons::class);
        foreach ($users as $user) {
            /** @var array<string, list<Badge>> $groups ключ групи → значки (порядок за замовчуванням) */
            $groups = [];
            $member = $families->get($user->id);
            $family = $member?->family;
            if ($member && $family) {
                // Сім'я — її логотип і логотип сервера ГТА, на якому вона.
                $group = [[
                    'kind' => 'family',
                    'name' => $family->name,
                    'tag' => $family->tag,
                    'logo' => $icons->url($family->logo_path),
                    'href' => '/f/'.$family->slug,
                    'role' => $family->rankTitle($member->rank),
                    'lines' => array_values(array_filter([
                        self::t('Сім’я · :count учасників', ['count' => $family->members_count]),
                        $family->server ? self::t('Сервер: :name', ['name' => $family->server->name]) : '',
                    ])),
                ]];
                if ($family->server) {
                    $group[] = $this->server($family->server->name, $icons->url($family->server->icon_path) ?? $icons->external($family->server->icon_url), '/servers/'.$family->server->slug, $family->server->players_online, $family->server->players_max);
                }
                $groups['family'] = $group;
            }
            $clanGames = [];
            /** @var Collection<int, ClanMember> $memberships */
            $memberships = $clans->get($user->id, collect());
            foreach ($memberships as $clanMember) {
                $clan = $clanMember->clan;
                if ($clan === null) {
                    continue;
                }
                // Клан чи гільдія — логотип і значок гри клану (замість сервера ГТА).
                $type = self::t(Clan::TYPES[$clan->type] ?? 'Клан');
                $group = [[
                    'kind' => $clan->type === 'guild' ? 'guild' : 'clan',
                    'name' => $clan->display_name,
                    'tag' => $clan->tag,
                    'logo' => $icons->url($clan->logo_path),
                    'href' => '/clans/'.$clan->slug,
                    'role' => $clan->rankTitle($clanMember->rank),
                    'lines' => array_values(array_filter([
                        self::t(':type · :count учасників', ['type' => $type, 'count' => $clan->members_count]),
                        $clan->game ? self::t('Гра: :name', ['name' => $clan->game->name]) : null,
                    ])),
                ]];
                if ($clan->game) {
                    $clanGames[] = $clan->game->id;
                    $group[] = $this->game($clan->game->name, $this->gameLogo($clan->game), '/games/'.$clan->game->slug, self::t('Гра :type «:name»', ['type' => mb_strtolower($type), 'name' => $clan->display_name]));
                }
                $groups['clan:'.$clan->id] = $group;
            }
            $playing = $user->playing();
            if ($playing !== null && $playing['kind'] === 'game' && ! in_array($playing['id'], $clanGames, true)) {
                $playingGame = $playing['id'] !== null ? $playingGames->get((int) $playing['id']) : null;
                $groups['playing'] = [$this->game($playing['label'], $playingGame ? $this->gameLogo($playingGame) : null, $playing['url'] ?? '', self::t('Зараз грає'))];
            } elseif ($family === null && $playing !== null && $playing['kind'] === 'server' && $playing['url'] !== null) {
                $groups['playing'] = [$this->server($playing['label'], $icons->external($playing['icon']), $playing['url'], null, null)];
            }

            // Порядок, обраний людиною в налаштуваннях; решта — як за замовчуванням.
            $order = array_values(array_filter((array) $user->pref('badge_order', []), 'is_string'));
            $keys = array_keys($groups);
            usort($keys, function (string $a, string $b) use ($order, $keys): int {
                $ia = array_search($a, $order, true);
                $ib = array_search($b, $order, true);
                $ia = $ia === false ? 1000 + (int) array_search($a, $keys, true) : $ia;
                $ib = $ib === false ? 1000 + (int) array_search($b, $keys, true) : $ib;

                return $ia <=> $ib;
            });
            $badges = [];
            foreach ($keys as $key) {
                foreach ($groups[$key] as $badge) {
                    $badges[] = [...$badge, 'group' => $key];
                }
            }
            $out[$user->id] = $badges;
        }

        return $out;
    }

    /** Значок гри — зменшений логотип (іконка застосунку); якщо його ще немає — шукаємо у фоні. */
    private function gameLogo(Game $game): ?string
    {
        if ($game->logo_path === null) {
            if (GameLogoFetcher::due($game)) {
                FetchGameLogo::dispatch($game->id);
            }

            return null;
        }

        return app(BadgeIcons::class)->url($game->logo_path);
    }

    /**
     * Рядок для людини (сервер говорить українською); переклад може повернути масив — тоді ключ.
     *
     * @param  array<string, mixed>  $replace
     */
    private static function t(string $key, array $replace = []): string
    {
        $value = __($key, $replace);

        return is_string($value) ? $value : $key;
    }

    /** @return Badge */
    private function game(string $name, ?string $icon, string $href, string $line): array
    {
        return ['kind' => 'game', 'name' => $name, 'tag' => null, 'logo' => $icon, 'href' => $href, 'role' => null, 'lines' => [$line]];
    }

    /**
     * Групи значків людини для налаштувань порядку: ключ, назва й логотип першого значка.
     *
     * @return list<array{key: string, name: string, kind: string, logo: string|null}>
     */
    public function groupsOf(User $user): array
    {
        $groups = [];
        foreach ($this->forUsers([$user])[$user->id] ?? [] as $badge) {
            $groups[$badge['group']] ??= ['key' => $badge['group'], 'name' => $badge['name'], 'kind' => $badge['kind'], 'logo' => $badge['logo']];
        }

        return array_values($groups);
    }

    /** @return Badge */
    private function server(string $name, ?string $icon, string $href, ?int $online, ?int $max): array
    {
        return [
            'kind' => 'server',
            'name' => $name,
            'tag' => null,
            'logo' => $icon,
            'href' => $href,
            'role' => null,
            'lines' => $online !== null ? [self::t('Онлайн: :online / :max', ['online' => $online, 'max' => $max ?? '—'])] : [self::t('Ігровий сервер')],
        ];
    }
}
