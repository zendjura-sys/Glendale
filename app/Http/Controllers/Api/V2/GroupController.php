<?php

namespace App\Http\Controllers\Api\V2;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Social\Presenter;
use App\Social\Social;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Спільноти: відкриті й закриті, заявки, адміністратори. */
class GroupController extends Controller
{
    private function groupOr404(int $id): object
    {
        $group = Social::group($id);
        if (! $group) {
            Social::fail(404, 'Спільноту не знайдено');
        }

        return $group;
    }

    private function adminGroup(Request $request, int $id): object
    {
        $group = $this->groupOr404($id);
        if (! Social::isGroupAdmin($group->id, $request->user()->id)) {
            Social::fail(403, 'Потрібні права адміністратора спільноти');
        }

        return $group;
    }

    public function index(Request $request): JsonResponse
    {
        $search = Social::str($request->query('q'), 100);
        $query = DB::table('social_groups as g');
        if ($search !== '') {
            $query->where('g.name', 'like', '%'.$search.'%')->orderByDesc('g.id');
        } else {
            $query->leftJoin('social_group_members as m', 'm.group_id', '=', 'g.id')
                ->groupBy('g.id')->orderByRaw('COUNT(m.user_id) DESC');
        }
        $rows = $query->select('g.*')->limit(50)->get()->all();

        return response()->json(Presenter::groups($rows, $request->user()->id));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:2000'],
            'privacy' => ['nullable', 'in:open,closed'],
        ]);
        $me = $request->user()->id;

        $id = DB::transaction(function () use ($data, $me) {
            $gid = DB::table('social_groups')->insertGetId([
                'name' => trim($data['name']),
                'description' => trim((string) ($data['description'] ?? '')),
                'owner_id' => $me,
                'privacy' => ($data['privacy'] ?? 'open') === 'closed' ? 'closed' : 'open',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('social_group_members')->insert(['group_id' => $gid, 'user_id' => $me, 'role' => 'admin', 'created_at' => now()]);

            return $gid;
        });

        return response()->json(Presenter::group(Social::group($id), $me), 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $group = $this->groupOr404($id);
        $me = $request->user();
        $visible = Social::canSeeGroup($group->id, $me);

        $sample = $visible ? User::query()
            ->whereIn('id', DB::table('social_group_members')->where('group_id', $group->id)->select('user_id'))
            ->inRandomOrder()->limit(6)->get() : collect();
        $admins = User::query()
            ->whereIn('id', DB::table('social_group_members')->where('group_id', $group->id)->where('role', 'admin')->select('user_id'))
            ->get();
        $friendsInGroup = DB::table('social_group_members as m')
            ->join('social_friends as f', 'f.friend_id', '=', 'm.user_id')
            ->where('m.group_id', $group->id)->where('f.user_id', $me->id)->count();

        return response()->json([
            ...Presenter::group($group, $me->id),
            'canSeeContent' => $visible,
            'membersSample' => $sample->map(fn ($u) => Presenter::userShort($u))->values(),
            'admins' => $admins->map(fn ($u) => Presenter::userShort($u))->values(),
            'friendsInGroup' => $friendsInGroup,
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $group = $this->adminGroup($request, $id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'privacy' => ['sometimes', 'in:open,closed'],
        ]);

        $changes = [];
        if (array_key_exists('name', $data)) {
            if (trim($data['name']) === '') {
                Social::fail(400, 'Вкажіть назву спільноти');
            }
            $changes['name'] = trim($data['name']);
        }
        if (array_key_exists('description', $data)) {
            $changes['description'] = trim((string) $data['description']);
        }
        if (array_key_exists('privacy', $data)) {
            $changes['privacy'] = $data['privacy'];
        }

        DB::transaction(function () use ($group, $changes) {
            if ($changes) {
                DB::table('social_groups')->where('id', $group->id)->update([...$changes, 'updated_at' => now()]);
            }
            // Відкрили спільноту — впускаємо всіх, хто подавав заявку.
            if (($changes['privacy'] ?? null) === 'open') {
                $pending = DB::table('social_group_requests')->where('group_id', $group->id)->pluck('user_id');
                DB::table('social_group_members')->insertOrIgnore($pending->map(fn ($uid) => [
                    'group_id' => $group->id, 'user_id' => $uid, 'role' => 'member', 'created_at' => now(),
                ])->all());
                DB::table('social_group_requests')->where('group_id', $group->id)->delete();
            }
        });

        return response()->json(Presenter::group(Social::group($group->id), $request->user()->id));
    }

    public function image(Request $request, int $id, string $kind): JsonResponse
    {
        $group = $this->adminGroup($request, $id);
        $request->validate(['image' => ['required', ...Social::IMAGE_RULES]]);
        $column = $kind === 'cover' ? 'cover_path' : 'avatar_path';
        DB::table('social_groups')->where('id', $group->id)->update([
            $column => Social::storeImage($request->file('image'), 'groups'),
            'updated_at' => now(),
        ]);

        return response()->json(Presenter::group(Social::group($group->id), $request->user()->id));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $group = $this->groupOr404($id);
        if ($group->owner_id !== $request->user()->id) {
            Social::fail(403, 'Видалити спільноту може лише власник');
        }
        DB::transaction(function () use ($group) {
            DB::table('social_posts')->where('owner_type', 'group')->where('owner_id', $group->id)->delete();
            DB::table('social_groups')->where('id', $group->id)->delete();
        });

        return response()->json(['ok' => true]);
    }

    public function join(Request $request, int $id): JsonResponse
    {
        $group = $this->groupOr404($id);
        $me = $request->user()->id;

        if ($group->privacy === 'closed' && ! Social::isGroupAdmin($group->id, $me)) {
            $inserted = DB::table('social_group_requests')->insertOrIgnore(['group_id' => $group->id, 'user_id' => $me, 'created_at' => now()]);
            if ($inserted) {
                $admins = DB::table('social_group_members')->where('group_id', $group->id)->where('role', 'admin')->pluck('user_id');
                foreach ($admins as $adminId) {
                    Social::notify($adminId, $me, 'group_request', groupId: $group->id, text: $group->name);
                }
            }
        } else {
            DB::table('social_group_members')->insertOrIgnore(['group_id' => $group->id, 'user_id' => $me, 'role' => 'member', 'created_at' => now()]);
        }

        return response()->json(Presenter::group($group, $me));
    }

    public function leave(Request $request, int $id): JsonResponse
    {
        $group = $this->groupOr404($id);
        $me = $request->user()->id;
        if ($group->owner_id === $me) {
            Social::fail(400, 'Власник не може покинути спільноту');
        }
        DB::table('social_group_members')->where('group_id', $group->id)->where('user_id', $me)->delete();
        DB::table('social_group_requests')->where('group_id', $group->id)->where('user_id', $me)->delete();

        return response()->json(Presenter::group($group, $me));
    }

    public function requests(Request $request, int $id): JsonResponse
    {
        $group = $this->adminGroup($request, $id);
        $rows = DB::table('social_group_requests')->where('group_id', $group->id)->orderBy('created_at')->get();
        $users = Presenter::users($rows->pluck('user_id'));

        return response()->json($rows->map(fn ($r) => isset($users[$r->user_id])
            ? [...Presenter::userShort($users[$r->user_id]), 'requestedAt' => Presenter::ms($r->created_at)]
            : null)->filter()->values());
    }

    public function approve(Request $request, int $id, int $userId): JsonResponse
    {
        $group = $this->adminGroup($request, $id);
        $deleted = DB::table('social_group_requests')->where('group_id', $group->id)->where('user_id', $userId)->delete();
        if (! $deleted) {
            Social::fail(404, 'Заявку не знайдено');
        }
        DB::table('social_group_members')->insertOrIgnore(['group_id' => $group->id, 'user_id' => $userId, 'role' => 'member', 'created_at' => now()]);
        Social::notify($userId, $request->user()->id, 'group_accept', groupId: $group->id, text: $group->name);

        return response()->json(['ok' => true]);
    }

    public function decline(Request $request, int $id, int $userId): JsonResponse
    {
        $group = $this->adminGroup($request, $id);
        DB::table('social_group_requests')->where('group_id', $group->id)->where('user_id', $userId)->delete();

        return response()->json(['ok' => true]);
    }

    public function members(Request $request, int $id): JsonResponse
    {
        $group = $this->groupOr404($id);
        if (! Social::canSeeGroup($group->id, $request->user())) {
            Social::fail(403, 'Це закрита спільнота', 'closed_group');
        }
        $rows = DB::table('social_group_members')->where('group_id', $group->id)->orderBy('role')->limit(500)->get();
        $users = Presenter::users($rows->pluck('user_id'));

        return response()->json($rows->map(fn ($m) => isset($users[$m->user_id])
            ? [...Presenter::userShort($users[$m->user_id]), 'role' => $m->user_id === $group->owner_id ? 'owner' : $m->role]
            : null)->filter()->values());
    }

    public function setRole(Request $request, int $id, int $userId): JsonResponse
    {
        $group = $this->adminGroup($request, $id);
        if ($userId === $group->owner_id) {
            Social::fail(400, 'Роль власника змінити не можна');
        }
        if (! Social::isGroupMember($group->id, $userId)) {
            Social::fail(404, 'Учасника не знайдено');
        }
        $role = $request->input('role') === 'admin' ? 'admin' : 'member';
        // Лише власник може забрати права в іншого адміністратора.
        if ($role !== 'admin' && Social::isGroupAdmin($group->id, $userId) && $group->owner_id !== $request->user()->id) {
            Social::fail(403, 'Зняти адміністратора може лише власник');
        }
        DB::table('social_group_members')->where('group_id', $group->id)->where('user_id', $userId)->update(['role' => $role]);

        return response()->json(['ok' => true]);
    }

    public function kick(Request $request, int $id, int $userId): JsonResponse
    {
        $group = $this->adminGroup($request, $id);
        if ($userId === $group->owner_id) {
            Social::fail(400, 'Власника виключити не можна');
        }
        if (Social::isGroupAdmin($group->id, $userId) && $group->owner_id !== $request->user()->id) {
            Social::fail(403, 'Виключити адміністратора може лише власник');
        }
        DB::table('social_group_members')->where('group_id', $group->id)->where('user_id', $userId)->delete();

        return response()->json(['ok' => true]);
    }
}
