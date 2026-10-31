<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\User;
use App\Services\Party\ReadyBoard;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** «Готовий грати зараз»: свій стан, ігри для вибору й друзі, які теж вільні. */
class ReadyToPlayController extends Controller
{
    public function __construct(private readonly Plugins $plugins, private readonly ReadyBoard $board) {}

    public function show(Request $request): JsonResponse
    {
        $this->plugins->ensure('ready_to_play');
        $user = $this->user($request);

        return response()->json($this->state($user));
    }

    public function update(Request $request): JsonResponse
    {
        $this->plugins->ensure('ready_to_play');
        $data = $request->validate([
            'game' => ['nullable', 'string', 'max:120'],
            'minutes' => ['required', 'integer', Rule::in(ReadyBoard::DURATIONS)],
            'note' => ['nullable', 'string', 'max:80'],
        ]);
        $game = filled($data['game'] ?? null) ? Game::query()->published()->where('slug', $data['game'])->firstOrFail() : null;
        $user = $this->user($request);
        $this->board->start($user, $game, (int) $data['minutes'], $data['note'] ?? null);

        return response()->json($this->state($user));
    }

    public function destroy(Request $request): JsonResponse
    {
        $this->plugins->ensure('ready_to_play');
        $user = $this->user($request);
        $this->board->stop($user);

        return response()->json($this->state($user));
    }

    /**
     * @return array<string, mixed>
     */
    private function state(User $user): array
    {
        return [
            'mine' => $this->board->mine($user)?->toCard(),
            'friends' => $this->board->friends($user),
            'games' => $this->board->gameOptions($user),
            'durations' => ReadyBoard::DURATIONS,
        ];
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
