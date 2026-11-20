<?php

namespace App\Http\Controllers;

use App\Models\FamilyMember;
use App\Models\FamilyShift;
use App\Models\MessageAttachment;
use App\Models\User;
use App\Services\Messenger;
use App\Services\MessengerPresenter;
use App\Support\Modules\ModuleManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * «Зараз» у лобі: що відбувається в розділах людини просто зараз — зміни сім’ї (йдуть і найближчі),
 * обговорення з непрочитаним (з відповіддю прямо з лобі). Лише читання; розділ вимкнено — його немає.
 */
class LobbyNowController extends Controller
{
    public function __invoke(Request $request, ModuleManager $modules, MessengerPresenter $presenter, Messenger $messenger): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'shifts' => $modules->enabled('families') ? $this->shifts($user) : [],
            'chats' => $modules->enabled('messages') ? $this->chats($user, $presenter, $messenger) : [],
        ]);
    }

    /**
     * Зміни сім’ї: ті, що йдуть, і ті, що почнуться за 12 годин.
     *
     * @return list<array<string, mixed>>
     */
    private function shifts(User $user): array
    {
        $membership = FamilyMember::query()->with('family')->where('user_id', $user->id)
            ->where('status', FamilyMember::STATUS_ACTIVE)->first();
        if ($membership?->family === null) {
            return [];
        }
        $family = $membership->family;

        return array_values(FamilyShift::query()->with('member.user')
            ->where('family_id', $family->id)
            ->whereNull('completed_at')
            ->where('ends_at', '>', now())
            ->where('starts_at', '<', now()->addHours(12))
            ->orderBy('starts_at')->limit(3)->get()
            ->map(fn (FamilyShift $shift) => [
                'id' => $shift->id,
                'title' => $shift->title,
                'family' => $family->name,
                'live' => $shift->starts_at->isPast(),
                'starts_at' => $shift->starts_at->toIso8601String(),
                'ends_at' => $shift->ends_at->toIso8601String(),
                'foreman' => $shift->member?->user?->first_name,
                'mine' => $shift->member_id === $membership->id,
                'progress' => $shift->progress,
                'goal' => $shift->goal['count'] ?? null,
                'href' => '/f/'.$family->slug.'/shifts',
            ])->all());
    }

    /**
     * @return array{kind: string, url: string, duration: int|null, width: int|null, height: int|null}|null
     */
    private function media(?int $messageId): ?array
    {
        if ($messageId === null) {
            return null;
        }
        $attachment = MessageAttachment::query()->where('message_id', $messageId)
            ->whereIn('type', [MessageAttachment::TYPE_VOICE, MessageAttachment::TYPE_IMAGE])
            ->orderBy('position')->first();
        if ($attachment === null) {
            return null;
        }

        return [
            'kind' => $attachment->type,
            'url' => (string) $attachment->url,
            'duration' => $attachment->duration,
            'width' => $attachment->width,
            'height' => $attachment->height,
        ];
    }

    /**
     * Обговорення з непрочитаним — до трьох, з останнім повідомленням.
     *
     * @return list<array<string, mixed>>
     */
    private function chats(User $user, MessengerPresenter $presenter, Messenger $messenger): array
    {
        $out = [];
        foreach ($presenter->inbox($user, $messenger) as $chat) {
            if ((int) ($chat['unread'] ?? 0) < 1) {
                continue;
            }
            $out[] = [
                'id' => $chat['id'],
                'title' => $chat['title'],
                'avatar_url' => $chat['avatar_url'] ?? null,
                'unread' => (int) $chat['unread'],
                'preview' => $chat['last_message']['preview'] ?? null,
                'author' => $chat['last_message']['author'] ?? null,
                'href' => '/messages/'.$chat['id'],
                // Голосове — слухати з лобі; картинка — заливка блоку (з розмірами для пропорцій).
                'media' => $this->media(isset($chat['last_message']['id']) ? (int) $chat['last_message']['id'] : null),
            ];
            if (count($out) === 3) {
                break;
            }
        }

        return $out;
    }
}
