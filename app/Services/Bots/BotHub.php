<?php

namespace App\Services\Bots;

use App\Models\BotLink;
use App\Models\BotLinkCode;
use App\Models\Clan;
use App\Models\ClanEvent;
use App\Models\ClanMember;
use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\DiscordRoleGrant;
use App\Models\Family;
use App\Models\FamilyEvent;
use App\Models\FamilyMember;
use App\Models\ListenParty;
use App\Models\Post;
use App\Models\User;
use App\Services\Clans\ClanService;
use App\Services\Families\FamilyEvents;
use App\Services\Families\FamilyGate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Офіційні боти GameCon у Telegram і Discord: прив’язка груп, публікація карток
 * (події, нагадування, пости), обробка кнопок і ролі Discord за складом групи.
 */
class BotHub
{
    private const CODE_MINUTES = 30;

    /** Скільки змін ролей за прохід (решта — наступного разу, щоб не впертися в ліміти Discord). */
    private const ROLE_BATCH = 200;

    public function __construct(
        private readonly TelegramApi $telegram,
        private readonly DiscordApi $discord,
        private readonly BotCards $cards,
        private readonly FamilyGate $gate,
        private readonly ClanService $clans,
    ) {}

    public function owner(string $type, int $id): Family|Clan|Community
    {
        return match ($type) {
            'family', 'f' => Family::query()->findOrFail($id),
            'clan', 'c' => Clan::query()->findOrFail($id),
            'community', 'm' => Community::query()->findOrFail($id),
            default => abort(404),
        };
    }

    public static function type(Family|Clan|Community $owner): string
    {
        return match (true) {
            $owner instanceof Family => 'family',
            $owner instanceof Clan => 'clan',
            default => 'community',
        };
    }

    public function canManage(?User $user, Family|Clan|Community $owner): bool
    {
        if (! $user) {
            return false;
        }
        if ($user->isAdmin()) {
            return true;
        }

        return match (true) {
            $owner instanceof Family => $this->gate->can($this->gate->member($owner, $user), $owner, 'settings.manage'),
            $owner instanceof Clan => $this->clans->can($this->clans->member($owner, $user), $owner, 'settings.manage'),
            default => (bool) $owner->membershipFor($user)?->isManager(),
        };
    }

    /** Сторінка налаштувань групи — сюди повертаємо після прив’язки. */
    public function settingsUrl(Family|Clan|Community $owner): string
    {
        return match (true) {
            $owner instanceof Family => '/f/'.$owner->slug.'/settings',
            $owner instanceof Clan => '/clans/'.$owner->slug.'?tab=settings',
            default => '/c/'.$owner->slug.'/settings',
        };
    }

    public function link(Family|Clan|Community $owner, string $platform): ?BotLink
    {
        return BotLink::query()->where('platform', $platform)->where('owner_type', self::type($owner))->where('owner_id', $owner->id)->first();
    }

    // ── Коди прив’язки ─────────────────────────────────────────────

    public function issueCode(User $user, string $platform, string $purpose, Family|Clan|Community|null $owner = null): string
    {
        $code = Str::random(32);
        BotLinkCode::query()->create([
            'code_hash' => hash('sha256', $code),
            'platform' => $platform,
            'purpose' => $purpose,
            'owner_type' => $owner ? self::type($owner) : null,
            'owner_id' => $owner?->id,
            'user_id' => $user->id,
            'expires_at' => now()->addMinutes(self::CODE_MINUTES),
        ]);

        return $code;
    }

    public function consume(string $code, string $platform, string $purpose): ?BotLinkCode
    {
        $row = BotLinkCode::query()->where('code_hash', hash('sha256', $code))->first();
        if (! $row instanceof BotLinkCode || $row->platform !== $platform || $row->purpose !== $purpose || $row->used_at !== null || $row->expires_at->isPast()) {
            return null;
        }
        $row->update(['used_at' => now()]);

        return $row;
    }

    /** Група Telegram, куди бота додали за посиланням startgroup. */
    public function linkTelegramGroup(string $code, string $chatId, string $title): ?BotLink
    {
        $row = $this->consume($code, BotLink::TELEGRAM, 'group');
        if ($row === null || $row->owner_type === null || $row->owner_id === null) {
            return null;
        }
        $owner = $this->owner($row->owner_type, $row->owner_id);
        if (! $this->canManage(User::query()->find($row->user_id), $owner)) {
            return null;
        }

        return BotLink::query()->updateOrCreate(
            ['platform' => BotLink::TELEGRAM, 'owner_type' => $row->owner_type, 'owner_id' => $row->owner_id],
            ['chat_id' => $chatId, 'title' => Str::limit($title, 120, ''), 'linked_by' => $row->user_id],
        );
    }

    /** Особистий Telegram людини: щоб кнопки «Піду» знали, хто натиснув. */
    public function linkTelegramAccount(string $code, string $telegramId, ?string $username): ?User
    {
        $row = $this->consume($code, BotLink::TELEGRAM, 'account');
        $user = $row ? User::query()->find($row->user_id) : null;
        if (! $user instanceof User) {
            return null;
        }
        User::query()->where('telegram_id', $telegramId)->whereKeyNot($user->id)->update(['telegram_id' => null, 'telegram_username' => null]);
        $user->forceFill(['telegram_id' => $telegramId, 'telegram_username' => $username])->save();

        return $user;
    }

    /**
     * Сервер Discord, куди бота додали; канал обирають потім на сайті.
     *
     * @param  array{id: string, name: string}  $guild
     */
    public function linkDiscordGuild(BotLinkCode $row, array $guild): BotLink
    {
        return BotLink::query()->updateOrCreate(
            ['platform' => BotLink::DISCORD, 'owner_type' => (string) $row->owner_type, 'owner_id' => (int) $row->owner_id],
            ['guild_id' => $guild['id'], 'title' => Str::limit($guild['name'], 120, ''), 'chat_id' => null, 'linked_by' => $row->user_id],
        );
    }

    public function unlink(BotLink $link): void
    {
        if ($link->platform === BotLink::TELEGRAM && $link->chat_id) {
            $this->telegram->call('sendMessage', ['chat_id' => $link->chat_id, 'text' => '👋 Бота GameCon відключено від цієї групи.']);
            $this->telegram->call('leaveChat', ['chat_id' => $link->chat_id]);
        }
        $link->delete();
    }

    // ── Публікація ────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>  $card
     */
    public function send(BotLink $link, array $card): bool
    {
        if ($link->chat_id === null) {
            return false;
        }

        return $link->platform === BotLink::TELEGRAM
            ? $this->telegram->call('sendMessage', ['chat_id' => $link->chat_id, ...BotRender::telegram($card)]) !== null
            : $this->discord->send($link->chat_id, BotRender::discord($card)) !== null;
    }

    public function panel(BotLink $link): bool
    {
        return $this->send($link, $this->cards->panel($this->owner($link->owner_type, $link->owner_id)));
    }

    /** Нова подія сім’ї чи клану — картка з кнопками в усі прив’язані чати. */
    public function eventCreated(FamilyEvent|ClanEvent $event): void
    {
        $owner = $event instanceof FamilyEvent ? Family::query()->find($event->family_id) : Clan::query()->find($event->clan_id);
        if ($owner === null) {
            return;
        }
        foreach ($this->links($owner) as $link) {
            if ($link->post_events) {
                $this->send($link, $this->cards->event($owner, $event, withBack: false));
            }
        }
    }

    public function eventReminder(FamilyEvent|ClanEvent $event): void
    {
        $owner = $event instanceof FamilyEvent ? Family::query()->find($event->family_id) : Clan::query()->find($event->clan_id);
        if ($owner === null) {
            return;
        }
        foreach ($this->links($owner) as $link) {
            if ($link->post_reminders) {
                $this->send($link, $this->cards->reminder($owner, $event));
            }
        }
    }

    public function postPublished(Community $community, Post $post): void
    {
        foreach ($this->links($community) as $link) {
            if ($link->post_posts) {
                $this->send($link, $this->cards->post($community, $post));
            }
        }
    }

    /** У групі відкрили кімнату «Слухати разом» — оголошення в прив’язані чати. */
    public function listenRoomStarted(string $type, int $id, ListenParty $party, User $host): void
    {
        $owner = rescue(fn () => $this->owner($type, $id), null, false);
        if ($owner === null) {
            return;
        }
        foreach ($this->links($owner) as $link) {
            if ($link->post_music) {
                $this->send($link, $this->cards->listenRoom($owner, $party, $host));
            }
        }
    }

    /**
     * @return list<BotLink>
     */
    private function links(Family|Clan|Community $owner): array
    {
        return array_values(BotLink::query()->where('owner_type', self::type($owner))->where('owner_id', $owner->id)->whereNotNull('chat_id')->get()->all());
    }

    // ── Кнопки ────────────────────────────────────────────────────

    /**
     * Обробка натискання. Повертає картку для показу (або null), коротку відповідь-тост
     * і чи це особисте (Discord покаже лише тому, хто натиснув).
     *
     * @return array{card: array<string, mixed>|null, toast: string|null, personal: bool}
     */
    public function press(string $platform, string $data, ?User $user): array
    {
        $parts = explode(':', $data);
        [$action, $type, $id] = [$parts[0], $parts[1] ?? '', (int) ($parts[2] ?? 0)];
        try {
            $owner = $this->owner($type, $id);
        } catch (Throwable) {
            return ['card' => null, 'toast' => 'Групу не знайдено.', 'personal' => true];
        }

        return match ($action) {
            'home' => ['card' => $this->cards->panel($owner), 'toast' => null, 'personal' => true],
            'ev' => ['card' => $this->cards->events($owner), 'toast' => null, 'personal' => true],
            'mb' => ['card' => $this->cards->members($owner), 'toast' => null, 'personal' => true],
            'ps' => ['card' => $owner instanceof Community ? $this->cards->posts($owner) : null, 'toast' => null, 'personal' => true],
            'me' => ['card' => $this->cards->me($owner, $user, $platform), 'toast' => null, 'personal' => true],
            'mu' => ['card' => $this->cards->music($owner), 'toast' => null, 'personal' => true],
            'e' => $this->showEvent($owner, (int) ($parts[3] ?? 0)),
            'r' => $this->rsvp($owner, (int) ($parts[3] ?? 0), ($parts[4] ?? '1') === '1', $user, $platform),
            default => ['card' => null, 'toast' => null, 'personal' => true],
        };
    }

    /**
     * @return array{card: array<string, mixed>|null, toast: string|null, personal: bool}
     */
    private function showEvent(Family|Clan|Community $owner, int $eventId): array
    {
        $event = $this->findEvent($owner, $eventId);

        return $event && ! $owner instanceof Community
            ? ['card' => $this->cards->event($owner, $event), 'toast' => null, 'personal' => true]
            : ['card' => null, 'toast' => 'Подію не знайдено.', 'personal' => true];
    }

    /**
     * «Піду» / «Не піду»: оновлюємо картку (лічильник бачать усі) і відповідаємо людині.
     *
     * @return array{card: array<string, mixed>|null, toast: string|null, personal: bool}
     */
    private function rsvp(Family|Clan|Community $owner, int $eventId, bool $going, ?User $user, string $platform): array
    {
        $event = $this->findEvent($owner, $eventId);
        if ($event === null || $owner instanceof Community) {
            return ['card' => null, 'toast' => 'Подію не знайдено.', 'personal' => true];
        }
        if ($user === null) {
            return ['card' => $this->cards->unlinked($platform), 'toast' => 'Спершу прив’яжіть акаунт GameCon.', 'personal' => true];
        }

        try {
            if ($owner instanceof Family && $event instanceof FamilyEvent) {
                $member = $this->gate->member($owner, $user);
                if (! $member instanceof FamilyMember || ! $member->isActive()) {
                    return ['card' => null, 'toast' => 'Ви не в складі цієї сім’ї.', 'personal' => true];
                }
                $status = app(FamilyEvents::class)->rsvp($owner, $event, $member, $going);
                $toast = match ($status) {
                    'waitlist' => '⏳ Місць немає — ви в черзі.',
                    'declined' => '❌ Записали: не підете.',
                    default => '✅ Записали: ви йдете!',
                };
            } elseif ($owner instanceof Clan && $event instanceof ClanEvent) {
                $member = $this->clans->member($owner, $user);
                if (! $member instanceof ClanMember || $member->status !== ClanMember::STATUS_ACTIVE) {
                    return ['card' => null, 'toast' => 'Ви не в складі цього клану.', 'personal' => true];
                }
                $isGoing = $event->going()->where('users.id', $user->id)->exists();
                if ($isGoing !== $going) {
                    $this->clans->rsvp($owner, $member, $event);
                }
                $toast = $going ? '✅ Записали: ви йдете!' : '❌ Записали: не підете.';
            } else {
                return ['card' => null, 'toast' => null, 'personal' => true];
            }
        } catch (ValidationException $e) {
            return ['card' => null, 'toast' => (string) collect($e->errors())->flatten()->first(), 'personal' => true];
        }

        return ['card' => $this->cards->event($owner, $event->fresh() ?? $event, withBack: false), 'toast' => $toast, 'personal' => false];
    }

    private function findEvent(Family|Clan|Community $owner, int $id): FamilyEvent|ClanEvent|null
    {
        return match (true) {
            $owner instanceof Family => FamilyEvent::query()->where('family_id', $owner->id)->find($id),
            $owner instanceof Clan => ClanEvent::query()->where('clan_id', $owner->id)->find($id),
            default => null,
        };
    }

    // ── Ролі Discord ──────────────────────────────────────────────

    /**
     * @return list<array{discord_id: string|null, leader: bool}>
     */
    public function members(Family|Clan|Community $owner): array
    {
        $rows = match (true) {
            $owner instanceof Family => $owner->activeMembers()->with('user:id,discord_id')->get()
                ->map(fn (FamilyMember $m) => ['discord_id' => $m->user->discord_id, 'leader' => $m->rank >= Family::LEADER_RANK]),
            $owner instanceof Clan => $owner->activeMembers()->with('user:id,discord_id')->get()
                ->map(fn (ClanMember $m) => ['discord_id' => $m->user?->discord_id, 'leader' => $m->rank >= Clan::LEADER_RANK]),
            default => $owner->activeMembers()->with('user:id,discord_id')->get()
                ->map(fn (CommunityMember $m) => ['discord_id' => $m->user?->discord_id, 'leader' => $m->isManager()]),
        };

        return array_values($rows->all());
    }

    /**
     * Видає ролі учасникам із прив’язаним Discord і забирає ті, що GameCon видав людям, які вийшли.
     *
     * @return array{added: int, removed: int, skipped: int}
     */
    public function syncRoles(BotLink $link): array
    {
        $result = ['added' => 0, 'removed' => 0, 'skipped' => 0];
        if (! $link->hasRoles() || $this->discord->token() === null) {
            return $result;
        }
        $owner = $this->owner($link->owner_type, $link->owner_id);
        $guild = (string) $link->guild_id;

        $want = [];
        foreach ($this->members($owner) as $member) {
            if ($member['discord_id'] === null) {
                continue;
            }
            if ($link->member_role_id) {
                $want[$member['discord_id'].':'.$link->member_role_id] = [$member['discord_id'], $link->member_role_id];
            }
            if ($member['leader'] && $link->leader_role_id) {
                $want[$member['discord_id'].':'.$link->leader_role_id] = [$member['discord_id'], $link->leader_role_id];
            }
        }
        $have = DiscordRoleGrant::query()->where('bot_link_id', $link->id)->get()
            ->keyBy(fn (DiscordRoleGrant $g) => $g->discord_user_id.':'.$g->role_id);

        $budget = self::ROLE_BATCH;
        $error = null;
        foreach ($want as $key => [$userId, $roleId]) {
            if ($have->has($key) || $budget-- <= 0) {
                continue;
            }
            $status = $this->discord->setRole('put', $guild, $userId, $roleId);
            if ($status === 204) {
                DiscordRoleGrant::query()->create(['bot_link_id' => $link->id, 'discord_user_id' => $userId, 'role_id' => $roleId]);
                $result['added']++;
            } elseif ($status === 404) {
                $result['skipped']++; // людини немає на цьому сервері Discord
            } else {
                $error = $this->explain($status);
                break;
            }
        }
        if ($error === null) {
            foreach ($have as $key => $grant) {
                if (isset($want[$key]) || $budget-- <= 0) {
                    continue;
                }
                $status = $this->discord->setRole('delete', $guild, $grant->discord_user_id, $grant->role_id);
                if (in_array($status, [204, 404], true)) {
                    $grant->delete();
                    $result['removed']++;
                } else {
                    $error = $this->explain($status);
                    break;
                }
            }
        }
        $link->forceFill(['roles_synced_at' => now(), 'roles_error' => $error])->save();

        return $result;
    }

    private function explain(int $status): string
    {
        return match ($status) {
            401 => 'Токен бота недійсний — перевірте його в адмінці.',
            403 => 'Боту бракує права «Керувати ролями», або його роль нижча за ролі, які він видає.',
            429 => 'Discord просить зачекати — продовжимо за годину.',
            0 => 'Discord не відповідає.',
            default => "Discord відповів кодом {$status}.",
        };
    }

    // ── Стан для сторінки налаштувань ─────────────────────────────

    /**
     * @return array<string, mixed>
     */
    public function state(Family|Clan|Community $owner): array
    {
        $tg = $this->link($owner, BotLink::TELEGRAM);
        $dc = $this->link($owner, BotLink::DISCORD);
        $members = $this->members($owner);
        $flags = fn (?BotLink $l) => $l ? ['post_events' => $l->post_events, 'post_reminders' => $l->post_reminders, 'post_posts' => $l->post_posts, 'post_music' => $l->post_music] : null;

        return [
            'owner' => ['type' => self::type($owner), 'id' => $owner->id],
            'has_events' => ! $owner instanceof Community,
            'telegram' => [
                'configured' => $this->telegram->configured(),
                'bot' => $this->telegram->username(),
                'link' => $tg ? ['id' => $tg->id, 'title' => $tg->title, ...$flags($tg)] : null,
            ],
            'discord' => [
                'configured' => $this->discord->configured(),
                'buttons' => $this->discord->publicKey() !== null,
                'link' => $dc ? [
                    'id' => $dc->id,
                    'title' => $dc->title,
                    'channel_id' => $dc->chat_id,
                    'channels' => $dc->guild_id ? $this->discord->channels($dc->guild_id) : [],
                    'roles' => $dc->guild_id ? $this->discord->roles($dc->guild_id) : [],
                    'member_role_id' => $dc->member_role_id,
                    'leader_role_id' => $dc->leader_role_id,
                    'roles_synced_at' => $dc->roles_synced_at?->toIso8601String(),
                    'roles_error' => $dc->roles_error,
                    ...$flags($dc),
                ] : null,
                'linked' => count(array_filter($members, fn (array $m) => $m['discord_id'] !== null)),
                'members' => count($members),
            ],
        ];
    }
}
