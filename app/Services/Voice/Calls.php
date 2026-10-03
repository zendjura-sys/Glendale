<?php

namespace App\Services\Voice;

use App\Events\Calls\CallUpdated;
use App\Jobs\SendPushNotification;
use App\Models\Call;
use App\Models\CallParticipant;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Messenger;
use App\Services\Push\PushNotifier;
use Illuminate\Support\Facades\DB;

/**
 * Дзвінки в бесідах через LiveKit: особисті (1:1) і групові.
 * Хто дзвонить, хто відповів і скільки тривало — тут; звук — у LiveKit.
 * Груповий дзвінок — це й голосовий канал бесіди: поки він триває, зайти може будь-хто з учасників.
 */
class Calls
{
    public function __construct(
        private readonly LiveKit $livekit,
        private readonly Messenger $messenger,
    ) {}

    public function live(Conversation $conversation): ?Call
    {
        return Call::query()->where('conversation_id', $conversation->id)
            ->where('status', '!=', Call::STATUS_ENDED)
            ->latest('id')
            ->first();
    }

    /**
     * Чи може людина дзвонити в цю бесіду: учасник, а в особистій — співрозмовник приймає повідомлення від неї.
     */
    public function canCall(Conversation $conversation, User $user): bool
    {
        if ($user->isBanned() || $conversation->participantFor($user) === null) {
            return false;
        }
        if ($conversation->isGroup()) {
            return true;
        }
        $peer = $conversation->activeParticipants()->where('user_id', '!=', $user->id)->with('user')->first()?->user;

        return $peer instanceof User && $this->messenger->canMessage($user, $peer);
    }

    /**
     * Почати дзвінок або приєднатися до того, що вже триває. Повертає доступ до кімнати.
     *
     * @return array<string, mixed>
     */
    public function start(Conversation $conversation, User $user): array
    {
        $call = DB::transaction(function () use ($conversation, $user) {
            $live = $this->live($conversation);
            if ($live) {
                return $live;
            }

            $call = Call::query()->create([
                'conversation_id' => $conversation->id,
                'started_by' => $user->id,
                'status' => Call::STATUS_RINGING,
            ]);
            foreach ($conversation->activeParticipants()->pluck('user_id') as $userId) {
                $call->participants()->create([
                    'user_id' => (int) $userId,
                    'state' => (int) $userId === $user->id ? CallParticipant::STATE_JOINED : CallParticipant::STATE_INVITED,
                    'joined_at' => (int) $userId === $user->id ? now() : null,
                ]);
            }

            return $call;
        });

        $ringing = $call->wasRecentlyCreated;
        $access = $this->join($call, $user);
        if ($ringing) {
            $this->ring($call, $conversation, $user);
        }

        return $access;
    }

    /**
     * Токен входу в розмову; людина вважається в розмові, щойно отримала доступ (вебхук це підтверджує).
     *
     * @return array<string, mixed>
     */
    public function join(Call $call, User $user): array
    {
        $call->participants()->updateOrCreate(
            ['user_id' => $user->id],
            ['state' => CallParticipant::STATE_JOINED, 'joined_at' => now(), 'left_at' => null],
        );
        $this->markAnswered($call);
        $this->changed($call);

        return [
            'url' => (string) $this->livekit->url(),
            'token' => $this->livekit->token(
                'u'.$user->id,
                $user->name,
                $call->livekitName(),
                [],
                (string) json_encode(['user_id' => $user->id, 'avatar_url' => $user->avatar_url]),
            ),
            'room' => $call->livekitName(),
            'identity' => 'u'.$user->id,
            'call' => $this->state($call),
        ];
    }

    public function decline(Call $call, User $user): void
    {
        $call->participants()->where('user_id', $user->id)->where('state', CallParticipant::STATE_INVITED)
            ->update(['state' => CallParticipant::STATE_DECLINED]);

        // Особистий дзвінок: співрозмовник відхилив — дзвінок завершено.
        $conversation = $call->conversation;
        if ($conversation && ! $conversation->isGroup() && $call->status === Call::STATUS_RINGING) {
            $this->end($call, 'declined');

            return;
        }
        $this->changed($call);
    }

    public function leave(Call $call, User $user): void
    {
        $call->participants()->where('user_id', $user->id)->where('state', CallParticipant::STATE_JOINED)
            ->update(['state' => CallParticipant::STATE_LEFT, 'left_at' => now()]);
        $this->settle($call);
    }

    /**
     * Подія LiveKit для кімнати дзвінка.
     *
     * @param  array<string, mixed>  $event
     */
    public function webhook(Call $call, array $event): void
    {
        $identity = (string) ($event['participant']['identity'] ?? '');
        $userId = preg_match('/^u(\d+)$/', $identity, $m) === 1 ? (int) $m[1] : null;

        match ($event['event'] ?? null) {
            'participant_joined' => $userId ? $call->participants()->where('user_id', $userId)
                ->update(['state' => CallParticipant::STATE_JOINED, 'left_at' => null]) : null,
            'participant_left' => $userId ? $call->participants()->where('user_id', $userId)->where('state', CallParticipant::STATE_JOINED)
                ->update(['state' => CallParticipant::STATE_LEFT, 'left_at' => now()]) : null,
            'room_finished' => $call->participants()->where('state', CallParticipant::STATE_JOINED)
                ->update(['state' => CallParticipant::STATE_LEFT, 'left_at' => now()]),
            default => null,
        };

        if (($event['event'] ?? null) === 'participant_joined') {
            $this->markAnswered($call);
            $this->changed($call);
        } else {
            $this->settle($call);
        }
    }

    /**
     * Дзвінки без відповіді (раз на хвилину з планувальника): особистий стає пропущеним,
     * груповий перестає дзвонити, але лишається відкритим голосовим каналом, поки в ньому хтось є.
     */
    public function expire(): int
    {
        $count = 0;
        Call::query()->with('conversation')->where('status', Call::STATUS_RINGING)
            ->where('created_at', '<=', now()->subSeconds(Call::RING_SECONDS))
            ->get()
            ->each(function (Call $call) use (&$count) {
                $joined = $call->participants()->where('state', CallParticipant::STATE_JOINED)->count();
                if ($call->conversation?->isGroup() && $joined > 0) {
                    $call->update(['status' => Call::STATUS_ACTIVE]);
                    $call->participants()->where('state', CallParticipant::STATE_INVITED)->update(['state' => CallParticipant::STATE_DECLINED]);
                    $this->changed($call);
                } else {
                    $this->end($call, 'missed');
                }
                $count++;
            });

        return $count;
    }

    /**
     * Стан для бесіди: хто в розмові й кого ще чекаємо.
     *
     * @return array<string, mixed>
     */
    public function state(Call $call): array
    {
        $participants = $call->participants()->with('user')->get();
        $people = fn (string $state) => $participants->where('state', $state)
            ->map(fn (CallParticipant $p) => $p->user?->toCard())
            ->filter()
            ->values()
            ->all();

        return [
            'id' => $call->id,
            'conversation_id' => $call->conversation_id,
            'group' => (bool) $call->conversation?->isGroup(),
            'title' => $call->conversation?->isGroup() ? $call->conversation->title : null,
            'status' => $call->status,
            'started_by' => $call->started_by,
            'caller' => $call->caller?->toCard(),
            'started_at' => $call->created_at->toIso8601String(),
            'answered_at' => $call->answered_at?->toIso8601String(),
            'joined' => $people(CallParticipant::STATE_JOINED),
            'invited' => $participants->where('state', CallParticipant::STATE_INVITED)->pluck('user_id')->map(fn ($id) => (int) $id)->values()->all(),
        ];
    }

    /**
     * Стан для екрана бесіди (null — дзвінка немає).
     *
     * @return array<string, mixed>|null
     */
    public function stateFor(Conversation $conversation): ?array
    {
        $call = $this->live($conversation);

        return $call ? $this->state($call) : null;
    }

    /**
     * Що бачить людина в бесіді: поточний дзвінок і чи можна дзвонити.
     *
     * @return array{call: array<string, mixed>|null, can_call: bool, calls_enabled: bool}
     */
    public function forViewer(Conversation $conversation, User $user): array
    {
        return [
            'call' => $this->stateFor($conversation),
            'can_call' => $this->canCall($conversation, $user),
            'calls_enabled' => $this->livekit->configured(),
        ];
    }

    private function markAnswered(Call $call): void
    {
        if (! $call->isLive() || $call->answered_at !== null) {
            return;
        }
        $joined = $call->participants()->where('state', CallParticipant::STATE_JOINED)->count();
        if ($joined >= 2) {
            $call->update(['status' => Call::STATUS_ACTIVE, 'answered_at' => now()]);
        }
    }

    /** Після виходу: у розмові нікого — дзвінок завершено. */
    private function settle(Call $call): void
    {
        $call->refresh();
        if (! $call->isLive()) {
            return;
        }
        $joined = $call->participants()->where('state', CallParticipant::STATE_JOINED)->count();
        if ($joined === 0) {
            $this->end($call, $call->answered_at ? 'finished' : 'missed');

            return;
        }
        // Особиста розмова: хтось поклав слухавку — завершуємо для обох.
        if ($call->status === Call::STATUS_ACTIVE && $call->conversation && ! $call->conversation->isGroup() && $joined < 2) {
            $this->end($call, 'finished');

            return;
        }
        $this->changed($call);
    }

    private function end(Call $call, string $reason): void
    {
        $ended = Call::query()->whereKey($call->id)->where('status', '!=', Call::STATUS_ENDED)
            ->update(['status' => Call::STATUS_ENDED, 'ended_at' => now()]);
        if ($ended === 0) {
            return;
        }
        $call->refresh();
        $call->participants()->where('state', CallParticipant::STATE_JOINED)->update(['state' => CallParticipant::STATE_LEFT, 'left_at' => now()]);
        $this->livekit->deleteRoom($call->livekitName());

        $conversation = $call->conversation;
        if (! $conversation) {
            return;
        }
        $seconds = $call->answered_at ? (int) $call->answered_at->diffInSeconds($call->ended_at ?? now()) : 0;
        $text = match (true) {
            $reason === 'declined' => 'Дзвінок відхилено',
            $call->answered_at === null => $conversation->isGroup() ? 'Груповий дзвінок без відповіді' : 'Пропущений дзвінок',
            default => ($conversation->isGroup() ? 'Груповий дзвінок' : 'Дзвінок').' · '.$this->duration($seconds),
        };
        $this->messenger->announce($conversation, $text, [
            'call' => ['id' => $call->id, 'status' => $call->answered_at ? 'finished' : $reason, 'duration' => $seconds, 'started_by' => $call->started_by],
            'actor_id' => $call->started_by,
        ]);

        $this->broadcast($call, null);
    }

    private function ring(Call $call, Conversation $conversation, User $caller): void
    {
        $title = $conversation->isGroup() ? (string) ($conversation->title ?: 'Бесіда') : $caller->name;
        $body = $conversation->isGroup() ? "{$caller->first_name} розпочинає груповий дзвінок" : 'Вхідний дзвінок';
        $invited = $call->participants()->where('state', CallParticipant::STATE_INVITED)->pluck('user_id');
        foreach ($invited as $userId) {
            SendPushNotification::dispatch(
                (int) $userId,
                $title,
                $body,
                [
                    'type' => 'call',
                    'call_id' => (string) $call->id,
                    'conversation_id' => (string) $conversation->id,
                    'caller' => $caller->name,
                    'avatar_url' => (string) $caller->avatar_url,
                    'group' => $conversation->isGroup() ? '1' : '0',
                    'url' => '/messages/'.$conversation->id,
                ],
                PushNotifier::CHANNEL_CALLS,
                'call-'.$call->id,
                dataOnly: true,
            );
        }
    }

    private function changed(Call $call): void
    {
        $call->refresh();
        $this->broadcast($call, $call->isLive() ? $this->state($call) : null);
    }

    /**
     * @param  array<string, mixed>|null  $state
     */
    private function broadcast(Call $call, ?array $state): void
    {
        $userIds = array_values(array_map('intval', $call->participants()->pluck('user_id')->all()));
        rescue(fn () => broadcast(new CallUpdated($call->conversation_id, $userIds, $state)), report: false);
    }

    private function duration(int $seconds): string
    {
        $h = intdiv($seconds, 3600);
        $m = intdiv($seconds % 3600, 60);
        $s = $seconds % 60;

        return $h > 0 ? sprintf('%d:%02d:%02d', $h, $m, $s) : sprintf('%d:%02d', $m, $s);
    }
}
