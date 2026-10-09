<?php

namespace App\Services\Clans;

use App\Models\Clan;
use App\Models\ClanContribution;
use App\Models\ClanEvent;
use App\Models\ClanLog;
use App\Models\ClanMember;
use App\Models\ClanNews;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Game;
use App\Models\User;
use App\Services\ImageStorage;
use App\Services\Messenger;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Клани й гільдії: склад, заявки, ранги й права, новини, заходи, скарбниця, чат і журнал дій.
 */
class ClanService
{
    /** Скільки кланів може заснувати одна людина. */
    public const MAX_OWNED = 5;

    public function __construct(
        private readonly ImageStorage $images,
        private readonly Messenger $messenger,
    ) {}

    public function member(Clan $clan, ?User $user): ?ClanMember
    {
        if (! $user) {
            return null;
        }

        return ClanMember::query()->where('clan_id', $clan->id)->where('user_id', $user->id)->where('status', ClanMember::STATUS_ACTIVE)->first();
    }

    public function can(?ClanMember $member, Clan $clan, string $permission): bool
    {
        if (! $member || $member->status !== ClanMember::STATUS_ACTIVE) {
            return false;
        }

        return $member->user_id === $clan->owner_id || $clan->rankAllows($member->rank, $permission);
    }

    public function authorize(?ClanMember $member, Clan $clan, string $permission): ClanMember
    {
        abort_unless($member !== null && $this->can($member, $clan, $permission), 403, 'Недостатньо прав у клані для цієї дії.');

        return $member;
    }

    /**
     * @return array<string, bool>
     */
    public function abilities(?ClanMember $member, Clan $clan): array
    {
        $can = [];
        foreach (array_keys(Clan::PERMISSIONS) as $permission) {
            $can[$permission] = $this->can($member, $clan, $permission);
        }
        $can['owner'] = $member !== null && $member->user_id === $clan->owner_id;

        return $can;
    }

    /**
     * @param  array{type: string, name: string, tag: string, game_id: int, description?: string|null, features: list<string>, join_mode: string}  $data
     */
    public function create(User $owner, array $data, ?UploadedFile $logo): Clan
    {
        if (Clan::query()->where('owner_id', $owner->id)->count() >= self::MAX_OWNED) {
            throw ValidationException::withMessages(['name' => 'Можна заснувати не більше '.self::MAX_OWNED.' кланів.']);
        }
        abort_unless(Game::query()->published()->whereKey($data['game_id'])->exists(), 422, 'Оберіть гру з каталогу.');

        $clan = DB::transaction(function () use ($owner, $data) {
            $clan = Clan::query()->create([
                'slug' => $this->slug($data['name']),
                'type' => $data['type'],
                'name' => $data['name'],
                'tag' => Str::upper($data['tag']),
                'game_id' => $data['game_id'],
                'owner_id' => $owner->id,
                'description' => $data['description'] ?? null,
                'features' => array_values(array_intersect(array_keys(Clan::FEATURES), $data['features'])),
                'join_mode' => $data['join_mode'],
                'is_recruiting' => $data['join_mode'] !== Clan::JOIN_CLOSED,
            ]);
            ClanMember::query()->create([
                'clan_id' => $clan->id,
                'user_id' => $owner->id,
                'rank' => Clan::LEADER_RANK,
                'status' => ClanMember::STATUS_ACTIVE,
                'joined_at' => now(),
            ]);
            $this->recount($clan);

            return $clan;
        });

        if ($logo) {
            $clan->update(['logo_path' => $this->images->store($logo, 'clans/logos', cover: [512, 512])['path']]);
        }
        $this->log($clan, $owner, 'create', "{$clan->display_name} засновано");
        $this->syncChat($clan);

        return $clan;
    }

    /**
     * @param  list<string>|null  $answers
     */
    public function join(Clan $clan, User $user, ?string $note, ?string $nickname, ?array $answers = null, bool $invited = false): ClanMember
    {
        $existing = ClanMember::query()->where('clan_id', $clan->id)->where('user_id', $user->id)->first();
        if ($existing && in_array($existing->status, [ClanMember::STATUS_ACTIVE, ClanMember::STATUS_PENDING], true)) {
            throw ValidationException::withMessages(['clan' => $existing->status === ClanMember::STATUS_ACTIVE ? 'Ви вже в цьому клані.' : 'Заявку вже надіслано.']);
        }
        if (! $invited && ($clan->join_mode === Clan::JOIN_CLOSED || ! $clan->is_recruiting)) {
            throw ValidationException::withMessages(['clan' => 'Набір у клан зараз закрито.']);
        }

        $open = $invited || $clan->join_mode === Clan::JOIN_OPEN;
        $questions = array_values(array_filter((array) $clan->questions, fn ($question) => is_string($question) && trim($question) !== ''));
        $clean = [];
        if (! $open && $questions !== []) {
            $given = array_values($answers ?? []);
            if (count($given) !== count($questions)) {
                throw ValidationException::withMessages(['answers' => 'Дайте відповідь на кожне питання.']);
            }
            foreach ($given as $answer) {
                $text = trim((string) $answer);
                if ($text === '' || mb_strlen($text) > 300) {
                    throw ValidationException::withMessages(['answers' => 'Відповідь має бути короткою і не порожньою.']);
                }
                $clean[] = $text;
            }
        }
        $member = $existing ?? new ClanMember(['clan_id' => $clan->id, 'user_id' => $user->id]);
        $member->fill([
            'rank' => 1,
            'status' => $open ? ClanMember::STATUS_ACTIVE : ClanMember::STATUS_PENDING,
            'note' => $note,
            'nickname' => $nickname,
            'answers' => $clean === [] ? null : $clean,
            'joined_at' => $open ? now() : null,
        ])->save();

        if ($open) {
            $this->joined($clan, $member, $user);
        }

        return $member;
    }

    public function accept(Clan $clan, ClanMember $actor, ClanMember $member): void
    {
        $this->authorize($actor, $clan, 'members.manage');
        abort_unless($member->clan_id === $clan->id && $member->status === ClanMember::STATUS_PENDING, 404);
        $member->update(['status' => ClanMember::STATUS_ACTIVE, 'joined_at' => now(), 'rank' => 1]);
        $member->load('user');
        if ($member->user) {
            $this->joined($clan, $member, $member->user, $actor);
        }
    }

    public function decline(Clan $clan, ClanMember $actor, ClanMember $member): void
    {
        $this->authorize($actor, $clan, 'members.manage');
        abort_unless($member->clan_id === $clan->id && $member->status === ClanMember::STATUS_PENDING, 404);
        $member->update(['status' => ClanMember::STATUS_LEFT]);
        $this->log($clan, $actor->user, 'decline', 'Заявку '.($member->user->name ?? '').' відхилено');
    }

    public function kick(Clan $clan, ClanMember $actor, ClanMember $member): void
    {
        $this->authorize($actor, $clan, 'members.manage');
        $this->assertOutranks($clan, $actor, $member);
        $member->update(['status' => ClanMember::STATUS_KICKED]);
        $this->left($clan, $member, $actor, 'виключено');
    }

    public function leave(Clan $clan, ClanMember $member): void
    {
        if ($member->user_id === $clan->owner_id) {
            throw ValidationException::withMessages(['clan' => 'Засновник не може вийти — спершу передайте лідерство.']);
        }
        $member->update(['status' => ClanMember::STATUS_LEFT]);
        $this->left($clan, $member, null, 'вийшов(-ла)');
    }

    public function setRank(Clan $clan, ClanMember $actor, ClanMember $member, int $rank): void
    {
        $this->authorize($actor, $clan, 'members.manage');
        $this->assertOutranks($clan, $actor, $member);
        $isOwner = $actor->user_id === $clan->owner_id;
        if ($rank < 1 || $rank >= Clan::LEADER_RANK || (! $isOwner && $rank >= $actor->rank)) {
            throw ValidationException::withMessages(['rank' => 'Можна призначити лише ранг, нижчий за ваш.']);
        }
        $member->update(['rank' => $rank]);
        $this->log($clan, $actor->user, 'rank', ($member->user->name ?? '').' → '.$clan->rankTitle($rank));
        $this->syncChat($clan);
    }

    public function transfer(Clan $clan, ClanMember $actor, ClanMember $member): void
    {
        abort_unless($actor->user_id === $clan->owner_id, 403, 'Передати лідерство може лише засновник.');
        abort_unless($member->clan_id === $clan->id && $member->status === ClanMember::STATUS_ACTIVE && $member->id !== $actor->id, 404);
        DB::transaction(function () use ($clan, $actor, $member) {
            $clan->update(['owner_id' => $member->user_id]);
            $member->update(['rank' => Clan::LEADER_RANK]);
            $actor->update(['rank' => Clan::LEADER_RANK - 1]);
        });
        $this->log($clan, $actor->user, 'transfer', 'Лідерство передано '.($member->user->name ?? ''));
        $this->syncChat($clan);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Clan $clan, ClanMember $actor, array $data, ?UploadedFile $logo): void
    {
        $this->authorize($actor, $clan, 'settings.manage');
        $isOwner = $actor->user_id === $clan->owner_id;

        $fill = array_intersect_key($data, array_flip(['name', 'tag', 'description', 'rules', 'join_mode', 'is_recruiting', 'currency']));
        if (isset($data['questions']) && is_array($data['questions'])) {
            $fill['questions'] = array_values(array_filter(array_map(
                fn ($question) => Str::limit(trim((string) $question), 80, ''),
                $data['questions'],
            ), fn (string $question) => $question !== ''));
        }
        if (isset($fill['tag'])) {
            $fill['tag'] = Str::upper((string) $fill['tag']);
        }
        if (isset($data['features']) && is_array($data['features'])) {
            $fill['features'] = array_values(array_intersect(array_keys(Clan::FEATURES), $data['features']));
        }
        if (isset($data['rank_titles']) && is_array($data['rank_titles'])) {
            $titles = [];
            foreach (range(1, Clan::LEADER_RANK) as $rank) {
                $value = trim((string) ($data['rank_titles'][$rank] ?? $data['rank_titles'][$rank - 1] ?? ''));
                $titles[$rank] = $value !== '' ? Str::limit($value, 24, '') : Clan::RANKS[$clan->type][$rank];
            }
            $fill['rank_titles'] = $titles;
        }
        if (isset($data['permissions']) && is_array($data['permissions'])) {
            $current = $clan->permissionMatrix();
            $matrix = [];
            foreach (array_keys(Clan::PERMISSIONS) as $permission) {
                $ranks = array_values(array_unique(array_map('intval', (array) ($data['permissions'][$permission] ?? []))));
                $ranks = array_values(array_filter($ranks, fn (int $r) => $r >= 1 && $r < Clan::LEADER_RANK));
                // Не можна видати право рангу, вищому за власний.
                if (! $isOwner) {
                    $ranks = array_values(array_filter($ranks, fn (int $r) => $r < $actor->rank || in_array($r, $current[$permission], true)));
                }
                sort($ranks);
                $matrix[$permission] = $ranks;
            }
            $fill['permissions'] = $matrix;
        }

        $clan->update($fill);
        if ($logo) {
            $old = $clan->logo_path;
            $clan->update(['logo_path' => $this->images->store($logo, 'clans/logos', cover: [512, 512])['path']]);
            $this->images->delete($old);
        }
        $this->log($clan, $actor->user, 'settings', 'Налаштування оновлено');
        $this->syncChat($clan);
    }

    public function postNews(Clan $clan, ClanMember $actor, string $title, string $body, bool $pinned): ClanNews
    {
        $this->authorize($actor, $clan, 'news.post');
        $news = ClanNews::query()->create(['clan_id' => $clan->id, 'user_id' => $actor->user_id, 'title' => $title, 'body' => $body, 'is_pinned' => $pinned]);
        $this->announce($clan, "📰 {$title}");

        return $news;
    }

    public function deleteNews(Clan $clan, ClanMember $actor, ClanNews $news): void
    {
        abort_unless($news->clan_id === $clan->id, 404);
        abort_unless($news->user_id === $actor->user_id || $this->can($actor, $clan, 'news.post'), 403);
        $news->delete();
    }

    public function createEvent(Clan $clan, ClanMember $actor, string $title, ?string $description, Carbon $startsAt, ?string $repeat = null): ClanEvent
    {
        $this->authorize($actor, $clan, 'events.manage');
        $event = ClanEvent::query()->create([
            'clan_id' => $clan->id,
            'user_id' => $actor->user_id,
            'title' => $title,
            'description' => $description,
            'starts_at' => $startsAt,
            'repeat' => $repeat,
        ]);
        $this->announce($clan, "📅 Новий захід: {$title} — ".$startsAt->timezone('Europe/Kyiv')->format('d.m H:i'));

        return $event;
    }

    public function rsvp(Clan $clan, ClanMember $member, ClanEvent $event): bool
    {
        abort_unless($event->clan_id === $clan->id, 404);
        $going = $event->going()->where('users.id', $member->user_id)->exists();
        $going ? $event->going()->detach($member->user_id) : $event->going()->attach($member->user_id);

        return ! $going;
    }

    /**
     * @param  array{teams: list<string>, semi: list<array{0: int|null, 1: int|null}>, final: array{0: int|null, 1: int|null}}  $bracket
     */
    public function saveBracket(Clan $clan, ClanMember $actor, ClanEvent $event, array $bracket): void
    {
        abort_unless($event->clan_id === $clan->id, 404);
        $this->authorize($actor, $clan, 'events.manage');
        $event->forceFill(['bracket' => $bracket])->save();
    }

    public function deleteEvent(Clan $clan, ClanMember $actor, ClanEvent $event): void
    {
        abort_unless($event->clan_id === $clan->id, 404);
        $this->authorize($actor, $clan, 'events.manage');
        $event->delete();
    }

    public function contribute(Clan $clan, ClanMember $member, int $amount, ?string $comment): ClanContribution
    {
        return ClanContribution::query()->create([
            'clan_id' => $clan->id,
            'user_id' => $member->user_id,
            'amount' => $amount,
            'comment' => $comment,
            'status' => ClanContribution::STATUS_PENDING,
        ]);
    }

    public function review(Clan $clan, ClanMember $actor, ClanContribution $contribution, bool $approve): void
    {
        $this->authorize($actor, $clan, 'treasury.manage');
        abort_unless($contribution->clan_id === $clan->id && $contribution->status === ClanContribution::STATUS_PENDING, 404);

        DB::transaction(function () use ($clan, $actor, $contribution, $approve) {
            $contribution->update(['status' => $approve ? ClanContribution::STATUS_APPROVED : ClanContribution::STATUS_REJECTED, 'reviewed_by' => $actor->user_id]);
            if ($approve) {
                Clan::query()->whereKey($clan->id)->increment('treasury', $contribution->amount);
                ClanMember::query()->where('clan_id', $clan->id)->where('user_id', $contribution->user_id)->increment('contributed', $contribution->amount);
            }
        });
        $this->log($clan, $actor->user, $approve ? 'contribution' : 'contribution_rejected', ($approve ? 'Внесок ' : 'Відхилено внесок ').number_format($contribution->amount, 0, ',', ' ')." {$clan->currency}");
    }

    public function spend(Clan $clan, ClanMember $actor, int $amount, string $comment): void
    {
        $this->authorize($actor, $clan, 'treasury.manage');
        if ($amount > $clan->fresh()?->treasury) {
            throw ValidationException::withMessages(['amount' => 'У скарбниці недостатньо коштів.']);
        }
        DB::transaction(function () use ($clan, $actor, $amount, $comment) {
            ClanContribution::query()->create([
                'clan_id' => $clan->id, 'user_id' => $actor->user_id, 'amount' => -$amount,
                'comment' => $comment, 'status' => ClanContribution::STATUS_APPROVED, 'reviewed_by' => $actor->user_id,
            ]);
            Clan::query()->whereKey($clan->id)->decrement('treasury', $amount);
        });
        $this->log($clan, $actor->user, 'spend', 'Витрата '.number_format($amount, 0, ',', ' ')." {$clan->currency}: {$comment}");
    }

    /**
     * Рейтинг: внески й участь у заходах.
     *
     * @return list<array<string, mixed>>
     */
    public function rating(Clan $clan): array
    {
        $attended = DB::table('clan_event_rsvps')
            ->join('clan_events', 'clan_events.id', '=', 'clan_event_rsvps.clan_event_id')
            ->where('clan_events.clan_id', $clan->id)
            ->where('clan_events.starts_at', '<=', now())
            ->groupBy('clan_event_rsvps.user_id')
            ->pluck(DB::raw('count(*)'), 'clan_event_rsvps.user_id');

        return array_values($clan->activeMembers()->with('user')->get()
            ->map(fn (ClanMember $m) => [...$m->toCard($clan), 'events' => (int) ($attended[$m->user_id] ?? 0)])
            ->sortByDesc(fn (array $r) => [$r['contributed'], $r['events']])
            ->values()
            ->all());
    }

    /** Чат клану — групова бесіда, склад якої відповідає активним учасникам. */
    public function syncChat(Clan $clan): ?Conversation
    {
        $clan->refresh();
        if (! $clan->hasFeature('chat')) {
            return null;
        }
        $conversation = $clan->conversation_id ? Conversation::query()->find($clan->conversation_id) : null;
        $title = Str::limit("[{$clan->tag}] {$clan->name}", 80, '');
        if (! $conversation) {
            $conversation = Conversation::query()->create(['type' => Conversation::TYPE_GROUP, 'title' => $title, 'owner_id' => $clan->owner_id]);
            $clan->forceFill(['conversation_id' => $conversation->id])->saveQuietly();
            $this->messenger->announce($conversation, "Чат {$clan->display_name} відкрито. Тут лише учасники клану.");
        } elseif ($conversation->title !== $title) {
            $conversation->update(['title' => $title]);
        }

        $members = $clan->activeMembers()->get(['user_id', 'rank']);
        DB::transaction(function () use ($clan, $conversation, $members) {
            foreach ($members as $member) {
                $row = ConversationParticipant::query()->firstOrNew(['conversation_id' => $conversation->id, 'user_id' => $member->user_id]);
                if (! $row->exists || $row->left_at !== null) {
                    $row->joined_at = Carbon::now();
                    $row->last_read_message_id = $conversation->last_message_id;
                }
                $row->left_at = null;
                $row->role = match (true) {
                    $member->user_id === $clan->owner_id => ConversationParticipant::ROLE_OWNER,
                    $member->rank >= Clan::LEADER_RANK - 1 => ConversationParticipant::ROLE_ADMIN,
                    default => ConversationParticipant::ROLE_MEMBER,
                };
                $row->save();
            }
            ConversationParticipant::query()->where('conversation_id', $conversation->id)->whereNull('left_at')
                ->whereNotIn('user_id', $members->pluck('user_id')->all() ?: [0])
                ->update(['left_at' => now(), 'role' => ConversationParticipant::ROLE_MEMBER]);
        });

        return $conversation;
    }

    public function log(Clan $clan, ?User $actor, string $action, string $text): void
    {
        ClanLog::query()->create(['clan_id' => $clan->id, 'actor_id' => $actor?->id, 'action' => $action, 'text' => Str::limit($text, 300, ''), 'created_at' => now()]);
    }

    private function joined(Clan $clan, ClanMember $member, User $user, ?ClanMember $actor = null): void
    {
        $this->recount($clan);
        $this->log($clan, $actor === null ? $user : $actor->user, 'join', "{$user->name} приєднався(-лась)");
        $this->syncChat($clan);
        $this->announce($clan, "{$user->name} приєднався(-лась) до клану. Ласкаво просимо! 🎉");
    }

    private function left(Clan $clan, ClanMember $member, ?ClanMember $actor, string $how): void
    {
        $this->recount($clan);
        $this->log($clan, $actor === null ? $member->user : $actor->user, 'leave', ($member->user->name ?? '')." {$how}");
        $this->syncChat($clan);
    }

    private function assertOutranks(Clan $clan, ClanMember $actor, ClanMember $member): void
    {
        abort_unless($member->clan_id === $clan->id && $member->status === ClanMember::STATUS_ACTIVE, 404);
        $allowed = $member->user_id !== $clan->owner_id
            && $member->id !== $actor->id
            && ($actor->user_id === $clan->owner_id || $actor->rank > $member->rank);
        abort_unless($allowed, 403, 'Можна керувати лише учасниками нижчого рангу.');
    }

    private function announce(Clan $clan, string $text): void
    {
        $conversation = $clan->hasFeature('chat') && $clan->conversation_id ? Conversation::query()->find($clan->conversation_id) : null;
        if ($conversation) {
            rescue(fn () => $this->messenger->announce($conversation, $text, ['clan' => true]), report: false);
        }
    }

    private function recount(Clan $clan): void
    {
        $clan->forceFill(['members_count' => $clan->activeMembers()->count()])->save();
    }

    private function slug(string $name): string
    {
        $base = Str::limit(Str::slug($name) ?: 'clan', 60, '');
        $slug = $base;
        $n = 2;
        while (Clan::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$n++;
        }

        return $slug;
    }
}
