<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\VoiceRoom;
use App\Services\Voice\LiveKit;
use App\Services\Voice\VoiceRooms;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Голосові кімнати для сайту й застосунку (JSON): список, вхід, керування.
 */
class VoiceController extends Controller
{
    public function __construct(
        private readonly VoiceRooms $voice,
        private readonly LiveKit $livekit,
    ) {}

    public function index(Request $request, string $type, int $id): JsonResponse
    {
        $owner = $this->voice->owner($type, $id);
        abort_unless($this->voice->canJoin($request->user(), $owner) || $this->voice->canManage($request->user(), $owner), 403, 'Голосові кімнати — лише для учасників.');

        return response()->json($this->voice->state($owner, $request->user()));
    }

    public function store(Request $request, string $type, int $id): JsonResponse
    {
        $owner = $this->voice->owner($type, $id);
        abort_unless($this->voice->canManage($request->user(), $owner), 403, 'Недостатньо прав, щоб керувати голосовими кімнатами.');
        $data = $request->validate(['name' => ['required', 'string', 'max:60']]);

        $this->voice->create($owner, $request->user(), trim($data['name']));

        return response()->json($this->voice->state($owner, $request->user()), 201);
    }

    public function update(Request $request, VoiceRoom $room): JsonResponse
    {
        $owner = $this->voice->ownerOf($room);
        abort_unless($this->voice->canManage($request->user(), $owner), 403, 'Недостатньо прав, щоб керувати голосовими кімнатами.');
        $data = $request->validate(['name' => ['required', 'string', 'max:60']]);

        $this->voice->rename($room, trim($data['name']));

        return response()->json($this->voice->state($owner, $request->user()));
    }

    public function destroy(Request $request, VoiceRoom $room): JsonResponse
    {
        $owner = $this->voice->ownerOf($room);
        abort_unless($this->voice->canManage($request->user(), $owner), 403, 'Недостатньо прав, щоб керувати голосовими кімнатами.');

        $this->voice->delete($room);

        return response()->json($this->voice->state($owner, $request->user()));
    }

    public function join(Request $request, VoiceRoom $room): JsonResponse
    {
        $owner = $this->voice->ownerOf($room);
        abort_unless($this->voice->canJoin($request->user(), $owner), 403, 'Голосові кімнати — лише для учасників.');
        abort_unless($this->livekit->configured(), 503, 'Голосові кімнати ще не налаштовані адміністратором.');

        return response()->json($this->voice->join($room, $request->user()));
    }

    public function moderate(Request $request, VoiceRoom $room, User $user): JsonResponse
    {
        $owner = $this->voice->ownerOf($room);
        abort_unless($this->voice->canManage($request->user(), $owner), 403, 'Недостатньо прав, щоб керувати голосовими кімнатами.');
        $data = $request->validate(['action' => ['required', Rule::in(['mute', 'unmute', 'kick'])]]);

        match ($data['action']) {
            'mute' => $this->voice->mute($room, $user, true),
            'unmute' => $this->voice->mute($room, $user, false),
            'kick' => $this->voice->kick($room, $user),
        };

        return response()->json($this->voice->state($owner, $request->user()));
    }

    /** Вебхук LiveKit: хто зайшов і вийшов. Без сесії — справжність перевіряє підпис. */
    public function webhook(Request $request): JsonResponse
    {
        $event = $this->livekit->webhook($request->getContent(), $request->header('Authorization'));
        abort_if($event === null, 401);

        $this->voice->webhook($event);

        return response()->json(['ok' => true]);
    }
}
