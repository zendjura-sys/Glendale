<?php

namespace App\Social;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Довідник проєктів і серверів (усі — на одному сайті). Родина обирає зі
 * списку за id або вписує свою назву: нова позиція створюється
 * непідтвердженою й підтверджується разом із родиною.
 */
final class GameProjects
{
    /** @return list<array{id:int, name:string, logo:?string, website:?string, approved:bool, families:int, servers:list<array{id:int, name:string, approved:bool}>}> */
    public static function directory(?User $me = null, bool $withPending = false): array
    {
        $projects = DB::table('game_projects')
            ->when(! $withPending, fn ($q) => $q->where(fn ($w) => $w->where('approved', true)->when($me, fn ($o) => $o->orWhere('created_by', $me->id))))
            ->orderBy('sort')->orderBy('name')->get();
        $servers = DB::table('game_servers')->whereIn('project_id', $projects->pluck('id'))
            ->when(! $withPending, fn ($q) => $q->where(fn ($w) => $w->where('approved', true)->when($me, fn ($o) => $o->orWhere('created_by', $me->id))))
            ->orderBy('sort')->orderByRaw('LENGTH(name)')->orderBy('name')->get()->groupBy('project_id');
        $families = DB::table('families')->where('status', 'verified')->whereNotNull('project_id')
            ->groupBy('project_id')->selectRaw('project_id, COUNT(*) as c')->pluck('c', 'project_id');

        return $projects->map(fn ($p) => [
            'id' => $p->id,
            'name' => $p->name,
            'logo' => Social::url($p->logo_path ?? null),
            'website' => $p->website ?? null,
            'approved' => (bool) $p->approved,
            'families' => (int) ($families[$p->id] ?? 0),
            'serversSource' => $p->servers_source ?? null,
            'serversSyncedAt' => isset($p->servers_synced_at) ? Presenter::ms($p->servers_synced_at) : null,
            'servers' => ($servers[$p->id] ?? collect())->map(fn ($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'approved' => (bool) $s->approved,
                'address' => $s->address ?? null,
                'players' => isset($s->players) ? (int) $s->players : null,
                'maxPlayers' => isset($s->max_players) ? (int) $s->max_players : null,
            ])->values()->all(),
        ])->values()->all();
    }

    /**
     * Проєкт і сервер із запиту: projectId/serverId (зі списку) або
     * project/server (назва — знайти або додати нову; до нового проєкту
     * гравець може одразу додати логотип — projectLogo).
     *
     * @return array{projectId:int, project:string, serverId:int, server:string}
     */
    public static function resolve(Request $request, User $me): array
    {
        $project = null;
        if ($request->filled('projectId')) {
            $project = DB::table('game_projects')->find((int) $request->input('projectId'));
        } elseif (($name = Social::str($request->input('project'), 60)) !== '') {
            $project = DB::table('game_projects')->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first();
            if (! $project) {
                $logo = $request->file('projectLogo');
                $id = DB::table('game_projects')->insertGetId([
                    'name' => $name, 'approved' => false, 'created_by' => $me->id,
                    'logo_path' => $logo ? Social::storeImage($logo, 'projects') : null,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
                $project = DB::table('game_projects')->find($id);
            }
        }
        if (! $project) {
            Social::fail(422, 'Оберіть проєкт або впишіть свій');
        }

        $server = null;
        if ($request->filled('serverId')) {
            $server = DB::table('game_servers')->where('project_id', $project->id)->find((int) $request->input('serverId'));
        } elseif (($name = Social::str($request->input('server'), 60)) !== '') {
            if (! ProjectServers::valid($name)) {
                Social::fail(422, ProjectServers::NAME_HINT);
            }
            $server = DB::table('game_servers')->where('project_id', $project->id)->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first()
                ?? self::byNumber($project->id, $name);
            if (! $server) {
                $id = DB::table('game_servers')->insertGetId(['project_id' => $project->id, 'name' => $name, 'approved' => false, 'created_by' => $me->id, 'created_at' => now(), 'updated_at' => now()]);
                $server = DB::table('game_servers')->find($id);
            }
        }
        if (! $server) {
            Social::fail(422, 'Оберіть сервер або впишіть номер чи назву свого');
        }

        return ['projectId' => $project->id, 'project' => $project->name, 'serverId' => $server->id, 'server' => $server->name];
    }

    /** «1», «#1», «Server 1» → наявний «Сервер 1» (якщо номер у проєкті однозначний). */
    private static function byNumber(int $projectId, string $name): ?object
    {
        $n = ProjectServers::number($name);
        if ($n === null) {
            return null;
        }
        $hits = DB::table('game_servers')->where('project_id', $projectId)->get()->filter(fn ($s) => ProjectServers::number($s->name) === $n);

        return $hits->count() === 1 ? $hits->first() : null;
    }

    /** Родину підтверджено — її новий проєкт і сервер теж стають загальнодоступними. */
    public static function approveFor(object $family): void
    {
        if ($family->project_id) {
            DB::table('game_projects')->where('id', $family->project_id)->update(['approved' => true, 'updated_at' => now()]);
        }
        if ($family->server_id) {
            DB::table('game_servers')->where('id', $family->server_id)->update(['approved' => true, 'updated_at' => now()]);
        }
    }
}
