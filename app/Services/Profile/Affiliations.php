<?php

namespace App\Services\Profile;

use App\Models\Clan;
use App\Models\ClanMember;
use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\User;
use App\Support\Modules\ModuleManager;
use Illuminate\Support\Collection;

/**
 * Значки біля ніка: зменшені копії логотипів сім'ї, клану (гільдії), сервера й гри, у якій людина зараз
 * (BadgeIcons). Кожен значок — логотип із відповідного розділу, назва й рядки для підказки при наведенні.
 *
 * @phpstan-type Badge array{kind: string, name: string, tag: string|null, logo: string|null, href: string, role: string|null, lines: list<string>}
 */
class Affiliations
{
    /** @var array<int, list<Badge>> значки, уже зібрані в цьому запиті */
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

    /** @return list<Badge> */
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
     * @return array<int, list<Badge>>
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
            /** @var Collection<int, ClanMember> $clans */
            $clans = ClanMember::query()->with('clan.game')
                ->whereIn('user_id', $ids)
                ->where('status', ClanMember::STATUS_ACTIVE)
                ->get()->filter(fn (ClanMember $m) => $m->clan !== null)->unique('user_id')->keyBy('user_id');
        }

        $icons = app(BadgeIcons::class);
        foreach ($users as $user) {
            $badges = [];
            $member = $families->get($user->id);
            $family = $member?->family;
            if ($member && $family) {
                $badges[] = [
                    'kind' => 'family',
                    'name' => $family->name,
                    'tag' => $family->tag,
                    'logo' => $icons->url($family->logo_path),
                    'href' => '/f/'.$family->slug,
                    'role' => $family->rankTitle($member->rank),
                    'lines' => array_values(array_filter([
                        __('Сім’я · :count учасників', ['count' => $family->members_count]),
                        $family->server ? __('Сервер: :name', ['name' => $family->server->name]) : null,
                    ])),
                ];
            }
            $clanMember = $clans->get($user->id);
            $clan = $clanMember?->clan;
            if ($clanMember && $clan) {
                $badges[] = [
                    'kind' => 'clan',
                    'name' => $clan->display_name,
                    'tag' => $clan->tag,
                    'logo' => $icons->url($clan->logo_path),
                    'href' => '/clans/'.$clan->slug,
                    'role' => $clan->rankTitle($clanMember->rank),
                    'lines' => array_values(array_filter([
                        __(':type · :count учасників', ['type' => __(Clan::TYPES[$clan->type] ?? 'Клан'), 'count' => $clan->members_count]),
                        $clan->game ? __('Гра: :name', ['name' => $clan->game->name]) : null,
                    ])),
                ];
            }
            $server = $family?->server;
            $playing = $user->playing();
            if ($server !== null) {
                $badges[] = $this->server($server->name, $icons->url($server->icon_path) ?? $icons->external($server->icon_url), '/servers/'.$server->slug, $server->players_online, $server->players_max);
            } elseif ($playing !== null && $playing['kind'] === 'server' && $playing['url'] !== null) {
                $badges[] = $this->server($playing['label'], $icons->external($playing['icon']), $playing['url'], null, null);
            }
            if ($playing !== null && $playing['kind'] === 'game') {
                $badges[] = [
                    'kind' => 'game',
                    'name' => $playing['label'],
                    'tag' => null,
                    'logo' => $playing['icon'],
                    'href' => $playing['url'] ?? '',
                    'role' => null,
                    'lines' => [__('Зараз грає')],
                ];
            }
            $out[$user->id] = $badges;
        }

        return $out;
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
            'lines' => $online !== null ? [__('Онлайн: :online / :max', ['online' => $online, 'max' => $max ?? '—'])] : [__('Ігровий сервер')],
        ];
    }
}
