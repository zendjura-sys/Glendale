<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilyEvent;
use App\Models\FamilyEventAttendance;
use App\Models\FamilyMember;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FamilyEvents
{
    public function __construct(
        private readonly FamilyBank $bank,
        private readonly FamilyAudit $audit,
        private readonly FamilyNotifier $notifier,
        private readonly FamilyChat $chat,
    ) {}

    /**
     * @param  array{title: string, type: string, description?: string|null, starts_at: string, points?: int|null, reward?: int|null, repeat?: string|null}  $data
     */
    public function create(Family $family, FamilyMember $creator, array $data): FamilyEvent
    {
        $event = FamilyEvent::query()->create([
            'family_id' => $family->id,
            'created_by' => $creator->id,
            'title' => $data['title'],
            'type' => $data['type'],
            'description' => $data['description'] ?? null,
            'starts_at' => $data['starts_at'],
            'points' => (int) ($data['points'] ?? 0),
            'reward' => (int) ($data['reward'] ?? 0),
            'repeat' => ($data['repeat'] ?? null) === 'weekly' ? 'weekly' : null,
        ]);

        $this->audit->log($family, 'EVENT_CREATE', $creator, null, ['event_id' => $event->id, 'title' => $event->title]);
        $when = $event->starts_at->setTimezone(ReportService::TIMEZONE)->format('d.m H:i');
        $this->chat->announce($family, "📅 Нова подія: «{$event->title}» — {$when}. Відмітьтеся на сторінці подій!");
        $this->notifier->members($family->activeMembers()->with('user')->get()->reject(fn ($m) => $m->id === $creator->id), $family, 'event', "Нова подія «{$event->title}» — {$when}", route('families.events', $family, absolute: false));
        $this->notifier->refresh($family, 'events');

        return $event;
    }

    public function rsvp(Family $family, FamilyEvent $event, FamilyMember $member, bool $going): void
    {
        if ($event->status !== FamilyEvent::STATUS_PLANNED) {
            throw ValidationException::withMessages(['event' => 'Подію вже завершено.']);
        }

        // «Не піду» теж запам’ятовуємо: такому учасникові не надсилаємо нагадування.
        FamilyEventAttendance::query()->updateOrCreate(
            ['event_id' => $event->id, 'member_id' => $member->id],
            ['status' => $going ? FamilyEventAttendance::STATUS_GOING : FamilyEventAttendance::STATUS_DECLINED],
        );
        $this->notifier->refresh($family, 'events');
    }

    /**
     * Підсумок: відмічені присутні отримують бали рейтингу й нагороду.
     *
     * @param  list<int>  $attendedIds
     */
    public function close(Family $family, FamilyEvent $event, FamilyMember $actor, array $attendedIds, bool $cancelled = false): void
    {
        if ($event->status !== FamilyEvent::STATUS_PLANNED) {
            throw ValidationException::withMessages(['event' => 'Подію вже завершено.']);
        }

        DB::transaction(function () use ($family, $event, $actor, $attendedIds, $cancelled) {
            $event->update(['status' => $cancelled ? FamilyEvent::STATUS_CANCELLED : FamilyEvent::STATUS_DONE]);
            if ($cancelled) {
                $this->audit->log($family, 'EVENT_CLOSE', $actor, null, ['event_id' => $event->id, 'cancelled' => true]);

                return;
            }

            $members = FamilyMember::query()
                ->where('family_id', $family->id)
                ->where('status', FamilyMember::STATUS_ACTIVE)
                ->whereKey($attendedIds)
                ->get();

            FamilyEventAttendance::query()->where('event_id', $event->id)->whereNotIn('member_id', $members->pluck('id')->all() ?: [0])
                ->where('status', '!=', FamilyEventAttendance::STATUS_DECLINED)
                ->update(['status' => FamilyEventAttendance::STATUS_ABSENT]);

            foreach ($members as $member) {
                FamilyEventAttendance::query()->updateOrCreate(['event_id' => $event->id, 'member_id' => $member->id], ['status' => FamilyEventAttendance::STATUS_ATTENDED]);
                if ($event->reward > 0) {
                    $this->bank->post($family, $member, 'event_reward', $event->reward, 0, $actor, "Подія «{$event->title}»", $event);
                }
            }

            $this->audit->log($family, 'EVENT_CLOSE', $actor, null, [
                'event_id' => $event->id,
                'attended' => $members->count(),
                'reward' => $event->reward,
            ]);

            if ($members->isNotEmpty()) {
                $this->chat->announce($family, "✅ Подія «{$event->title}» завершена. Присутні: {$members->count()}".($event->reward > 0 ? ', кожен отримав '.Money::format($event->reward) : '').'.');
            }
        });

        $this->notifier->refresh($family, 'events');
    }
}
