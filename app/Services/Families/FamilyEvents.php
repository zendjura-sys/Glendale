<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilyEvent;
use App\Models\FamilyEventAttendance;
use App\Models\FamilyMember;
use App\Models\PhotoAlbum;
use App\Models\User;
use App\Services\PhotoService;
use App\Support\Money;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FamilyEvents
{
    public function __construct(
        private readonly FamilyBank $bank,
        private readonly FamilyAudit $audit,
        private readonly FamilyNotifier $notifier,
        private readonly FamilyChat $chat,
        private readonly PhotoService $photos,
    ) {}

    /**
     * @param  array{title: string, type: string, description?: string|null, starts_at: string, points?: int|null, reward?: int|null, repeat?: string|null, capacity?: int|null, cover?: UploadedFile|null}  $data
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
            'capacity' => isset($data['capacity']) && $data['capacity'] > 0 ? $data['capacity'] : null,
            'cover_path' => isset($data['cover']) ? $data['cover']->store('event-covers', 'public') : null,
            'checkin_code' => self::newCode(),
        ]);

        $this->audit->log($family, 'EVENT_CREATE', $creator, null, ['event_id' => $event->id, 'title' => $event->title]);
        $when = $event->starts_at->setTimezone(ReportService::TIMEZONE)->format('d.m H:i');
        $this->chat->announce($family, "📅 Нова подія: «{$event->title}» — {$when}. Відмітьтеся на сторінці подій!");
        $this->notifier->members($family->activeMembers()->with('user')->get()->reject(fn ($m) => $m->id === $creator->id), $family, 'event', "Нова подія «{$event->title}» — {$when}", route('families.events', $family, absolute: false));
        $this->notifier->refresh($family, 'events');

        return $event;
    }

    /**
     * «Піду» / «Не піду». Коли місць більше немає — у чергу; хто відмовився, звільняє місце першому в черзі.
     *
     * @return string статус учасника після відповіді
     */
    public function rsvp(Family $family, FamilyEvent $event, FamilyMember $member, bool $going): string
    {
        if ($event->status !== FamilyEvent::STATUS_PLANNED) {
            throw ValidationException::withMessages(['event' => 'Подію вже завершено.']);
        }

        $status = DB::transaction(function () use ($family, $event, $member, $going) {
            $current = FamilyEventAttendance::query()->where('event_id', $event->id)->where('member_id', $member->id)->lockForUpdate()->first();
            $seated = $current !== null && in_array($current->status, [FamilyEventAttendance::STATUS_GOING, FamilyEventAttendance::STATUS_ATTENDED], true);
            if ($going) {
                if ($seated || $current?->status === FamilyEventAttendance::STATUS_WAITLIST) {
                    return $current->status;
                }
                $status = $event->capacity !== null && $this->seats($event) >= $event->capacity
                    ? FamilyEventAttendance::STATUS_WAITLIST
                    : FamilyEventAttendance::STATUS_GOING;
            } else {
                // «Не піду» теж запам’ятовуємо: такому учасникові не надсилаємо нагадування.
                $status = FamilyEventAttendance::STATUS_DECLINED;
            }
            FamilyEventAttendance::query()->updateOrCreate(['event_id' => $event->id, 'member_id' => $member->id], ['status' => $status]);
            if ($seated && ! $going) {
                $this->promote($family, $event);
            }

            return $status;
        });
        $this->notifier->refresh($family, 'events');

        return $status;
    }

    /** Зайняті місця: ідуть або вже відмітилися. */
    public function seats(FamilyEvent $event): int
    {
        return FamilyEventAttendance::query()->where('event_id', $event->id)
            ->whereIn('status', [FamilyEventAttendance::STATUS_GOING, FamilyEventAttendance::STATUS_ATTENDED])->count();
    }

    /** Перші з черги займають звільнені місця й отримують сповіщення. */
    private function promote(Family $family, FamilyEvent $event): void
    {
        if ($event->capacity === null) {
            return;
        }
        while ($this->seats($event) < $event->capacity) {
            $next = FamilyEventAttendance::query()->where('event_id', $event->id)->where('status', FamilyEventAttendance::STATUS_WAITLIST)
                ->orderBy('updated_at')->orderBy('id')->first();
            if ($next === null) {
                return;
            }
            $next->update(['status' => FamilyEventAttendance::STATUS_GOING]);
            $this->notifier->members(FamilyMember::query()->with('user')->whereKey($next->member_id)->get(), $family, 'event',
                "Звільнилося місце: ви йдете на «{$event->title}»", route('families.events', $family, absolute: false));
        }
    }

    /**
     * Відмітка кодом, який організатор називає на початку: за пів години до старту й до 4 годин після.
     */
    public function checkIn(Family $family, FamilyEvent $event, FamilyMember $member, string $code): void
    {
        if ($event->status !== FamilyEvent::STATUS_PLANNED) {
            throw ValidationException::withMessages(['code' => 'Подію вже завершено.']);
        }
        if (now()->lt($event->starts_at->copy()->subMinutes(30)) || now()->gt($event->starts_at->copy()->addHours(4))) {
            throw ValidationException::withMessages(['code' => 'Відмітка відкрита з пів години до початку і до 4 годин після.']);
        }
        if ($event->checkin_code === null || ! hash_equals($event->checkin_code, trim($code))) {
            throw ValidationException::withMessages(['code' => 'Код не підходить.']);
        }
        FamilyEventAttendance::query()->updateOrCreate(['event_id' => $event->id, 'member_id' => $member->id], ['status' => FamilyEventAttendance::STATUS_ATTENDED]);
        $this->notifier->refresh($family, 'events');
    }

    /** Код відмітки: старим подіям створюється при першому перегляді. */
    public function code(FamilyEvent $event): string
    {
        if ($event->checkin_code === null) {
            $event->update(['checkin_code' => self::newCode()]);
        }

        return (string) $event->checkin_code;
    }

    /**
     * Спільний альбом завершеної події: присутні можуть додавати фото (до 20 людей).
     */
    public function album(Family $family, FamilyEvent $event, FamilyMember $actor): PhotoAlbum
    {
        if ($event->status !== FamilyEvent::STATUS_DONE) {
            throw ValidationException::withMessages(['event' => 'Альбом з’являється після завершення події.']);
        }
        $existing = $event->album_id !== null ? PhotoAlbum::query()->find($event->album_id) : null;
        if ($existing instanceof PhotoAlbum) {
            return $existing;
        }
        $owner = User::query()->findOrFail($actor->user_id);
        $album = $this->photos->createAlbum($owner, [
            'title' => mb_substr("Подія: {$event->title}", 0, 80),
            'description' => "[{$family->tag}] {$family->name} · ".$event->starts_at->setTimezone(ReportService::TIMEZONE)->format('d.m.Y'),
            'privacy' => PhotoAlbum::PRIVACY_PRIVATE,
        ]);
        $attendees = FamilyMember::query()
            ->whereIn('id', FamilyEventAttendance::query()->where('event_id', $event->id)->where('status', FamilyEventAttendance::STATUS_ATTENDED)->select('member_id'))
            ->where('user_id', '!=', $owner->id)
            ->limit(20)
            ->pluck('user_id');
        $album->contributors()->syncWithoutDetaching($attendees->all());
        $event->update(['album_id' => $album->id]);
        $this->audit->log($family, 'EVENT_ALBUM', $actor, null, ['event_id' => $event->id, 'album_id' => $album->id]);
        $this->chat->announce($family, "📸 Альбом події «{$event->title}»: присутні можуть додати фото — /albums/{$album->id}");

        return $album;
    }

    private static function newCode(): string
    {
        return str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
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
