<?php

namespace App\Services\Music;

use App\Models\Clan;
use App\Models\ClanMember;
use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\ListenParty;
use App\Models\ListenPartyMember;
use App\Models\ListenPartyMessage;
use App\Models\ListenRoomPolicy;
use App\Models\RadioStation;
use App\Models\Track;
use App\Models\User;
use App\Notifications\ListenRoomStarted;
use App\Services\Families\FamilyAudit;
use App\Services\ListenParties;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * Кімнати «Слухати разом» для сім’ї, клану, спільноти або друзів. Поверх спільного прослуховування
 * (ListenParties): діджей керує плеєром, слухачі пропонують треки, реагують емодзі й пишуть у чат.
 * Синхронізуються лише треки GameCon і радіо — Spotify кожен слухає через свій акаунт.
 */
class ListenRooms
{
    /** Скільки пропозицій чекає на діджея одночасно. */
    public const SUGGESTION_LIMIT = 30;

    /** Скільки пропозицій від однієї людини. */
    public const SUGGESTIONS_PER_USER = 5;

    /** Скільки учасників групи отримують сповіщення про нову кімнату. */
    public const NOTIFY_LIMIT = 500;

    /** Не частіше ніж раз на стільки секунд на групу. */
    public const NOTIFY_COOLDOWN = 1800;

    /** Скільки секунд реакція видна тим, хто опитує стан (застосунок). */
    public const REACTION_SECONDS = 15;

    public function __construct(private readonly ListenParties $parties) {}

    /**
     * Назва, посилання й обкладинка групи.
     *
     * @return array{type: string, id: int, name: string, url: string, avatar_url: string|null}|null
     */
    public function group(string $type, int $id): ?array
    {
        $model = match ($type) {
            'family' => Family::query()->find($id),
            'clan' => Clan::query()->find($id),
            'community' => Community::query()->find($id),
            default => null,
        };

        return match (true) {
            $model instanceof Family => ['type' => $type, 'id' => $model->id, 'name' => $model->name, 'url' => '/f/'.$model->slug, 'avatar_url' => $model->logo_url],
            $model instanceof Clan => ['type' => $type, 'id' => $model->id, 'name' => $model->name, 'url' => '/clans/'.$model->slug, 'avatar_url' => $model->logo_url],
            $model instanceof Community => ['type' => $type, 'id' => $model->id, 'name' => $model->name, 'url' => '/c/'.$model->slug, 'avatar_url' => $model->avatar_url],
            default => null,
        };
    }

    /** Роль у групі: null — не учасник, true — адміністратор (лідер, заступник, власник), false — учасник. */
    public function role(string $type, int $id, User $user): ?bool
    {
        switch ($type) {
            case 'family':
                $member = FamilyMember::query()->where('family_id', $id)->where('user_id', $user->id)->where('status', FamilyMember::STATUS_ACTIVE)->first();

                return $member === null ? null : ($member->rank >= Family::DEPUTY_RANK || Family::query()->whereKey($id)->where('owner_id', $user->id)->exists());
            case 'clan':
                $member = ClanMember::query()->where('clan_id', $id)->where('user_id', $user->id)->where('status', ClanMember::STATUS_ACTIVE)->first();

                return $member === null ? null : ($member->rank >= Clan::LEADER_RANK - 1 || Clan::query()->whereKey($id)->where('owner_id', $user->id)->exists());
            case 'community':
                $member = CommunityMember::query()->where('community_id', $id)->where('user_id', $user->id)->where('status', CommunityMember::STATUS_ACTIVE)->first();

                return $member?->isAdmin();
        }

        return null;
    }

    /** Хто може відкривати кімнати: all | admins | off. */
    public function policy(string $type, int $id): string
    {
        return ListenRoomPolicy::query()->where('group_type', $type)->where('group_id', $id)->value('who') ?? 'all';
    }

    public function setPolicy(string $type, int $id, User $user, string $who): void
    {
        abort_unless($this->role($type, $id, $user) === true, 403, 'Змінювати це можуть лише адміністратори групи.');
        abort_unless(array_key_exists($who, ListenRoomPolicy::WHO), 422, 'Невідоме налаштування.');
        $before = $this->policy($type, $id);
        ListenRoomPolicy::query()->updateOrCreate(['group_type' => $type, 'group_id' => $id], ['who' => $who]);
        // Сім’я веде журнал дій керівництва — записуємо й це.
        if ($type === 'family' && $before !== $who && ($family = Family::query()->find($id))) {
            $actor = FamilyMember::query()->where('family_id', $id)->where('user_id', $user->id)->first();
            app(FamilyAudit::class)->log($family, 'LISTEN_ROOMS_UPDATE', $actor, null, ['from' => $before, 'to' => $who], $user);
        }
    }

    public function canStart(string $type, int $id, User $user): bool
    {
        $role = $this->role($type, $id, $user);

        return match ($this->policy($type, $id)) {
            'off' => false,
            'admins' => $role === true,
            default => $role !== null,
        };
    }

    /** Діджей кімнати або адміністратор її групи. */
    public function canManage(ListenParty $party, User $user): bool
    {
        if ($user->id === $party->host_id) {
            return true;
        }

        return $party->isGroupRoom() && $this->role((string) $party->group_type, (int) $party->group_id, $user) === true;
    }

    /** Прибраним із кімнати й стороннім у кімнату групи — зась. */
    public function ensureCanJoin(ListenParty $party, User $user): void
    {
        $kicked = ListenPartyMember::query()->where('listen_party_id', $party->id)->where('user_id', $user->id)->whereNotNull('kicked_at')->exists();
        abort_if($kicked, 403, 'Діджей прибрав вас із цієї кімнати.');
        if ($party->isGroupRoom()) {
            abort_if($this->role((string) $party->group_type, (int) $party->group_id, $user) === null, 403, 'Кімната лише для учасників групи.');
        }
    }

    /**
     * Відкрити кімнату. У групі одна жива кімната: якщо вона вже є — приєднуємося до неї.
     */
    public function start(User $host, ?string $type, ?int $id, ?string $title, Track|RadioStation|null $item = null): ListenParty
    {
        $group = null;
        if ($type !== null) {
            $group = $this->group($type, (int) $id);
            abort_if($group === null, 404, 'Групу не знайдено.');
            abort_if($this->role($type, (int) $id, $host) === null, 403, 'Кімнату відкривають лише учасники групи.');
            $live = $this->active($type, (int) $id);
            if ($live !== null) {
                $this->ensureCanJoin($live, $host);
                $this->parties->touch($live, $host);

                return $live;
            }
            abort_unless($this->canStart($type, (int) $id, $host), 403, $this->policy($type, (int) $id) === 'off'
                ? 'У цій групі кімнати вимкнено.'
                : 'У цій групі кімнати відкривають лише адміністратори.');
        }

        $party = $this->parties->create($host, $item instanceof Track ? $item : null);
        $party->update([
            'group_type' => $type,
            'group_id' => $group['id'] ?? null,
            'title' => filled($title) ? mb_substr(trim((string) $title), 0, 80) : null,
            'station_id' => $item instanceof RadioStation ? $item->id : null,
            'playing' => $item !== null,
            'moderated' => true,
        ]);
        if ($group !== null) {
            $this->notify($party, $host, $group);
        }

        return $party;
    }

    public function active(string $type, int $id): ?ListenParty
    {
        return ListenParty::query()->where('group_type', $type)->where('group_id', $id)->whereNull('ended_at')->latest('id')->first();
    }

    /** Скільки людей зараз у кімнаті. */
    public function listeners(ListenParty $party): int
    {
        return $party->members()->whereNull('kicked_at')->where('last_seen_at', '>=', now()->subSeconds(ListenParty::ONLINE_SECONDS))->count();
    }

    /**
     * Для сторінки групи: кнопка «Слухати разом» і значок «Зараз у кімнаті: N».
     *
     * @return array<string, mixed>
     */
    public function status(string $type, int $id, User $user): array
    {
        $role = $this->role($type, $id, $user);
        if ($role === null) {
            return ['member' => false, 'room' => null, 'can_start' => false, 'can_manage' => false, 'policy' => null];
        }
        $live = $this->active($type, $id);

        return [
            'member' => true,
            'room' => $live ? $this->summary($live) : null,
            'can_start' => $this->canStart($type, $id, $user),
            'can_manage' => $role,
            'policy' => $this->policy($type, $id),
        ];
    }

    /**
     * Розділ «Кімнати» в музиці: живі кімнати моїх груп і друзів, групи, де можна відкрити нову.
     *
     * @return array<string, mixed>
     */
    public function hub(User $user): array
    {
        $groups = $this->groupsOf($user);
        $rooms = ListenParty::query()->whereNull('ended_at')
            ->where(function (Builder $q) use ($groups, $user) {
                foreach ($groups as $g) {
                    $q->orWhere(fn (Builder $inner) => $inner->where('group_type', $g['type'])->where('group_id', $g['id']));
                }
                $q->orWhere(fn (Builder $inner) => $inner->whereNull('group_type')->where('moderated', true)
                    ->whereHas('members', fn (Builder $m) => $m->where('user_id', $user->id)->whereNull('kicked_at')));
            })
            ->latest('id')->limit(30)->get();

        return [
            'rooms' => $rooms->map(fn (ListenParty $p) => $this->summary($p))->values()->all(),
            'groups' => array_map(fn (array $g) => [...$g, 'can_start' => $this->canStart($g['type'], $g['id'], $user)], $groups),
            'stations' => RadioStation::query()->where('is_active', true)->orderBy('position')->limit(30)->get()->map(fn (RadioStation $s) => $s->toCard())->values()->all(),
        ];
    }

    /**
     * Коротко про кімнату для списків і сторінки групи.
     *
     * @return array<string, mixed>
     */
    public function summary(ListenParty $party): array
    {
        return [
            'code' => $party->code,
            'url' => url('/listen/'.$party->code),
            'title' => $party->title,
            'group' => $party->isGroupRoom() ? $this->group((string) $party->group_type, (int) $party->group_id) : null,
            'host' => $party->host?->toCard(),
            'now_playing' => $party->track?->toCard() ?? $party->station?->toCard(),
            'playing' => $party->playing,
            'listeners' => $this->listeners($party),
        ];
    }

    /**
     * Додаток до стану кімнати: група, пропозиції, чат, свіжі реакції.
     *
     * @return array<string, mixed>
     */
    public function extras(ListenParty $party, User $viewer): array
    {
        $messages = $party->messages()->with('user')->whereNotNull('body')->latest('id')->limit(40)->get()->reverse();
        $reactions = $party->messages()->with('user')->whereNotNull('emoji')
            ->where('created_at', '>=', now()->subSeconds(self::REACTION_SECONDS))->latest('id')->limit(20)->get()->reverse();
        $canManage = $this->canManage($party, $viewer);

        return [
            'title' => $party->title,
            'group' => $party->isGroupRoom() ? $this->group((string) $party->group_type, (int) $party->group_id) : null,
            'moderated' => $party->moderated,
            'can_manage' => $canManage,
            'can_review' => $canManage || $party->canControl($viewer),
            'suggestions' => $this->parties->cards($party->suggestions ?? []),
            'messages' => $messages->map(fn (ListenPartyMessage $m) => $m->toCard())->values()->all(),
            'reactions' => $reactions->map(fn (ListenPartyMessage $m) => $m->toCard())->values()->all(),
            'emoji' => ListenPartyMessage::EMOJI,
        ];
    }

    /** Слухач пропонує трек чи станцію в чергу; діджей погоджує або відхиляє. */
    public function suggest(ListenParty $party, User $user, Track|RadioStation $item): void
    {
        $entry = $item instanceof Track ? ['track_id' => $item->id] : ['station_id' => $item->id];
        $suggestions = $party->suggestions ?? [];
        foreach ($suggestions as $s) {
            if (($s['track_id'] ?? null) === ($entry['track_id'] ?? null) && ($s['station_id'] ?? null) === ($entry['station_id'] ?? null)) {
                throw ValidationException::withMessages(['track_id' => 'Це вже запропонували.']);
            }
        }
        if (count(array_filter($suggestions, fn (array $s) => $s['by'] === $user->id)) >= self::SUGGESTIONS_PER_USER) {
            throw ValidationException::withMessages(['track_id' => 'Зачекайте, поки діджей розгляне ваші пропозиції.']);
        }
        if (count($suggestions) >= self::SUGGESTION_LIMIT) {
            throw ValidationException::withMessages(['track_id' => 'Забагато пропозицій — зачекайте, поки діджей розгляне.']);
        }
        $suggestions[] = [...$entry, 'by' => $user->id];
        $party->update(['suggestions' => $suggestions]);
        $this->parties->broadcast($party, ['suggestions' => $this->parties->cards($suggestions)]);
    }

    /** Діджей погоджує пропозицію (вона йде в кінець черги) або відхиляє; автор може свою відкликати. */
    public function review(ListenParty $party, User $user, int $index, bool $approve): void
    {
        $suggestions = $party->suggestions ?? [];
        $item = $suggestions[$index] ?? null;
        abort_if($item === null, 404, 'Такої пропозиції немає.');
        $reviewer = $party->canControl($user) || $this->canManage($party, $user);
        abort_unless($reviewer || (! $approve && $item['by'] === $user->id), 403, 'Пропозиції розглядає діджей.');
        array_splice($suggestions, $index, 1);
        $party->update(['suggestions' => $suggestions]);
        if ($approve) {
            $model = isset($item['station_id']) ? RadioStation::query()->find($item['station_id']) : Track::query()->find($item['track_id'] ?? 0);
            if ($model !== null) {
                $this->parties->enqueue($party, $user, $model, by: $item['by']);
            }
        }
        $this->parties->broadcast($party, ['suggestions' => $this->parties->cards($suggestions)]);
    }

    /**
     * @return array<string, mixed>
     */
    public function react(ListenParty $party, User $user, string $emoji): array
    {
        if (! in_array($emoji, ListenPartyMessage::EMOJI, true)) {
            throw ValidationException::withMessages(['emoji' => 'Такої реакції немає.']);
        }
        $card = ListenPartyMessage::query()->create(['listen_party_id' => $party->id, 'user_id' => $user->id, 'emoji' => $emoji, 'created_at' => now()])
            ->setRelation('user', $user)->toCard();
        $this->parties->broadcast($party, ['reaction' => $card]);

        return $card;
    }

    /**
     * @return array<string, mixed>
     */
    public function say(ListenParty $party, User $user, string $body): array
    {
        $body = trim($body);
        if ($body === '') {
            throw ValidationException::withMessages(['body' => 'Напишіть повідомлення.']);
        }
        $card = ListenPartyMessage::query()->create(['listen_party_id' => $party->id, 'user_id' => $user->id, 'body' => mb_substr($body, 0, 500), 'created_at' => now()])
            ->setRelation('user', $user)->toCard();
        $this->parties->broadcast($party, ['message' => $card]);

        return $card;
    }

    /** Прибрати слухача з кімнати: повернутися він уже не зможе. */
    public function kick(ListenParty $party, User $actor, User $target): void
    {
        abort_unless($this->canManage($party, $actor), 403, 'Прибирати слухачів може діджей.');
        abort_if($target->id === $actor->id, 422, 'Себе прибрати не можна — просто вийдіть.');
        abort_if($target->id === $party->host_id, 422, 'Спершу передайте роль діджея.');
        ListenPartyMember::query()->updateOrCreate(
            ['listen_party_id' => $party->id, 'user_id' => $target->id],
            ['kicked_at' => now(), 'last_seen_at' => now()],
        );
        $suggestions = array_values(array_filter($party->suggestions ?? [], fn (array $s) => $s['by'] !== $target->id));
        $party->update(['suggestions' => $suggestions]);
        $this->parties->broadcast($party, [
            'members' => $this->parties->members($party),
            'suggestions' => $this->parties->cards($suggestions),
            'kicked' => $target->id,
        ]);
    }

    /** Передати роль діджея тому, хто зараз у кімнаті. */
    public function passHost(ListenParty $party, User $actor, User $target): void
    {
        abort_unless($this->canManage($party, $actor), 403, 'Передати роль діджея може лише діджей.');
        $here = ListenPartyMember::query()->where('listen_party_id', $party->id)->where('user_id', $target->id)
            ->whereNull('kicked_at')->where('last_seen_at', '>=', now()->subSeconds(ListenParty::ONLINE_SECONDS))->exists();
        abort_unless($here, 422, 'Передати можна лише тому, хто зараз у кімнаті.');
        $party->update(['host_id' => $target->id]);
        $party->unsetRelation('host');
        $this->parties->broadcast($party, [
            'host' => $party->host?->toCard(),
            'members' => $this->parties->members($party),
            'state' => $this->parties->playback($party),
        ]);
    }

    /** Кімнати, де вже IDLE_MINUTES хвилин ніхто не слухає, завершуються. */
    public function sweep(): int
    {
        $cutoff = now()->subMinutes(ListenParty::IDLE_MINUTES);
        $ended = 0;
        ListenParty::query()->whereNull('ended_at')->where('created_at', '<', $cutoff)
            ->whereDoesntHave('members', fn (Builder $q) => $q->whereNull('kicked_at')->where('last_seen_at', '>=', $cutoff))
            ->each(function (ListenParty $party) use (&$ended) {
                $party->update(['ended_at' => now(), 'playing' => false]);
                $this->parties->broadcast($party, ['ended' => true]);
                $ended++;
            });

        return $ended;
    }

    /**
     * Групи людини: сім’ї, клани й спільноти, де вона активний учасник.
     *
     * @return list<array{type: string, id: int, name: string, url: string, avatar_url: string|null}>
     */
    public function groupsOf(User $user): array
    {
        $ids = [
            'family' => FamilyMember::query()->where('user_id', $user->id)->where('status', FamilyMember::STATUS_ACTIVE)->limit(20)->pluck('family_id')->all(),
            'clan' => ClanMember::query()->where('user_id', $user->id)->where('status', ClanMember::STATUS_ACTIVE)->limit(20)->pluck('clan_id')->all(),
            'community' => CommunityMember::query()->where('user_id', $user->id)->where('status', CommunityMember::STATUS_ACTIVE)->limit(40)->pluck('community_id')->all(),
        ];
        $out = [];
        foreach ($ids as $type => $list) {
            foreach ($list as $id) {
                $group = $this->group($type, (int) $id);
                if ($group !== null) {
                    $out[] = $group;
                }
            }
        }

        return $out;
    }

    /**
     * Сповістити учасників групи про нову кімнату (налаштування сповіщень і тихі години — у самому сповіщенні).
     *
     * @param  array{type: string, id: int, name: string, url: string, avatar_url: string|null}  $group
     */
    private function notify(ListenParty $party, User $host, array $group): void
    {
        if (! Cache::add("listen-room-notify:{$group['type']}:{$group['id']}", true, self::NOTIFY_COOLDOWN)) {
            return;
        }
        $ids = match ($group['type']) {
            'family' => FamilyMember::query()->where('family_id', $group['id'])->where('status', FamilyMember::STATUS_ACTIVE)->pluck('user_id'),
            'clan' => ClanMember::query()->where('clan_id', $group['id'])->where('status', ClanMember::STATUS_ACTIVE)->pluck('user_id'),
            default => CommunityMember::query()->where('community_id', $group['id'])->where('status', CommunityMember::STATUS_ACTIVE)->pluck('user_id'),
        };
        $users = User::query()->whereIn('id', $ids->reject(fn ($id) => (int) $id === $host->id)->take(self::NOTIFY_LIMIT)->all())->get();
        rescue(fn () => Notification::send($users, new ListenRoomStarted($host, $party, $group['name'])), report: true);
    }
}
