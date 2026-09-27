<?php

namespace App\Http\Controllers\Api\V2;

use App\Http\Controllers\Controller;
use App\Social\Families;
use App\Social\GameProjects;
use App\Social\Presenter;
use App\Social\Social;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Реєстрація родин і керування ними. Нова родина — pending, поки
 * адміністрація не перевірить її (Admin\FamilyController).
 */
class FamilyController extends Controller
{
    private function familyOr404(int $id, Request $request): object
    {
        $family = Families::find($id);
        if (! $family || ! Families::canView($family, $request->user())) {
            Social::fail(404, 'Родину не знайдено');
        }

        return $family;
    }

    private function managed(int $id, Request $request): object
    {
        $family = $this->familyOr404($id, $request);
        if (! Families::canManage($family, $request->user())) {
            Social::fail(403, 'Потрібні права лідера або заступника родини');
        }

        return $family;
    }

    /**
     * Довідник проєктів і серверів (усі — на одному сайті) — для вибору у
     * формі реєстрації й фільтра каталогу.
     */
    public function projects(Request $request): JsonResponse
    {
        return response()->json(GameProjects::directory($request->user()));
    }

    public function index(Request $request): JsonResponse
    {
        $q = Social::str($request->query('q'), 60);
        $projectId = (int) $request->query('projectId');
        $rows = DB::table('families')->where('status', 'verified')
            ->when($projectId > 0, fn ($query) => $query->where('project_id', $projectId))
            ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w->where('name', 'like', "%{$q}%")
                ->orWhere('tag', 'like', "%{$q}%")->orWhere('server', 'like', "%{$q}%")->orWhere('project', 'like', "%{$q}%")))
            ->orderBy('name')->limit(100)->get()->all();

        return response()->json(Families::presentMany($rows, $request->user()));
    }

    /** Мої родини — з будь-яким статусом (зокрема на перевірці й відхилені). */
    public function mine(Request $request): JsonResponse
    {
        $rows = DB::table('family_members as m')->join('families as f', 'f.id', '=', 'm.family_id')
            ->where('m.user_id', $request->user()->id)->select('f.*')->orderBy('f.name')->get()->all();

        return response()->json(Families::presentMany($rows, $request->user()));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'tag' => ['nullable', 'string', 'max:8', 'regex:/^[\pL\pN_.-]+$/u'],
            'projectId' => ['nullable', 'integer'],
            'project' => ['nullable', 'string', 'max:60'],
            'serverId' => ['nullable', 'integer'],
            'server' => ['nullable', 'string', 'max:60'],
            'projectLogo' => ['nullable', ...Social::IMAGE_RULES],
            'description' => ['nullable', 'string', 'max:3000'],
            'discordUrl' => ['nullable', 'url', 'max:255'],
            'telegramUrl' => ['nullable', 'url', 'max:255'],
            'proof' => ['required', ...Social::IMAGE_RULES],
        ], [
            'proof.required' => 'Додайте скріншот родини з гри — без нього адміністрація не зможе її перевірити.',
        ]);
        $me = $request->user();
        $place = GameProjects::resolve($request, $me);

        if (Families::memberOnServer($me->id, $place['serverId'])) {
            Social::fail(409, 'Ви вже в родині на цьому сервері. Спершу вийдіть з неї.');
        }
        $pending = DB::table('families')->where('leader_id', $me->id)->where('status', 'pending')->count();
        if ($pending >= 3) {
            Social::fail(429, 'У вас уже є заявки на перевірці — дочекайтеся рішення.');
        }
        $duplicate = DB::table('families')->where('status', '!=', 'rejected')
            ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim($data['name']))])
            ->where('server_id', $place['serverId'])
            ->exists();
        if ($duplicate) {
            Social::fail(409, 'Родина з такою назвою на цьому сервері вже зареєстрована.');
        }

        $id = DB::transaction(function () use ($data, $me, $request, $place) {
            $fid = DB::table('families')->insertGetId([
                'name' => trim($data['name']),
                'tag' => isset($data['tag']) ? mb_strtoupper(trim($data['tag'])) : null,
                'project_id' => $place['projectId'],
                'server_id' => $place['serverId'],
                'project' => $place['project'],
                'server' => $place['server'],
                'description' => trim((string) ($data['description'] ?? '')),
                'discord_url' => $data['discordUrl'] ?? null,
                'telegram_url' => $data['telegramUrl'] ?? null,
                'proof_path' => Social::storeImage($request->file('proof'), 'families/proofs'),
                'leader_id' => $me->id,
                'status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('family_members')->insert(['family_id' => $fid, 'user_id' => $me->id, 'role' => 'leader', 'created_at' => now()]);

            return $fid;
        });

        return response()->json(Families::presentFull(Families::find($id), $me), 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return response()->json(Families::presentFull($this->familyOr404($id, $request), $request->user()));
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $family = $this->managed($id, $request);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:60'],
            'tag' => ['sometimes', 'nullable', 'string', 'max:8', 'regex:/^[\pL\pN_.-]+$/u'],
            'projectId' => ['sometimes', 'nullable', 'integer'],
            'project' => ['sometimes', 'nullable', 'string', 'max:60'],
            'serverId' => ['sometimes', 'nullable', 'integer'],
            'server' => ['sometimes', 'nullable', 'string', 'max:60'],
            'projectLogo' => ['nullable', ...Social::IMAGE_RULES],
            'description' => ['sometimes', 'nullable', 'string', 'max:3000'],
            'discordUrl' => ['sometimes', 'nullable', 'url', 'max:255'],
            'telegramUrl' => ['sometimes', 'nullable', 'url', 'max:255'],
        ]);

        // Назву, проєкт і сервер перевіряла адміністрація — після
        // верифікації їх не змінити без нової перевірки.
        $identity = array_intersect_key($data, array_flip(['name', 'project', 'server', 'projectId', 'serverId']));
        if ($identity && $family->status === 'verified') {
            Social::fail(403, 'Назву, проєкт і сервер верифікованої родини змінює адміністрація.');
        }

        $changes = ['updated_at' => now()];
        if (array_intersect_key($data, array_flip(['project', 'server', 'projectId', 'serverId']))) {
            $place = GameProjects::resolve($request, $request->user());
            $changes += ['project_id' => $place['projectId'], 'server_id' => $place['serverId'], 'project' => $place['project'], 'server' => $place['server']];
        }
        foreach (['name' => 'name', 'description' => 'description', 'discordUrl' => 'discord_url', 'telegramUrl' => 'telegram_url'] as $key => $column) {
            if (array_key_exists($key, $data)) {
                $changes[$column] = is_string($data[$key]) ? trim($data[$key]) : $data[$key];
            }
        }
        if (array_key_exists('tag', $data)) {
            $changes['tag'] = $data['tag'] ? mb_strtoupper(trim($data['tag'])) : null;
        }
        DB::table('families')->where('id', $family->id)->update($changes);

        return response()->json(Families::presentFull(Families::find($family->id), $request->user()));
    }

    public function image(Request $request, int $id, string $kind): JsonResponse
    {
        $family = $this->managed($id, $request);
        $request->validate(['image' => ['required', ...Social::IMAGE_RULES]]);
        $column = match ($kind) {
            'cover' => 'cover_path',
            'proof' => 'proof_path',
            default => 'avatar_path',
        };
        if ($kind === 'proof' && $family->status === 'verified') {
            Social::fail(400, 'Родину вже перевірено');
        }
        DB::table('families')->where('id', $family->id)->update([
            $column => Social::storeImage($request->file('image'), $kind === 'proof' ? 'families/proofs' : 'families'),
            'updated_at' => now(),
        ]);

        return response()->json(Families::presentFull(Families::find($family->id), $request->user()));
    }

    /** Відхилену родину лідер виправляє й подає на перевірку знову. */
    public function resubmit(Request $request, int $id): JsonResponse
    {
        $family = $this->familyOr404($id, $request);
        if (Families::role($family->id, $request->user()->id) !== 'leader') {
            Social::fail(403, 'Подати родину на перевірку може лише лідер');
        }
        if ($family->status !== 'rejected') {
            Social::fail(400, 'Родина не відхилена');
        }
        DB::table('families')->where('id', $family->id)->update(['status' => 'pending', 'updated_at' => now()]);

        return response()->json(Families::presentFull(Families::find($family->id), $request->user()));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $family = $this->familyOr404($id, $request);
        if (Families::role($family->id, $request->user()->id) !== 'leader' && ! Families::isAdmin($request->user())) {
            Social::fail(403, 'Розпустити родину може лише лідер');
        }
        DB::table('families')->where('id', $family->id)->delete();

        return response()->json(['ok' => true]);
    }

    // ───────────── вступ і склад ─────────────

    public function join(Request $request, int $id): JsonResponse
    {
        $family = $this->familyOr404($id, $request);
        $me = $request->user();
        if ($family->status !== 'verified') {
            Social::fail(400, 'Вступити можна лише до верифікованої родини');
        }
        if (Families::role($family->id, $me->id)) {
            Social::fail(409, 'Ви вже в цій родині');
        }
        if (Families::memberOnServer($me->id, $family->server_id)) {
            Social::fail(409, 'Ви вже в іншій родині на цьому сервері');
        }

        $inserted = DB::table('family_join_requests')->insertOrIgnore([
            'family_id' => $family->id,
            'user_id' => $me->id,
            'message' => Social::str($request->input('message'), 300),
            'created_at' => now(),
        ]);
        if ($inserted) {
            Families::notifyManagers($family->id, $me->id, 'family_join_request', $family->name);
        }

        return response()->json(Families::presentFull($family, $me));
    }

    /** Скасувати заявку або вийти з родини (лідер спершу передає лідерство). */
    public function leave(Request $request, int $id): JsonResponse
    {
        $family = $this->familyOr404($id, $request);
        $me = $request->user();
        if (Families::role($family->id, $me->id) === 'leader') {
            Social::fail(400, 'Лідер не може вийти — спершу передайте лідерство або розпустіть родину');
        }
        DB::table('family_members')->where('family_id', $family->id)->where('user_id', $me->id)->delete();
        DB::table('family_join_requests')->where('family_id', $family->id)->where('user_id', $me->id)->delete();

        return response()->json(Families::presentFull($family, $me));
    }

    public function requests(Request $request, int $id): JsonResponse
    {
        $family = $this->managed($id, $request);
        $rows = DB::table('family_join_requests')->where('family_id', $family->id)->orderBy('created_at')->get();
        $users = Presenter::users($rows->pluck('user_id'));

        return response()->json($rows->map(fn ($r) => isset($users[$r->user_id]) ? [
            ...Presenter::userShort($users[$r->user_id]),
            'message' => $r->message,
            'requestedAt' => Presenter::ms($r->created_at),
        ] : null)->filter()->values());
    }

    public function approve(Request $request, int $id, int $userId): JsonResponse
    {
        $family = $this->managed($id, $request);
        if (! DB::table('family_join_requests')->where('family_id', $family->id)->where('user_id', $userId)->exists()) {
            Social::fail(404, 'Заявку не знайдено');
        }
        if (Families::memberOnServer($userId, $family->server_id)) {
            DB::table('family_join_requests')->where('family_id', $family->id)->where('user_id', $userId)->delete();
            Social::fail(409, 'Гравець уже в іншій родині на цьому сервері');
        }

        DB::transaction(function () use ($family, $userId) {
            DB::table('family_join_requests')->where('family_id', $family->id)->where('user_id', $userId)->delete();
            DB::table('family_members')->insertOrIgnore(['family_id' => $family->id, 'user_id' => $userId, 'role' => 'member', 'created_at' => now()]);
        });
        Families::notify($userId, $request->user()->id, 'family_join_accepted', $family->id, text: $family->name);

        return response()->json(['ok' => true]);
    }

    public function decline(Request $request, int $id, int $userId): JsonResponse
    {
        $family = $this->managed($id, $request);
        DB::table('family_join_requests')->where('family_id', $family->id)->where('user_id', $userId)->delete();

        return response()->json(['ok' => true]);
    }

    public function members(Request $request, int $id): JsonResponse
    {
        $family = $this->familyOr404($id, $request);
        $rows = DB::table('family_members')->where('family_id', $family->id)
            ->orderByRaw("CASE role WHEN 'leader' THEN 0 WHEN 'deputy' THEN 1 ELSE 2 END")->orderBy('created_at')->get();
        $users = Presenter::users($rows->pluck('user_id'));

        return response()->json($rows->map(fn ($m) => isset($users[$m->user_id]) ? [
            ...Presenter::userShort($users[$m->user_id]),
            'role' => $m->role,
            'roleLabel' => Families::ROLE_LABELS[$m->role] ?? $m->role,
            'joinedAt' => Presenter::ms($m->created_at),
        ] : null)->filter()->values());
    }

    /**
     * Змінити роль: заступника призначає лідер; передача лідерства
     * (role=leader) робить поточного лідера заступником.
     */
    public function setRole(Request $request, int $id, int $userId): JsonResponse
    {
        $family = $this->familyOr404($id, $request);
        $me = $request->user();
        $role = $request->input('role');
        if (! in_array($role, Families::ROLES, true)) {
            Social::fail(400, 'Невідома роль');
        }
        if (Families::role($family->id, $me->id) !== 'leader') {
            Social::fail(403, 'Ролі в родині змінює лідер');
        }
        $current = Families::role($family->id, $userId);
        if (! $current || $userId === $me->id) {
            Social::fail(404, 'Учасника не знайдено');
        }

        DB::transaction(function () use ($family, $me, $userId, $role) {
            if ($role === 'leader') {
                DB::table('family_members')->where('family_id', $family->id)->where('user_id', $me->id)->update(['role' => 'deputy']);
                DB::table('families')->where('id', $family->id)->update(['leader_id' => $userId, 'updated_at' => now()]);
            }
            DB::table('family_members')->where('family_id', $family->id)->where('user_id', $userId)->update(['role' => $role]);
        });

        return response()->json(['ok' => true]);
    }

    public function kick(Request $request, int $id, int $userId): JsonResponse
    {
        $family = $this->managed($id, $request);
        $target = Families::role($family->id, $userId);
        if ($target === 'leader') {
            Social::fail(400, 'Лідера виключити не можна');
        }
        if ($target === 'deputy' && Families::role($family->id, $request->user()->id) !== 'leader') {
            Social::fail(403, 'Виключити заступника може лише лідер');
        }
        DB::table('family_members')->where('family_id', $family->id)->where('user_id', $userId)->delete();

        return response()->json(['ok' => true]);
    }
}
