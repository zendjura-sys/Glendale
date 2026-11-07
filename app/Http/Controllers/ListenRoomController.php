<?php

namespace App\Http\Controllers;

use App\Models\ListenParty;
use App\Models\ListenRoomPolicy;
use App\Models\RadioStation;
use App\Models\Track;
use App\Models\User;
use App\Services\ListenParties;
use App\Services\Music\ListenRooms;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Кімнати «Слухати разом» для сім’ї, клану, спільноти чи друзів: відкрити, діджей, пропозиції,
 * реакції, чат, прибрати слухача, передати роль діджея. Плеєр і черга — у ListenPartyController.
 */
class ListenRoomController extends Controller
{
    public function __construct(private readonly ListenRooms $rooms, private readonly ListenParties $parties) {}

    /** Розділ «Кімнати» в музиці. */
    public function index(Request $request): Response|JsonResponse
    {
        $props = $this->rooms->hub($this->user($request));

        return $request->expectsJson() ? response()->json($props) : Inertia::render('music/rooms', $props);
    }

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate([
            'group_type' => ['nullable', Rule::in(ListenParty::GROUP_TYPES)],
            'group_id' => ['nullable', 'required_with:group_type', 'integer'],
            'title' => ['nullable', 'string', 'max:80'],
            'track_id' => ['nullable', 'integer'],
            'station_id' => ['nullable', 'integer'],
        ]);
        $item = match (true) {
            isset($data['track_id']) => Track::query()->findOrFail((int) $data['track_id']),
            isset($data['station_id']) => RadioStation::query()->where('is_active', true)->findOrFail((int) $data['station_id']),
            default => null,
        };
        $type = $data['group_type'] ?? null;
        $party = $this->rooms->start($user, $type, $type !== null ? (int) $data['group_id'] : null, $data['title'] ?? null, $item);

        return $request->expectsJson()
            ? response()->json(['code' => $party->code, 'url' => url('/listen/'.$party->code)], 201)
            : to_route('listen.show', $party);
    }

    /** Для сторінки групи: чи є жива кімната, скільки в ній людей, чи можна відкрити. */
    public function group(Request $request, string $type, int $id): JsonResponse
    {
        abort_if($this->rooms->group($type, $id) === null, 404);

        return response()->json($this->rooms->status($type, $id, $this->user($request)));
    }

    /** Адміністратори групи вирішують, хто відкриває кімнати. */
    public function policy(Request $request, string $type, int $id): JsonResponse
    {
        abort_if($this->rooms->group($type, $id) === null, 404);
        $user = $this->user($request);
        $data = $request->validate(['who' => ['required', Rule::in(array_keys(ListenRoomPolicy::WHO))]]);
        $this->rooms->setPolicy($type, $id, $user, $data['who']);

        return response()->json($this->rooms->status($type, $id, $user));
    }

    public function suggest(Request $request, ListenParty $party): JsonResponse
    {
        $user = $this->live($request, $party);
        $data = $request->validate(['track_id' => ['required_without:station_id', 'nullable', 'integer'], 'station_id' => ['nullable', 'integer']]);
        $item = isset($data['station_id'])
            ? RadioStation::query()->where('is_active', true)->findOrFail((int) $data['station_id'])
            : Track::query()->findOrFail((int) $data['track_id']);
        $party->canControl($user) ? $this->parties->enqueue($party, $user, $item) : $this->rooms->suggest($party, $user, $item);

        return response()->json($this->parties->state($party->refresh(), $user));
    }

    public function review(Request $request, ListenParty $party, int $index): JsonResponse
    {
        $user = $this->live($request, $party);
        $data = $request->validate(['approve' => ['required', 'boolean']]);
        $this->rooms->review($party, $user, $index, (bool) $data['approve']);

        return response()->json($this->parties->state($party->refresh(), $user));
    }

    public function react(Request $request, ListenParty $party): JsonResponse
    {
        $user = $this->live($request, $party);
        $data = $request->validate(['emoji' => ['required', 'string', 'max:16']]);

        return response()->json(['reaction' => $this->rooms->react($party, $user, $data['emoji'])]);
    }

    public function chat(Request $request, ListenParty $party): JsonResponse
    {
        $user = $this->live($request, $party);
        $data = $request->validate(['body' => ['required', 'string', 'max:500']]);

        return response()->json(['message' => $this->rooms->say($party, $user, $data['body'])], 201);
    }

    public function kick(Request $request, ListenParty $party): JsonResponse
    {
        $user = $this->live($request, $party);
        $data = $request->validate(['user_id' => ['required', 'integer']]);
        $this->rooms->kick($party, $user, User::query()->findOrFail((int) $data['user_id']));

        return response()->json($this->parties->state($party->refresh(), $user));
    }

    public function host(Request $request, ListenParty $party): JsonResponse
    {
        $user = $this->live($request, $party);
        $data = $request->validate(['user_id' => ['required', 'integer']]);
        $this->rooms->passHost($party, $user, User::query()->findOrFail((int) $data['user_id']));

        return response()->json($this->parties->state($party->refresh(), $user));
    }

    private function live(Request $request, ListenParty $party): User
    {
        $user = $this->user($request);
        $this->rooms->ensureCanJoin($party, $user);
        abort_unless($this->parties->isMember($party, $user), 403, 'Відкрийте посилання, щоб приєднатися.');
        abort_unless($party->isLive(), 410, 'Прослуховування вже завершено.');

        return $user;
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
