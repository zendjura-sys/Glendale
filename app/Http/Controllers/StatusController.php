<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Plugins\Plugins;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Швидкий статус з емодзі й таймером: «🎮 У рейді» до 23:00, «💤 Сплю» до ранку. */
class StatusController extends Controller
{
    /** На скільки ставиться статус; forever — доки людина не змінить сама. */
    public const DURATIONS = ['30m', '1h', '4h', 'today', 'week', 'forever'];

    public function __construct(private readonly Plugins $plugins) {}

    public function update(Request $request): JsonResponse
    {
        $this->plugins->ensure('status_emoji');
        $data = $request->validate([
            // Одна емодзі (з модифікаторами й ZWJ-послідовностями), без звичайного тексту.
            'emoji' => ['nullable', 'string', 'max:16', 'regex:/^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})[\p{Extended_Pictographic}\p{Regional_Indicator}\p{M}\x{200D}\x{FE0F}\x{1F3FB}-\x{1F3FF}]*$/u'],
            'text' => ['nullable', 'string', 'max:140'],
            'duration' => ['required', Rule::in(self::DURATIONS)],
        ]);
        $emoji = $data['emoji'] ?? null;
        $text = trim((string) ($data['text'] ?? ''));
        abort_if($emoji === null && $text === '', 422, 'Оберіть емодзі або напишіть статус.');

        $user = $this->user($request);
        $user->forceFill([
            'status_emoji' => $emoji,
            'status' => $text !== '' ? $text : null,
            'status_until' => $this->until($data['duration']),
        ])->save();

        return response()->json(['status' => $this->card($user)]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $this->plugins->ensure('status_emoji');
        $this->user($request)->forceFill(['status_emoji' => null, 'status' => null, 'status_until' => null])->save();

        return response()->json(['status' => null]);
    }

    /** «Сьогодні» — до кінця дня за київським часом. */
    private function until(string $duration): ?CarbonInterface
    {
        return match ($duration) {
            '30m' => now()->addMinutes(30),
            '1h' => now()->addHour(),
            '4h' => now()->addHours(4),
            'today' => now('Europe/Kyiv')->endOfDay()->utc(),
            'week' => now()->addWeek(),
            default => null,
        };
    }

    /**
     * @return array{emoji: string|null, text: string|null, until: string|null}
     */
    private function card(User $user): array
    {
        return ['emoji' => $user->status_emoji, 'text' => $user->status, 'until' => $user->status_until?->toIso8601String()];
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }
}
