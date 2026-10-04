<?php

namespace App\Services;

use App\Models\Clan;
use App\Models\ClanEvent;
use App\Models\ClanMember;
use App\Models\Family;
use App\Models\FamilyEvent;
use App\Models\FamilyEventAttendance;
use App\Models\FamilyMember;
use App\Models\GtaServer;
use App\Models\ServerEvent;
use App\Models\ServerEventRsvp;
use App\Models\User;
use App\Notifications\EventReminder;
use App\Services\Families\FamilyGate;
use App\Services\Families\ReportService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;

/**
 * Календар подій: сім’ї, клани й сервери GTA в одній стрічці, «піду / не піду»,
 * нагадування за пів години до початку. Події сімей і кланів живуть у своїх розділах —
 * тут лише збираємо їх разом і додаємо події серверів.
 */
class EventCalendar
{
    /** За скільки хвилин до початку нагадуємо. */
    public const REMIND_MINUTES = 30;

    /** Скільки днів уперед показуємо. */
    public const DAYS = 60;

    public function __construct(private readonly FamilyGate $gate) {}

    /**
     * Найближчі події для людини, від найранішої.
     *
     * @return list<array<string, mixed>>
     */
    public function upcoming(User $user, ?string $kind = null): array
    {
        $from = now()->subHours(3);
        $to = now()->addDays(self::DAYS);
        $items = collect();

        if ($kind === null || $kind === 'family') {
            $members = FamilyMember::query()->with('family')->where('user_id', $user->id)->where('status', FamilyMember::STATUS_ACTIVE)->get()->keyBy('family_id');
            FamilyEvent::query()->with('attendance')
                ->whereIn('family_id', $members->keys()->all() ?: [0])
                ->where('status', FamilyEvent::STATUS_PLANNED)
                ->whereBetween('starts_at', [$from, $to])
                ->get()
                ->each(function (FamilyEvent $e) use ($items, $members) {
                    $member = $members->get($e->family_id);
                    $family = $member?->family;
                    if (! $member instanceof FamilyMember || ! $family instanceof Family) {
                        return;
                    }
                    $mine = $e->attendance->firstWhere('member_id', $member->id);
                    $items->push($this->item('family', $e->id, $e->title, FamilyEvent::TYPES[$e->type] ?? $e->type, $e->description, $e->starts_at, [
                        'name' => "[{$family->tag}] {$family->name}",
                        'url' => '/f/'.$family->slug.'/events',
                    ], $mine?->status === FamilyEventAttendance::STATUS_DECLINED ? 'declined' : ($mine ? 'going' : null),
                        $e->attendance->where('status', '!=', FamilyEventAttendance::STATUS_DECLINED)->count(),
                        '/f/'.$family->slug.'/events/'.$e->id.'/rsvp'));
                });
        }

        if ($kind === null || $kind === 'clan') {
            $clans = Clan::query()->whereIn('id', ClanMember::query()->where('user_id', $user->id)->where('status', ClanMember::STATUS_ACTIVE)->select('clan_id'))->get()
                ->filter(fn (Clan $c) => $c->hasFeature('events'))->keyBy('id');
            ClanEvent::query()->withCount('going')
                ->with(['going' => fn ($q) => $q->where('users.id', $user->id)])
                ->whereIn('clan_id', $clans->keys()->all() ?: [0])
                ->whereBetween('starts_at', [$from, $to])
                ->get()
                ->each(function (ClanEvent $e) use ($items, $clans) {
                    $clan = $clans->get($e->clan_id);
                    if (! $clan instanceof Clan) {
                        return;
                    }
                    $items->push($this->item('clan', $e->id, $e->title, Clan::TYPES[$clan->type] ?? 'Клан', $e->description, $e->starts_at, [
                        'name' => $clan->display_name,
                        'url' => '/clans/'.$clan->slug,
                    ], $e->going->isNotEmpty() ? 'going' : null, (int) $e->getAttribute('going_count'), '/clans/'.$clan->slug.'/events/'.$e->id.'/rsvp'));
                });
        }

        if ($kind === null || $kind === 'server') {
            $servers = $this->serversOf($user);
            ServerEvent::query()->with(['server', 'family'])
                ->withCount(['rsvps as going_count' => fn ($q) => $q->where('status', ServerEventRsvp::GOING)])
                ->with(['rsvps' => fn ($q) => $q->where('user_id', $user->id)])
                ->where(fn ($q) => $q->whereIn('gta_server_id', $servers ?: [0])->orWhere('is_official', true))
                ->whereBetween('starts_at', [$from, $to])
                ->get()
                ->each(fn (ServerEvent $e) => $items->push($this->serverItem($e, $user)));
        }

        return array_values($items->sortBy('starts_at')->values()->all());
    }

    /**
     * Події одного сервера (для його сторінки).
     *
     * @return list<array<string, mixed>>
     */
    public function forServer(GtaServer $server, User $user): array
    {
        return array_values(ServerEvent::query()->with(['server', 'family'])
            ->withCount(['rsvps as going_count' => fn ($q) => $q->where('status', ServerEventRsvp::GOING)])
            ->with(['rsvps' => fn ($q) => $q->where('user_id', $user->id)])
            ->where('gta_server_id', $server->id)
            ->where('starts_at', '>=', now()->subHours(3))
            ->orderBy('starts_at')
            ->limit(30)
            ->get()
            ->map(fn (ServerEvent $e) => $this->serverItem($e, $user))
            ->all());
    }

    /**
     * Від чийого імені людина може створити подію сервера: адміністрація — офіційну,
     * учасник з правом «events.manage» — від своєї сім’ї на цьому сервері.
     *
     * @return list<array{id: int|null, name: string}>
     */
    public function hosts(GtaServer $server, User $user): array
    {
        $hosts = $user->isStaff() ? [['id' => null, 'name' => 'GameCon (офіційна подія)']] : [];
        $members = FamilyMember::query()->with('family')->where('user_id', $user->id)->where('status', FamilyMember::STATUS_ACTIVE)->get();
        foreach ($members as $member) {
            $family = $member->family;
            if ($family->server_id === $server->id && $this->gate->can($member, $family, 'events.manage')) {
                $hosts[] = ['id' => $family->id, 'name' => "[{$family->tag}] {$family->name}"];
            }
        }

        return $hosts;
    }

    /**
     * @param  array{title: string, type: string, description: string|null, starts_at: Carbon, family_id: int|null}  $data
     */
    public function createServerEvent(GtaServer $server, User $user, array $data): ServerEvent
    {
        $allowed = collect($this->hosts($server, $user))->pluck('id')->all();
        abort_unless(in_array($data['family_id'], $allowed, true), 403, 'Створювати події сервера можуть керівники сімей цього сервера.');

        $event = ServerEvent::query()->create([
            'gta_server_id' => $server->id,
            'user_id' => $user->id,
            'family_id' => $data['family_id'],
            'title' => $data['title'],
            'type' => $data['type'],
            'description' => $data['description'],
            'starts_at' => $data['starts_at'],
            'is_official' => $data['family_id'] === null,
        ]);
        ServerEventRsvp::query()->create(['server_event_id' => $event->id, 'user_id' => $user->id, 'status' => ServerEventRsvp::GOING]);

        return $event;
    }

    public function rsvp(ServerEvent $event, User $user, bool $going): void
    {
        abort_if($event->starts_at->lt(now()->subHours(3)), 422, 'Подія вже минула.');
        ServerEventRsvp::query()->updateOrCreate(
            ['server_event_id' => $event->id, 'user_id' => $user->id],
            ['status' => $going ? ServerEventRsvp::GOING : ServerEventRsvp::DECLINED],
        );
    }

    public function deleteServerEvent(ServerEvent $event, User $user): void
    {
        abort_unless($event->user_id === $user->id || $user->isStaff(), 403, 'Видалити може автор події або адміністрація.');
        $event->delete();
    }

    /**
     * Нагадування за пів години: учасникам, які не відмовилися (сім’ї), записалися (клани, сервери).
     *
     * @return int скільки подій нагадали
     */
    public function remind(): int
    {
        $window = [now(), now()->addMinutes(self::REMIND_MINUTES)];
        $count = 0;

        FamilyEvent::query()->with('attendance')->where('status', FamilyEvent::STATUS_PLANNED)->whereNull('reminded_at')
            ->whereBetween('starts_at', $window)->get()
            ->each(function (FamilyEvent $e) use (&$count) {
                $family = Family::query()->find($e->family_id);
                $e->update(['reminded_at' => now()]);
                if (! $family instanceof Family) {
                    return;
                }
                $declined = $e->attendance->where('status', FamilyEventAttendance::STATUS_DECLINED)->pluck('member_id')->all();
                $users = User::query()->whereIn('id', $family->activeMembers()->whereNotIn('id', $declined ?: [0])->select('user_id'))->get();
                $this->send($users, "⏰ За {$this->minutesLeft($e->starts_at)} хв: «{$e->title}»", '/f/'.$family->slug.'/events', $family->id);
                $count++;
            });

        ClanEvent::query()->whereNull('reminded_at')->whereBetween('starts_at', $window)->get()
            ->each(function (ClanEvent $e) use (&$count) {
                $e->update(['reminded_at' => now()]);
                $clan = Clan::query()->find($e->clan_id);
                if ($clan instanceof Clan) {
                    $this->send($e->going()->get(), "⏰ {$clan->display_name}: за {$this->minutesLeft($e->starts_at)} хв «{$e->title}»", '/clans/'.$clan->slug);
                    $count++;
                }
            });

        ServerEvent::query()->with('server')->whereNull('reminded_at')->whereBetween('starts_at', $window)->get()
            ->each(function (ServerEvent $e) use (&$count) {
                $e->update(['reminded_at' => now()]);
                $users = User::query()->whereIn('id', $e->rsvps()->where('status', ServerEventRsvp::GOING)->select('user_id'))->get();
                $this->send($users, "⏰ {$e->server?->name}: за {$this->minutesLeft($e->starts_at)} хв «{$e->title}»", '/events');
                $count++;
            });

        return $count;
    }

    /**
     * Сервери, на яких людина грає (через свої сім’ї).
     *
     * @return list<int>
     */
    private function serversOf(User $user): array
    {
        return array_values(array_unique(array_filter(array_map('intval', Family::query()
            ->whereIn('id', FamilyMember::query()->where('user_id', $user->id)->where('status', FamilyMember::STATUS_ACTIVE)->select('family_id'))
            ->pluck('server_id')->all()))));
    }

    /**
     * @return array<string, mixed>
     */
    private function serverItem(ServerEvent $e, User $user): array
    {
        $mine = $e->rsvps->first();
        $item = $this->item('server', $e->id, $e->title, ServerEvent::TYPES[$e->type] ?? $e->type, $e->description, $e->starts_at, [
            'name' => $e->server->name ?? 'Сервер',
            'url' => $e->server ? '/servers/'.$e->server->slug : '/servers',
        ], $mine instanceof ServerEventRsvp ? ($mine->status === ServerEventRsvp::GOING ? 'going' : 'declined') : null,
            (int) $e->getAttribute('going_count'), '/events/server/'.$e->id.'/rsvp');

        return [
            ...$item,
            'host' => $e->is_official ? 'GameCon' : ($e->family ? "[{$e->family->tag}] {$e->family->name}" : null),
            'is_official' => $e->is_official,
            'can_delete' => $e->user_id === $user->id || $user->isStaff(),
        ];
    }

    /**
     * Однакова картка події для календаря незалежно від джерела.
     *
     * @param  array{name: string, url: string}  $where
     * @return array<string, mixed>
     */
    private function item(string $kind, int $id, string $title, string $typeLabel, ?string $description, Carbon $startsAt, array $where, ?string $status, int $goingCount, string $rsvpUrl): array
    {
        return [
            'key' => $kind.':'.$id,
            'kind' => $kind,
            'id' => $id,
            'title' => $title,
            'type_label' => $typeLabel,
            'description' => $description,
            'starts_at' => $startsAt->toIso8601String(),
            'where' => $where,
            'status' => $status,
            'going_count' => $goingCount,
            // Клани приймають лише перемикач «піду», сім’ї й сервери — «піду / не піду».
            'can_decline' => $kind !== 'clan',
            'rsvp_url' => $rsvpUrl,
        ];
    }

    /**
     * @param  Collection<int, User>  $users
     */
    private function send(Collection $users, string $text, string $url, ?int $familyId = null): void
    {
        if ($users->isNotEmpty()) {
            Notification::send($users, new EventReminder($text, $url, $familyId));
        }
    }

    private function minutesLeft(Carbon $startsAt): int
    {
        return max(1, (int) ceil(now()->diffInMinutes($startsAt, true)));
    }

    /** Час події за Києвом — для текстів. */
    public static function kyiv(Carbon $at): string
    {
        return $at->copy()->setTimezone(ReportService::TIMEZONE)->format('d.m H:i');
    }
}
