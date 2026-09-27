<?php

namespace App\Http\Controllers\Api\V2;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Social\Families;
use App\Social\Social;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Союзи родин. Створює лідер верифікованої родини (вона стає
 * засновницею), союз проходить перевірку адміністрацією так само, як
 * родина. Інші верифіковані родини подають заявки — засновниця приймає.
 * Родина — щонайбільше в одному союзі.
 */
class UnionController extends Controller
{
    private function unionOr404(int $id, Request $request): object
    {
        $union = DB::table('family_unions')->find($id);
        if (! $union) {
            Social::fail(404, 'Союз не знайдено');
        }
        $member = DB::table('family_union_members as m')->join('family_members as fm', 'fm.family_id', '=', 'm.family_id')
            ->where('m.union_id', $union->id)->where('fm.user_id', $request->user()->id)->exists();
        if ($union->status !== 'verified' && ! $member && ! Families::isAdmin($request->user())) {
            Social::fail(404, 'Союз не знайдено');
        }

        return $union;
    }

    /** Лідер родини-засновниці. */
    private function founderLeader(object $union, User $user): bool
    {
        return Families::role($union->founder_family_id, $user->id) === 'leader';
    }

    /** Родина, від імені якої діє користувач: він має бути її лідером. */
    private function ledFamily(Request $request): object
    {
        $family = Families::find((int) $request->input('familyId'));
        if (! $family || Families::role($family->id, $request->user()->id) !== 'leader') {
            Social::fail(403, 'Діяти від імені родини може лише її лідер');
        }
        if ($family->status !== 'verified') {
            Social::fail(400, 'Родина ще не верифікована');
        }

        return $family;
    }

    private function full(object $union, Request $request): array
    {
        $me = $request->user();
        $families = DB::table('family_union_members as m')->join('families as f', 'f.id', '=', 'm.family_id')
            ->where('m.union_id', $union->id)->orderByRaw("CASE m.role WHEN 'founder' THEN 0 ELSE 1 END")->orderBy('f.name')
            ->get(['f.*', 'm.role as union_role']);
        $led = collect(Families::ledFamilies($me));
        $ledIds = $led->pluck('id')->all();
        $founder = $this->founderLeader($union, $me);

        return [
            ...Families::presentUnions([$union], $me)[0],
            'families' => $families->map(fn ($f) => [...Families::present($f, $me), 'unionRole' => $f->union_role])->values(),
            'isFounder' => $founder,
            'reviewNote' => ($founder || Families::isAdmin($me)) ? $union->review_note : null,
            'requestsCount' => $founder ? DB::table('family_union_requests')->where('union_id', $union->id)->count() : 0,
            // Родини, якими я керую, і їхній стан щодо цього союзу — для кнопок.
            'myFamilies' => $led->map(fn ($f) => [
                'id' => $f->id,
                'name' => $f->name,
                'status' => $f->status,
                'inUnion' => Families::unionOf($f->id)?->id,
                'requested' => DB::table('family_union_requests')->where('union_id', $union->id)->where('family_id', $f->id)->exists(),
            ])->values(),
            'canJoin' => $union->status === 'verified' && $led->contains(fn ($f) => $f->status === 'verified' && ! Families::unionOf($f->id)),
            'ledFamilyIds' => $ledIds,
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $q = Social::str($request->query('q'), 60);
        $rows = DB::table('family_unions')->where('status', 'verified')
            ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w->where('name', 'like', "%{$q}%")->orWhere('tag', 'like', "%{$q}%")))
            ->orderBy('name')->limit(100)->get()->all();

        // Союзи моїх родин — навіть на перевірці.
        $mine = DB::table('family_union_members as m')->join('family_members as fm', 'fm.family_id', '=', 'm.family_id')
            ->join('family_unions as u', 'u.id', '=', 'm.union_id')
            ->where('fm.user_id', $request->user()->id)->select('u.*')->distinct()->get()->all();

        return response()->json([
            'items' => Families::presentUnions($rows, $request->user()),
            'mine' => Families::presentUnions($mine, $request->user()),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'tag' => ['nullable', 'string', 'max:8', 'regex:/^[\pL\pN_.-]+$/u'],
            'description' => ['nullable', 'string', 'max:3000'],
            'familyId' => ['required', 'integer'],
        ]);
        $family = $this->ledFamily($request);
        if (Families::unionOf($family->id)) {
            Social::fail(409, 'Ваша родина вже в союзі');
        }

        $id = DB::transaction(function () use ($data, $family) {
            $uid = DB::table('family_unions')->insertGetId([
                'name' => trim($data['name']),
                'tag' => isset($data['tag']) ? mb_strtoupper(trim($data['tag'])) : null,
                'description' => trim((string) ($data['description'] ?? '')),
                'founder_family_id' => $family->id,
                'status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('family_union_members')->insert(['union_id' => $uid, 'family_id' => $family->id, 'role' => 'founder', 'created_at' => now()]);

            return $uid;
        });

        return response()->json($this->full(DB::table('family_unions')->find($id), $request), 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        return response()->json($this->full($this->unionOr404($id, $request), $request));
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $union = $this->unionOr404($id, $request);
        if (! $this->founderLeader($union, $request->user())) {
            Social::fail(403, 'Редагувати союз може лідер родини-засновниці');
        }
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:60'],
            'tag' => ['sometimes', 'nullable', 'string', 'max:8', 'regex:/^[\pL\pN_.-]+$/u'],
            'description' => ['sometimes', 'nullable', 'string', 'max:3000'],
        ]);
        if (array_key_exists('name', $data) && $union->status === 'verified') {
            Social::fail(403, 'Назву верифікованого союзу змінює адміністрація.');
        }
        $changes = ['updated_at' => now()];
        if (array_key_exists('name', $data)) {
            $changes['name'] = trim($data['name']);
        }
        if (array_key_exists('tag', $data)) {
            $changes['tag'] = $data['tag'] ? mb_strtoupper(trim($data['tag'])) : null;
        }
        if (array_key_exists('description', $data)) {
            $changes['description'] = trim((string) $data['description']);
        }
        // Відхилений союз після правок знову йде на перевірку.
        if ($union->status === 'rejected') {
            $changes['status'] = 'pending';
        }
        DB::table('family_unions')->where('id', $union->id)->update($changes);

        return response()->json($this->full(DB::table('family_unions')->find($union->id), $request));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $union = $this->unionOr404($id, $request);
        if (! $this->founderLeader($union, $request->user()) && ! Families::isAdmin($request->user())) {
            Social::fail(403, 'Розпустити союз може лідер родини-засновниці');
        }
        DB::table('family_unions')->where('id', $union->id)->delete();

        return response()->json(['ok' => true]);
    }

    public function join(Request $request, int $id): JsonResponse
    {
        $union = $this->unionOr404($id, $request);
        $family = $this->ledFamily($request);
        if ($union->status !== 'verified') {
            Social::fail(400, 'Вступити можна лише до верифікованого союзу');
        }
        if (Families::unionOf($family->id)) {
            Social::fail(409, 'Ваша родина вже в союзі');
        }
        $inserted = DB::table('family_union_requests')->insertOrIgnore(['union_id' => $union->id, 'family_id' => $family->id, 'created_at' => now()]);
        if ($inserted) {
            Families::notifyManagers($union->founder_family_id, $request->user()->id, 'union_join_request', $family->name, $union->id);
        }

        return response()->json($this->full($union, $request));
    }

    /** Скасувати заявку або вивести свою родину із союзу. */
    public function leave(Request $request, int $id): JsonResponse
    {
        $union = $this->unionOr404($id, $request);
        $family = Families::find((int) $request->input('familyId'));
        if (! $family || Families::role($family->id, $request->user()->id) !== 'leader') {
            Social::fail(403, 'Діяти від імені родини може лише її лідер');
        }
        if ($family->id === $union->founder_family_id) {
            Social::fail(400, 'Родина-засновниця не може вийти — розпустіть союз');
        }
        DB::table('family_union_members')->where('union_id', $union->id)->where('family_id', $family->id)->delete();
        DB::table('family_union_requests')->where('union_id', $union->id)->where('family_id', $family->id)->delete();

        return response()->json($this->full($union, $request));
    }

    public function requests(Request $request, int $id): JsonResponse
    {
        $union = $this->unionOr404($id, $request);
        if (! $this->founderLeader($union, $request->user())) {
            Social::fail(403, 'Заявки розглядає лідер родини-засновниці');
        }
        $rows = DB::table('family_union_requests as r')->join('families as f', 'f.id', '=', 'r.family_id')
            ->where('r.union_id', $union->id)->orderBy('r.created_at')->select('f.*')->get()->all();

        return response()->json(Families::presentMany($rows, $request->user()));
    }

    public function approve(Request $request, int $id, int $familyId): JsonResponse
    {
        $union = $this->unionOr404($id, $request);
        if (! $this->founderLeader($union, $request->user())) {
            Social::fail(403, 'Заявки розглядає лідер родини-засновниці');
        }
        if (! DB::table('family_union_requests')->where('union_id', $union->id)->where('family_id', $familyId)->exists()) {
            Social::fail(404, 'Заявку не знайдено');
        }
        if (Families::unionOf($familyId)) {
            DB::table('family_union_requests')->where('union_id', $union->id)->where('family_id', $familyId)->delete();
            Social::fail(409, 'Родина вже в іншому союзі');
        }
        DB::transaction(function () use ($union, $familyId) {
            DB::table('family_union_requests')->where('union_id', $union->id)->where('family_id', $familyId)->delete();
            DB::table('family_union_members')->insertOrIgnore(['union_id' => $union->id, 'family_id' => $familyId, 'role' => 'member', 'created_at' => now()]);
        });
        Families::notifyManagers($familyId, $request->user()->id, 'union_join_accepted', $union->name, $union->id);

        return response()->json(['ok' => true]);
    }

    public function decline(Request $request, int $id, int $familyId): JsonResponse
    {
        $union = $this->unionOr404($id, $request);
        if (! $this->founderLeader($union, $request->user())) {
            Social::fail(403, 'Заявки розглядає лідер родини-засновниці');
        }
        DB::table('family_union_requests')->where('union_id', $union->id)->where('family_id', $familyId)->delete();

        return response()->json(['ok' => true]);
    }

    public function kick(Request $request, int $id, int $familyId): JsonResponse
    {
        $union = $this->unionOr404($id, $request);
        if (! $this->founderLeader($union, $request->user())) {
            Social::fail(403, 'Виключити родину може лідер родини-засновниці');
        }
        if ($familyId === $union->founder_family_id) {
            Social::fail(400, 'Родину-засновницю виключити не можна');
        }
        DB::table('family_union_members')->where('union_id', $union->id)->where('family_id', $familyId)->delete();

        return response()->json(['ok' => true]);
    }
}
