<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Social\Families;
use App\Social\GameProjects;
use App\Social\Presenter;
use App\Social\ProjectLogos;
use App\Social\ProjectServers;
use App\Social\Social;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Система управління родинами — перевірка родин і союзів адміністрацією
 * платформи (право families.manage). Рішення сповіщає лідера.
 */
class FamilyController extends Controller
{
    public const STATUSES = ['pending', 'verified', 'rejected'];

    public function index(Request $request): Response
    {
        $status = in_array($request->query('status'), self::STATUSES, true) ? $request->query('status') : 'pending';

        $families = DB::table('families')->where('status', $status)->orderByDesc('updated_at')->limit(200)->get();
        $leaders = Presenter::users($families->pluck('leader_id'));
        $counts = DB::table('family_members')->whereIn('family_id', $families->pluck('id'))->groupBy('family_id')
            ->selectRaw('family_id, COUNT(*) as c')->pluck('c', 'family_id');

        $unions = DB::table('family_unions')->where('status', $status)->orderByDesc('updated_at')->limit(200)->get();
        $founders = DB::table('families')->whereIn('id', $unions->pluck('founder_family_id'))->pluck('name', 'id');

        $pending = [
            'families' => DB::table('families')->where('status', 'pending')->count(),
            'unions' => DB::table('family_unions')->where('status', 'pending')->count(),
        ];

        return Inertia::render('Admin/Families/Index', [
            'projects' => GameProjects::directory(null, true),
            'status' => $status,
            'pending' => $pending,
            'families' => $families->map(fn ($f) => [
                'id' => $f->id,
                'name' => $f->name,
                'tag' => $f->tag,
                'project' => $f->project,
                'server' => $f->server,
                'description' => (string) $f->description,
                'discordUrl' => $f->discord_url,
                'telegramUrl' => $f->telegram_url,
                'avatar' => Social::url($f->avatar_path),
                'proof' => Social::url($f->proof_path),
                'leader' => isset($leaders[$f->leader_id]) ? $leaders[$f->leader_id]->fullName() : null,
                'leaderId' => $f->leader_id,
                'membersCount' => (int) ($counts[$f->id] ?? 0),
                'reviewNote' => $f->review_note,
                'createdAt' => (string) $f->created_at,
            ])->values(),
            'unions' => $unions->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'tag' => $u->tag,
                'description' => (string) $u->description,
                'founder' => $founders[$u->founder_family_id] ?? null,
                'reviewNote' => $u->review_note,
                'createdAt' => (string) $u->created_at,
            ])->values(),
        ]);
    }

    public function verifyFamily(Request $request, int $family): RedirectResponse
    {
        return $this->decide($request, 'families', $family, 'verified');
    }

    public function rejectFamily(Request $request, int $family): RedirectResponse
    {
        return $this->decide($request, 'families', $family, 'rejected');
    }

    public function verifyUnion(Request $request, int $union): RedirectResponse
    {
        return $this->decide($request, 'family_unions', $union, 'verified');
    }

    public function rejectUnion(Request $request, int $union): RedirectResponse
    {
        return $this->decide($request, 'family_unions', $union, 'rejected');
    }

    private function decide(Request $request, string $table, int $id, string $status): RedirectResponse
    {
        $data = $request->validate([
            'note' => [$status === 'rejected' ? 'required' : 'nullable', 'string', 'max:1000'],
        ], ['note.required' => 'Поясніть лідеру, чому відхилено й що виправити.']);

        $row = DB::table($table)->find($id);
        abort_unless($row, 404);

        DB::table($table)->where('id', $id)->update([
            'status' => $status,
            'review_note' => $data['note'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'verified_at' => $status === 'verified' ? now() : null,
            'updated_at' => now(),
        ]);

        $isFamily = $table === 'families';
        if ($isFamily && $status === 'verified') {
            GameProjects::approveFor($row);
        }
        $type = ($isFamily ? 'family_' : 'union_').($status === 'verified' ? 'verified' : 'rejected');
        $familyId = $isFamily ? $row->id : $row->founder_family_id;
        Families::notifyManagers($familyId, $request->user()->id, $type, $row->name, $isFamily ? null : $row->id);

        return back()->with('status', ($isFamily ? 'Родину' : 'Союз').' «'.$row->name.'» '.($status === 'verified' ? 'підтверджено.' : 'відхилено.'));
    }

    // ───────────── довідник проєктів і серверів ─────────────

    public function storeProject(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60', 'unique:game_projects,name'],
            'website' => ['nullable', 'string', 'max:190'],
            'logo' => ['nullable', ...Social::IMAGE_RULES],
        ]);
        $website = ProjectLogos::normalize((string) ($data['website'] ?? ''));
        $id = DB::table('game_projects')->insertGetId([
            'name' => trim($data['name']),
            'website' => $website,
            'logo_path' => $request->hasFile('logo') ? Social::storeImage($request->file('logo'), 'projects') : null,
            'approved' => true,
            'created_by' => $request->user()->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        // Файлу немає, але вказано сайт — логотип підтягує сервер.
        $fetched = ! $request->hasFile('logo') && $website && ProjectLogos::fetch(DB::table('game_projects')->find($id));

        return back()->with('status', 'Проєкт «'.trim($data['name']).'» додано'.($fetched ? ', логотип підтягнуто з сайту.' : '.'));
    }

    /** Сервери — списком, по одному на рядок; наявні пропускаються. */
    public function storeServers(Request $request, int $project): RedirectResponse
    {
        abort_unless(DB::table('game_projects')->where('id', $project)->exists(), 404);
        $data = $request->validate(['names' => ['required', 'string', 'max:5000']]);

        // По одному на рядок, вручну: номер 1–999 або назва літерами.
        [$names, $invalid] = collect(preg_split('/\R/u', $data['names']))->map(fn ($n) => trim($n))->filter(fn ($n) => $n !== '')
            ->partition(fn ($n) => ProjectServers::valid($n));
        $names = $names->unique(fn ($n) => mb_strtolower($n));
        if ($names->isEmpty()) {
            return back()->withErrors(['names' => ProjectServers::NAME_HINT]);
        }
        $existing = DB::table('game_servers')->where('project_id', $project)->pluck('name')->map(fn ($n) => mb_strtolower($n))->flip();
        $rows = $names->reject(fn ($n) => isset($existing[mb_strtolower($n)]))->values()
            ->map(fn ($name) => ['project_id' => $project, 'name' => $name, 'approved' => true, 'sort' => 100, 'created_by' => $request->user()->id, 'created_at' => now(), 'updated_at' => now()]);
        foreach ($rows->chunk(200) as $chunk) {
            DB::table('game_servers')->insert($chunk->all());
        }
        $added = $rows->count();

        $skipped = $invalid->count() ? ' Пропущено некоректних: '.$invalid->count().' ('.ProjectServers::NAME_HINT.')' : '';

        return back()->with('status', "Додано серверів: {$added}.{$skipped}");
    }

    /** Ілюстрація проєкту для довідника (каталог, форма реєстрації). */
    public function projectLogo(Request $request, int $project): RedirectResponse
    {
        abort_unless(DB::table('game_projects')->where('id', $project)->exists(), 404);
        $request->validate(['logo' => ['required', ...Social::IMAGE_RULES]]);
        DB::table('game_projects')->where('id', $project)->update([
            'logo_path' => Social::storeImage($request->file('logo'), 'projects'),
            'updated_at' => now(),
        ]);

        return back()->with('status', 'Логотип проєкту оновлено.');
    }

    /** Сайт проєкту й логотип звідти (завантажує сервер). */
    public function projectWebsite(Request $request, int $project): RedirectResponse
    {
        $row = DB::table('game_projects')->find($project);
        abort_unless($row, 404);
        $data = $request->validate(['website' => ['nullable', 'string', 'max:190']]);
        $site = ProjectLogos::normalize((string) ($data['website'] ?? ''));
        if (($data['website'] ?? '') !== '' && $site === null) {
            return back()->withErrors(['website' => 'Некоректна адреса сайту.']);
        }
        DB::table('game_projects')->where('id', $project)->update(['website' => $site, 'updated_at' => now()]);
        if ($site === null) {
            return back()->with('status', 'Сайт проєкту прибрано.');
        }

        return ProjectLogos::fetch(DB::table('game_projects')->find($project))
            ? back()->with('status', 'Логотип підтягнуто з сайту.')
            : back()->withErrors(['website' => 'Сайт збережено, але логотип звідти завантажити не вдалося — завантажте файл вручну.']);
    }

    /** Джерело автозаповнення серверів і негайна синхронізація. */
    public function projectServersSource(Request $request, int $project): RedirectResponse
    {
        abort_unless(DB::table('game_projects')->where('id', $project)->exists(), 404);
        $data = $request->validate(['source' => ['nullable', 'in:'.implode(',', array_keys(ProjectServers::SOURCES))]]);
        DB::table('game_projects')->where('id', $project)->update(['servers_source' => $data['source'] ?? null, 'updated_at' => now()]);
        if (! ($data['source'] ?? null)) {
            return back()->with('status', 'Автозаповнення серверів вимкнено.');
        }
        $count = ProjectServers::sync(DB::table('game_projects')->find($project));

        return $count === null
            ? back()->withErrors(['source' => 'Список серверів зараз недоступний — спробую пізніше за розкладом.'])
            : back()->with('status', "Сервери синхронізовано: знайдено {$count}.");
    }

    public function approveProject(int $project): RedirectResponse
    {
        DB::table('game_projects')->where('id', $project)->update(['approved' => true, 'updated_at' => now()]);

        return back();
    }

    public function destroyProject(int $project): RedirectResponse
    {
        DB::table('game_projects')->where('id', $project)->delete();

        return back()->with('status', 'Проєкт видалено.');
    }

    public function approveServer(int $server): RedirectResponse
    {
        DB::table('game_servers')->where('id', $server)->update(['approved' => true, 'updated_at' => now()]);

        return back();
    }

    public function destroyServer(int $server): RedirectResponse
    {
        DB::table('game_servers')->where('id', $server)->delete();

        return back()->with('status', 'Сервер видалено.');
    }
}
