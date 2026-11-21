<?php

namespace App\Services;

use App\Models\CommunityMember;
use App\Models\Friendship;
use App\Models\User;
use App\Notifications\AccountNotice;
use App\Support\TeenMode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Батьківський контроль (№227). Дорослий запрошує підлітка за ніком, підліток погоджується.
 * Правила: нічна пауза (сайт і застосунок показують «Час відпочити») і заявки в друзі лише
 * від друзів друзів. Батьки бачать загальну картину (друзі, спільноти), але не листування.
 * Підліток до 18 сам зв’язок не розриває; дорослий у підлітковому режимі — може.
 */
class ParentalControl
{
    public const INVITED = 'invited';

    public const ACTIVE = 'active';

    /** Не більше двох батьків на підлітка. */
    public const MAX_PARENTS = 2;

    public const TIMEZONE = 'Europe/Kyiv';

    public function __construct(private readonly FriendshipService $friends) {}

    public function invite(User $parent, User $teen): void
    {
        if ($parent->is($teen)) {
            throw ValidationException::withMessages(['username' => 'Себе запросити не можна.']);
        }
        if (TeenMode::locked($parent)) {
            throw ValidationException::withMessages(['username' => 'Батьківський контроль вмикає дорослий.']);
        }
        if (! TeenMode::on($teen)) {
            throw ValidationException::withMessages(['username' => 'Контроль діє для акаунтів у підлітковому режимі.']);
        }
        if (DB::table('parent_links')->where('teen_id', $teen->id)->count() >= self::MAX_PARENTS) {
            throw ValidationException::withMessages(['username' => 'У цього акаунта вже є двоє батьків.']);
        }
        DB::table('parent_links')->insertOrIgnore([
            'parent_id' => $parent->id, 'teen_id' => $teen->id, 'status' => self::INVITED,
            'rules' => json_encode(['night_from' => '23:00', 'night_to' => '07:00', 'friends_of_friends' => true]),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $teen->notify(new AccountNotice('parental_invite', $parent, 'пропонує батьківський контроль', 'Погодитися чи відхилити — у «Налаштування → Батьківський контроль».', '/settings/parental'));
    }

    public function accept(User $teen, int $linkId): void
    {
        $updated = DB::table('parent_links')->where('id', $linkId)->where('teen_id', $teen->id)->where('status', self::INVITED)
            ->update(['status' => self::ACTIVE, 'updated_at' => now()]);
        if ($updated === 0) {
            throw ValidationException::withMessages(['link' => 'Запрошення не знайдено.']);
        }
    }

    /** Розірвати чи відхилити: батьки — завжди; підліток до 18 — лише ще не прийняте запрошення. */
    public function remove(User $actor, int $linkId): void
    {
        $link = DB::table('parent_links')->where('id', $linkId)
            ->where(fn ($q) => $q->where('parent_id', $actor->id)->orWhere('teen_id', $actor->id))->first()
            ?? throw ValidationException::withMessages(['link' => 'Не знайдено.']);
        $teenSide = (int) $link->teen_id === $actor->id;
        if ($teenSide && $link->status === self::ACTIVE && TeenMode::locked($actor)) {
            throw ValidationException::withMessages(['link' => 'До 18 років вимкнути контроль можуть лише батьки.']);
        }
        DB::table('parent_links')->where('id', $linkId)->delete();
    }

    /**
     * @param  array{night_from?: string|null, night_to?: string|null, friends_of_friends?: bool}  $rules
     */
    public function update(User $parent, int $linkId, array $rules): void
    {
        $link = DB::table('parent_links')->where('id', $linkId)->where('parent_id', $parent->id)->first()
            ?? throw ValidationException::withMessages(['link' => 'Не знайдено.']);
        $current = (array) json_decode((string) $link->rules, true);
        DB::table('parent_links')->where('id', $linkId)->update(['rules' => json_encode([...$current, ...$rules]), 'updated_at' => now()]);
    }

    /**
     * Чинні правила підлітка (з усіх активних зв’язків: діє суворіше).
     *
     * @return array{night_from: string|null, night_to: string|null, friends_of_friends: bool}|null
     */
    public function rulesFor(User $teen): ?array
    {
        $links = DB::table('parent_links')->where('teen_id', $teen->id)->where('status', self::ACTIVE)->get(['rules']);
        if ($links->isEmpty()) {
            return null;
        }
        $out = ['night_from' => null, 'night_to' => null, 'friends_of_friends' => false];
        foreach ($links as $link) {
            $rules = (array) json_decode((string) $link->rules, true);
            if (is_string($rules['night_from'] ?? null) && is_string($rules['night_to'] ?? null) && $out['night_from'] === null) {
                $out['night_from'] = $rules['night_from'];
                $out['night_to'] = $rules['night_to'];
            }
            $out['friends_of_friends'] = $out['friends_of_friends'] || (bool) ($rules['friends_of_friends'] ?? false);
        }

        return $out;
    }

    /** Зараз нічна пауза? (вікно може переходити через північ). */
    public function resting(User $teen, ?Carbon $at = null): bool
    {
        $rules = $this->rulesFor($teen);
        if ($rules === null || $rules['night_from'] === null || $rules['night_to'] === null) {
            return false;
        }
        $now = ($at ?? now())->copy()->setTimezone(self::TIMEZONE)->format('H:i');
        [$from, $to] = [$rules['night_from'], $rules['night_to']];

        return $from <= $to ? ($now >= $from && $now < $to) : ($now >= $from || $now < $to);
    }

    /** Заявку в друзі від $from підлітку $teen можна надіслати? */
    public function allowsFriendRequest(User $from, User $teen): bool
    {
        $rules = $this->rulesFor($teen);
        if ($rules === null || ! $rules['friends_of_friends']) {
            return true;
        }

        return array_intersect($this->friends->friendIds($from), $this->friends->friendIds($teen)) !== [];
    }

    /**
     * Сторінка налаштувань: я як батьки (мої підлітки) і я як підліток (мої батьки й запрошення).
     *
     * @return array<string, mixed>
     */
    public function state(User $user): array
    {
        $card = fn (int $id) => User::query()->find($id)?->toCard();

        return [
            'teen_mode' => TeenMode::state($user),
            'children' => DB::table('parent_links')->where('parent_id', $user->id)->orderBy('id')->get()
                ->map(fn ($link) => [
                    'id' => (int) $link->id,
                    'status' => $link->status,
                    'user' => $card((int) $link->teen_id),
                    'rules' => (array) json_decode((string) $link->rules, true),
                    'summary' => $link->status === self::ACTIVE ? $this->summary((int) $link->teen_id) : null,
                ])->filter(fn ($row) => $row['user'] !== null)->values()->all(),
            'parents' => DB::table('parent_links')->where('teen_id', $user->id)->orderBy('id')->get()
                ->map(fn ($link) => ['id' => (int) $link->id, 'status' => $link->status, 'user' => $card((int) $link->parent_id)])
                ->filter(fn ($row) => $row['user'] !== null)->values()->all(),
        ];
    }

    /**
     * Загальна картина для батьків — без листування.
     *
     * @return array{friends: int, new_friends: int, communities: int, last_seen: string|null}
     */
    private function summary(int $teenId): array
    {
        $teen = User::query()->find($teenId);

        return [
            'friends' => $teen ? count($this->friends->friendIds($teen)) : 0,
            'new_friends' => Friendship::query()->where('status', Friendship::ACCEPTED)->where('accepted_at', '>=', now()->subDays(7))
                ->where(fn ($q) => $q->where('requester_id', $teenId)->orWhere('addressee_id', $teenId))->count(),
            'communities' => CommunityMember::query()->where('user_id', $teenId)->where('status', CommunityMember::STATUS_ACTIVE)->count(),
            'last_seen' => $teen?->last_seen_at?->toIso8601String(),
        ];
    }
}
