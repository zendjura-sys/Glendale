<?php

namespace App\Services;

use App\Models\Clan;
use App\Models\ClanEvent;
use App\Models\ClanMember;
use App\Models\Family;
use App\Models\FamilyEvent;
use App\Models\FamilyEventAttendance;
use App\Models\FamilyMember;
use App\Models\Game;
use App\Models\GameEvent;
use App\Models\GameEventRsvp;
use App\Models\GtaServer;
use App\Models\ServerEvent;
use App\Models\ServerEventRsvp;
use App\Models\User;
use App\Notifications\EventReminder;
use App\Services\Families\FamilyGate;
use App\Support\Settings\SiteSettings;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

/**
 * Календар подій: сім’ї, клани, сервери GTA й ігри в одній стрічці, «піду / не піду»,
 * нагадування за пів години до початку. Події сімей і кланів живуть у своїх розділах —
 * тут лише збираємо їх разом і додаємо події серверів.
 */
class EventCalendar
{
    /** За скільки хвилин до початку нагадуємо. */
    public const REMIND_MINUTES = 30;

    /** За скільки хвилин до початку можна попросити нагадування. */
    public const REMIND_LEADS = [10, 30, 60, 1440];

    /** Скільки днів уперед показуємо. */
    public const DAYS = 60;

    public function __construct(private readonly FamilyGate $gate, private readonly SiteSettings $settings) {}

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
                    $items->push([...$this->item('family', $e->id, $e->title, FamilyEvent::TYPES[$e->type] ?? $e->type, $e->description, $e->starts_at, [
                        'name' => "[{$family->tag}] {$family->name}",
                        'url' => '/f/'.$family->slug.'/events',
                    ], match ($mine?->status) {
                        null => null,
                        FamilyEventAttendance::STATUS_DECLINED => 'declined',
                        FamilyEventAttendance::STATUS_WAITLIST => 'waitlist',
                        default => 'going',
                    },
                        $e->attendance->whereIn('status', [FamilyEventAttendance::STATUS_GOING, FamilyEventAttendance::STATUS_ATTENDED])->count(),
                        '/f/'.$family->slug.'/events/'.$e->id.'/rsvp'), 'image' => $this->cover($e->cover_path), 'capacity' => $e->capacity]);
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
                    $items->push([...$this->item('clan', $e->id, $e->title, Clan::TYPES[$clan->type] ?? 'Клан', $e->description, $e->starts_at, [
                        'name' => $clan->display_name,
                        'url' => '/clans/'.$clan->slug,
                    ], $e->going->isNotEmpty() ? 'going' : null, (int) $e->getAttribute('going_count'), '/clans/'.$clan->slug.'/events/'.$e->id.'/rsvp'), 'image' => $this->cover($e->cover_path)]);
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

        if ($kind === null || $kind === 'game') {
            $query = $this->gameEvents($user)->whereBetween('starts_at', [$from, $to]);
            if ($kind === null) {
                // У загальній стрічці — великі шоукейси й події моїх ігор (клани, «Граю в…», записався).
                $mine = $this->gamesOf($user);
                $query->where(fn ($q) => $q->whereIn('type', ['showcase', 'stream'])
                    ->orWhereHas('games', fn ($g) => $g->whereIn('games.id', $mine ?: [0]))
                    ->orWhereHas('rsvps', fn ($r) => $r->where('user_id', $user->id)->where('status', GameEventRsvp::GOING)));
            }
            $query->limit(200)->get()->each(fn (GameEvent $e) => $items->push($this->gameItem($e, $user)));
        }

        return array_values($items->sortBy('starts_at')->values()->all());
    }

    /**
     * Найближчі виходи ігор і сезони (оновлення). «Нагадати» — це запис «піду».
     *
     * @return list<array<string, mixed>>
     */
    public function releases(User $user): array
    {
        return array_values($this->gameEvents($user)
            ->whereIn('type', ['release', 'update'])
            ->whereBetween('starts_at', [now()->subDay(), now()->addDays(120)])
            ->limit(80)
            ->get()
            ->map(fn (GameEvent $event) => [...$this->gameItem($event, $user), 'remind' => true])
            ->all());
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
     * Події гри (для її сторінки).
     *
     * @return list<array<string, mixed>>
     */
    public function forGame(Game $game, ?User $user): array
    {
        return array_values($this->gameEvents($user)
            ->whereHas('games', fn ($q) => $q->where('games.id', $game->id))
            ->where('starts_at', '>=', now()->subHours(3))
            ->limit(20)
            ->get()
            ->map(fn (GameEvent $e) => $this->gameItem($e, $user))
            ->all());
    }

    /**
     * @param  array{title: string, type: string, description: string|null, starts_at: CarbonInterface, url: string|null}  $data
     */
    public function createGameEvent(Game $game, User $user, array $data): GameEvent
    {
        abort_unless($user->isStaff(), 403, 'Події ігор додає адміністрація GameCon.');
        $event = GameEvent::query()->create([...$data, 'user_id' => $user->id, 'source' => 'manual']);
        $event->games()->attach($game->id);
        GameEventRsvp::query()->create(['game_event_id' => $event->id, 'user_id' => $user->id, 'status' => GameEventRsvp::GOING]);

        return $event;
    }

    public function rsvpGame(GameEvent $event, User $user, bool $going): void
    {
        $ended = $event->all_day
            ? $event->starts_at->timezone('Europe/Kyiv')->toDateString() < now('Europe/Kyiv')->toDateString()
            : ($event->ends_at ?? $event->starts_at)->lt(now()->subHours(3));
        abort_if($ended, 422, 'Подія вже минула.');
        GameEventRsvp::query()->updateOrCreate(
            ['game_event_id' => $event->id, 'user_id' => $user->id],
            ['status' => $going ? GameEventRsvp::GOING : GameEventRsvp::DECLINED],
        );
    }

    public function deleteGameEvent(GameEvent $event, User $user): void
    {
        abort_unless($user->isStaff(), 403, 'Видалити подію гри може адміністрація.');
        $event->delete();
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
     * @param  array{title: string, type: string, description: string|null, starts_at: CarbonInterface, family_id: int|null, repeat?: string|null}  $data
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
            'repeat' => ($data['repeat'] ?? null) === 'weekly' ? 'weekly' : null,
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
     * Нагадування перед подіями сімей, кланів, серверів та ігор. Кожен сам обирає запас
     * (Налаштування подій: 10 хв, пів години, година чи доба), журнал не дає надіслати двічі.
     *
     * @return int скільки подій нагадали
     */
    public function remind(): int
    {
        $horizon = [now(), now()->addMinutes(max(self::REMIND_LEADS))];
        $count = 0;

        FamilyEvent::query()->with('attendance')->where('status', FamilyEvent::STATUS_PLANNED)
            ->whereBetween('starts_at', $horizon)->get()
            ->each(function (FamilyEvent $e) use (&$count) {
                $family = Family::query()->find($e->family_id);
                if (! $family instanceof Family) {
                    return;
                }
                $declined = $e->attendance->where('status', FamilyEventAttendance::STATUS_DECLINED)->pluck('member_id')->all();
                $count += $this->remindEach($e, 'family',
                    fn () => User::query()->whereIn('id', $family->activeMembers()->whereNotIn('id', $declined ?: [0])->select('user_id'))->get(),
                    fn (string $left) => "⏰ {$left}: «{$e->title}»", '/f/'.$family->slug.'/events', $family->id);
            });

        ClanEvent::query()->whereBetween('starts_at', $horizon)->get()
            ->each(function (ClanEvent $e) use (&$count) {
                $clan = Clan::query()->find($e->clan_id);
                if ($clan instanceof Clan) {
                    $count += $this->remindEach($e, 'clan', fn () => $e->going()->get(),
                        fn (string $left) => "⏰ {$clan->display_name}: {$left} «{$e->title}»", '/clans/'.$clan->slug);
                }
            });

        ServerEvent::query()->with('server')->whereBetween('starts_at', $horizon)->get()
            ->each(function (ServerEvent $e) use (&$count) {
                $count += $this->remindEach($e, 'server',
                    fn () => User::query()->whereIn('id', $e->rsvps()->where('status', ServerEventRsvp::GOING)->select('user_id'))->get(),
                    fn (string $left) => "⏰ {$e->server?->name}: {$left} «{$e->title}»", '/events');
            });

        // Шоукейси, трансляції й турніри — тим, хто записався.
        GameEvent::query()->where('all_day', false)->whereBetween('starts_at', $horizon)->get()
            ->each(function (GameEvent $e) use (&$count) {
                $count += $this->remindEach($e, 'game',
                    fn () => User::query()->whereIn('id', $e->rsvps()->where('status', GameEventRsvp::GOING)->select('user_id'))->get(),
                    fn (string $left) => "⏰ {$left}: «{$e->title}»", '/events?kind=game');
            });

        // Виходи і сезони — на весь день: нагадуємо в день старту тим, хто натиснув «Нагадати».
        $today = now('Europe/Kyiv')->toDateString();
        GameEvent::query()->whereNull('reminded_at')->where('all_day', true)->whereIn('type', ['release', 'update'])
            ->whereBetween('starts_at', [now()->subHours(36), now()->addHours(36)])->get()
            ->each(function (GameEvent $e) use (&$count, $today) {
                if ($e->starts_at->timezone('Europe/Kyiv')->toDateString() !== $today) {
                    return;
                }
                $e->update(['reminded_at' => now()]);
                $users = User::query()->whereIn('id', $e->rsvps()->where('status', GameEventRsvp::GOING)->select('user_id'))->get();
                $this->send($users, "Сьогодні: «{$e->title}»", '/events/releases');
                $count++;
            });

        return $count;
    }

    /**
     * Події ігор з урахуванням перемикачів «Події ігор» і «Виходи ігор» (Адмінка → Ігри).
     *
     * @return Builder<GameEvent>
     */
    private function gameEvents(?User $user): Builder
    {
        $on = Game::features($this->settings->get('games_features'));
        $types = array_keys(GameEvent::TYPES);
        if (! $on['events']) {
            $types = ['release'];
        }
        if (! $on['release_events']) {
            $types = array_values(array_diff($types, ['release']));
        }

        return GameEvent::query()
            ->with(['games' => fn ($q) => $q->select('games.id', 'games.name', 'games.slug')])
            ->withCount(['rsvps as going_count' => fn ($q) => $q->where('status', GameEventRsvp::GOING)])
            ->with(['rsvps' => fn ($q) => $q->where('user_id', $user->id ?? 0)])
            ->whereIn('type', $types ?: ['-'])
            ->orderBy('starts_at');
    }

    /**
     * Ігри людини: клани, поточна гра зі статусу «Граю в…».
     *
     * @return list<int>
     */
    private function gamesOf(User $user): array
    {
        $ids = Clan::query()->whereIn('id', ClanMember::query()->where('user_id', $user->id)->where('status', ClanMember::STATUS_ACTIVE)->select('clan_id'))
            ->pluck('game_id')->all();
        $playing = $user->playing();
        if (($playing['kind'] ?? null) === 'game' && isset($playing['id'])) {
            $ids[] = $playing['id'];
        }

        return array_values(array_unique(array_filter(array_map('intval', $ids))));
    }

    /**
     * @return array<string, mixed>
     */
    private function gameItem(GameEvent $e, ?User $user): array
    {
        $mine = $e->rsvps->first();
        $first = $e->games->first();
        $where = $first instanceof Game
            ? ['name' => $e->games->count() > 1 ? $first->name.' +'.($e->games->count() - 1) : $first->name, 'url' => '/games/'.$first->slug]
            : ['name' => 'Ігри', 'url' => '/games'];
        $item = $this->item('game', $e->id, $e->title, GameEvent::TYPES[$e->type] ?? $e->type, $e->description, $e->starts_at, $where,
            $mine instanceof GameEventRsvp ? ($mine->status === GameEventRsvp::GOING ? 'going' : 'declined') : null,
            (int) $e->getAttribute('going_count'), '/events/game/'.$e->id.'/rsvp');

        return [
            ...$item,
            'host' => GameEvent::SOURCES[$e->source] ?? null,
            'source' => $e->source,
            'all_day' => $e->all_day,
            'ends_at' => $e->ends_at?->toIso8601String(),
            'url' => $e->url,
            'image' => $e->image,
            'games' => $e->games->take(8)->map(fn (Game $g) => ['name' => $g->name, 'url' => '/games/'.$g->slug])->values()->all(),
            'can_delete' => $e->source === 'manual' && $user?->isStaff() === true,
            'delete_url' => '/events/game/'.$e->id,
        ];
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
            'host' => $e->source === 'discord' ? 'Discord сервера' : ($e->is_official ? 'GameCon' : ($e->family ? "[{$e->family->tag}] {$e->family->name}" : null)),
            'is_official' => $e->is_official,
            'source' => $e->source,
            'ends_at' => $e->ends_at?->toIso8601String(),
            'url' => $e->url,
            'can_delete' => $e->source === 'manual' ? ($e->user_id === $user->id || $user->isStaff()) : false,
            'delete_url' => '/events/server/'.$e->id,
        ];
    }

    /**
     * Однакова картка події для календаря незалежно від джерела.
     *
     * @param  array{name: string, url: string}  $where
     * @return array<string, mixed>
     */
    private function item(string $kind, int $id, string $title, string $typeLabel, ?string $description, CarbonInterface $startsAt, array $where, ?string $status, int $goingCount, string $rsvpUrl): array
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
            'ics_url' => '/events/'.$kind.'/'.$id.'.ics',
            'all_day' => false,
            'ends_at' => null,
            'url' => null,
            'image' => null,
            'source' => null,
        ];
    }

    /**
     * Подія для файлу календаря (.ics), якщо людина її бачить: сім’ї й клани — лише учасникам.
     *
     * @return array{uid: string, title: string, description: string|null, starts_at: CarbonInterface, ends_at: CarbonInterface|null, all_day: bool, url: string}|null
     */
    public function calendarEntry(string $kind, int $id, User $user): ?array
    {
        $base = rtrim((string) config('app.url'), '/');
        switch ($kind) {
            case 'family':
                $e = FamilyEvent::query()->find($id);
                $family = $e ? Family::query()->find($e->family_id) : null;
                if (! $e || ! $family || ! FamilyMember::query()->where('family_id', $family->id)->where('user_id', $user->id)->where('status', FamilyMember::STATUS_ACTIVE)->exists()) {
                    return null;
                }

                return ['uid' => "family-{$e->id}", 'title' => "[{$family->tag}] {$e->title}", 'description' => $e->description, 'starts_at' => $e->starts_at, 'ends_at' => null, 'all_day' => false, 'url' => $base.'/f/'.$family->slug.'/events'];
            case 'clan':
                $e = ClanEvent::query()->find($id);
                $clan = $e ? Clan::query()->find($e->clan_id) : null;
                if (! $e || ! $clan || ! ClanMember::query()->where('clan_id', $clan->id)->where('user_id', $user->id)->where('status', ClanMember::STATUS_ACTIVE)->exists()) {
                    return null;
                }

                return ['uid' => "clan-{$e->id}", 'title' => "{$clan->display_name}: {$e->title}", 'description' => $e->description, 'starts_at' => $e->starts_at, 'ends_at' => null, 'all_day' => false, 'url' => $base.'/clans/'.$clan->slug];
            case 'server':
                $e = ServerEvent::query()->with('server')->find($id);

                return $e ? ['uid' => "server-{$e->id}", 'title' => ($e->server ? $e->server->name.': ' : '').$e->title, 'description' => $e->description, 'starts_at' => $e->starts_at, 'ends_at' => $e->ends_at, 'all_day' => false, 'url' => $base.'/events?kind=server'] : null;
            case 'game':
                $e = GameEvent::query()->find($id);

                return $e ? ['uid' => "game-{$e->id}", 'title' => $e->title, 'description' => $e->description, 'starts_at' => $e->starts_at, 'ends_at' => $e->ends_at, 'all_day' => $e->all_day, 'url' => $e->url ?? $base.'/events?kind=game'] : null;
        }

        return null;
    }

    /**
     * Текст файлу .ics (RFC 5545): час у UTC, без опису — дві години.
     *
     * @param  array{uid: string, title: string, description: string|null, starts_at: CarbonInterface, ends_at: CarbonInterface|null, all_day: bool, url: string}  $entry
     */
    public static function ics(array $entry): string
    {
        $escape = fn (string $text): string => str_replace(['\\', ';', ',', "\r\n", "\n"], ['\\\\', '\\;', '\\,', '\\n', '\\n'], $text);
        $start = $entry['starts_at']->copy()->utc();
        $end = $entry['ends_at']?->copy()->utc() ?? $start->copy()->addHours(2);
        $lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//GameCon//Events//UK',
            'CALSCALE:GREGORIAN',
            'BEGIN:VEVENT',
            'UID:'.$entry['uid'].'@gamecon.online',
            'DTSTAMP:'.now()->utc()->format('Ymd\THis\Z'),
            $entry['all_day'] ? 'DTSTART;VALUE=DATE:'.$entry['starts_at']->copy()->setTimezone('Europe/Kyiv')->format('Ymd') : 'DTSTART:'.$start->format('Ymd\THis\Z'),
            $entry['all_day'] ? 'DTEND;VALUE=DATE:'.$entry['starts_at']->copy()->setTimezone('Europe/Kyiv')->addDay()->format('Ymd') : 'DTEND:'.$end->format('Ymd\THis\Z'),
            'SUMMARY:'.$escape($entry['title']),
            'URL:'.$entry['url'],
        ];
        if ($entry['description'] !== null && $entry['description'] !== '') {
            $lines[] = 'DESCRIPTION:'.$escape($entry['description']);
        }
        $lines[] = 'BEGIN:VALARM';
        $lines[] = 'TRIGGER:-PT30M';
        $lines[] = 'ACTION:DISPLAY';
        $lines[] = 'DESCRIPTION:'.$escape($entry['title']);
        $lines[] = 'END:VALARM';
        $lines[] = 'END:VEVENT';
        $lines[] = 'END:VCALENDAR';

        // Рядки довші за 75 байтів переносимо з пробілом на початку (складання рядків RFC 5545).
        $folded = array_map(function (string $line): string {
            $out = '';
            while (strlen($line) > 75) {
                $cut = 75;
                while ($cut > 0 && (ord($line[$cut]) & 0xC0) === 0x80) {
                    $cut--;
                }
                $out .= substr($line, 0, $cut)."\r\n ";
                $line = substr($line, $cut);
            }

            return $out.$line;
        }, $lines);

        return implode("\r\n", $folded)."\r\n";
    }

    /** Запас нагадування людини (налаштування подій), типово пів години. */
    public static function leadOf(User $user): int
    {
        $lead = $user->pref('event_lead', self::REMIND_MINUTES);

        return is_numeric($lead) && in_array((int) $lead, self::REMIND_LEADS, true) ? (int) $lead : self::REMIND_MINUTES;
    }

    /**
     * Надіслати нагадування тим, чий запас уже настав і кому ще не нагадували про цю подію.
     *
     * @param  callable(): Collection<int, User>  $recipients
     * @param  callable(string): string  $text
     */
    private function remindEach(FamilyEvent|ClanEvent|ServerEvent|GameEvent $event, string $kind, callable $recipients, callable $text, string $url, ?int $familyId = null): int
    {
        $minutes = now()->diffInMinutes($event->starts_at, false);
        $due = array_values(array_filter(self::REMIND_LEADS, fn (int $lead) => $minutes <= $lead));
        if ($minutes < 0 || $due === []) {
            return 0;
        }
        $sent = DB::table('event_reminder_log')->where('kind', $kind)->where('event_id', $event->id)->pluck('lead_minutes')
            ->map(fn ($lead) => (int) $lead)->all();
        $fresh = array_values(array_diff($due, $sent));
        if ($fresh === []) {
            return 0;
        }
        DB::table('event_reminder_log')->insertOrIgnore(array_map(
            fn (int $lead) => ['kind' => $kind, 'event_id' => $event->id, 'lead_minutes' => $lead, 'created_at' => now()],
            $fresh,
        ));

        $users = $recipients()->filter(fn (User $user) => in_array(self::leadOf($user), $fresh, true))->values();
        if ($users->isEmpty()) {
            return 0;
        }
        $this->send($users, $text($this->leftLabel($event->starts_at)), $url, $familyId);
        if ($event->reminded_at === null) {
            $event->update(['reminded_at' => now()]);
        }

        return 1;
    }

    /** «За 25 хв», «За 2 год» чи «Завтра о 19:00» (за Києвом). */
    private function leftLabel(CarbonInterface $startsAt): string
    {
        $minutes = $this->minutesLeft($startsAt);
        if ($minutes < 90) {
            return "За {$minutes} хв";
        }
        if ($minutes < 12 * 60) {
            return 'За '.(int) round($minutes / 60).' год';
        }

        $local = $startsAt->copy()->setTimezone('Europe/Kyiv');

        return ($local->isSameDay(now('Europe/Kyiv')) ? 'Сьогодні о ' : 'Завтра о ').$local->format('H:i');
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

    private function cover(?string $path): ?string
    {
        return $path !== null ? Storage::disk('public')->url($path) : null;
    }

    private function minutesLeft(CarbonInterface $startsAt): int
    {
        return max(1, (int) ceil(now()->diffInMinutes($startsAt, true)));
    }
}
