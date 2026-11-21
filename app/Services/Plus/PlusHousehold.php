<?php

namespace App\Services\Plus;

use App\Models\PlusGrant;
use App\Models\User;
use App\Notifications\BillingNotice;
use App\Services\FriendshipService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * GameCon+ на 5 акаунтів (№215). Власник купує тариф «household» (період plus_grants із
 * джерелом «household») і запрошує до 4 друзів. Прийняв — отримує власний період GameCon+
 * («household_member») до кінця періоду власника; продовження розтягує періоди всіх,
 * вихід чи видалення — закриває період людини. Гроші й ціни — лише з каталогу (на сайті).
 */
class PlusHousehold
{
    /** Скільки людей, крім власника. */
    public const MAX_MEMBERS = 4;

    public const INVITED = 'invited';

    public const ACTIVE = 'active';

    public function __construct(private readonly Plus $plus, private readonly FriendshipService $friends) {}

    /** До коли діє спільна підписка власника (null — немає). */
    public function until(User $owner): ?Carbon
    {
        $end = PlusGrant::query()->where('owner_type', 'user')->where('owner_id', $owner->id)
            ->where('source', 'household')->max('ends_at');
        $end = $end !== null ? Carbon::parse($end) : null;

        return $end?->isFuture() ? $end : null;
    }

    /** Оплачено (сайт): період підписки власника — після поточного спільного, і продовження всім учасникам. */
    public function purchase(User $owner, int $days, ?int $paymentId = null): void
    {
        DB::transaction(function () use ($owner, $days, $paymentId) {
            $start = $this->until($owner) ?? now();
            PlusGrant::query()->create([
                'owner_type' => 'user', 'owner_id' => $owner->id, 'source' => 'household',
                'payment_id' => $paymentId, 'by_user_id' => $owner->id, 'note' => 'GameCon+ на 5 акаунтів',
                'starts_at' => $start, 'ends_at' => $start->copy()->addDays($days),
            ]);
            $this->plus->refresh($owner);
            $this->sync($owner);
        });
    }

    public function invite(User $owner, User $member): void
    {
        $until = $this->until($owner) ?? throw ValidationException::withMessages(['username' => 'Спершу оформіть GameCon+ на 5 акаунтів.']);
        if ($member->id === $owner->id) {
            throw ValidationException::withMessages(['username' => 'Ви вже власник підписки.']);
        }
        if (! in_array($member->id, $this->friends->friendIds($owner), true)) {
            throw ValidationException::withMessages(['username' => 'Запросити можна лише друга.']);
        }
        if (DB::table('plus_household_members')->where('owner_id', $owner->id)->count() >= self::MAX_MEMBERS) {
            throw ValidationException::withMessages(['username' => 'У підписці вже '.self::MAX_MEMBERS.' людини — більше місць немає.']);
        }
        if (DB::table('plus_household_members')->where('member_id', $member->id)->where('status', self::ACTIVE)->exists()) {
            throw ValidationException::withMessages(['username' => 'Ця людина вже в іншій спільній підписці.']);
        }
        DB::table('plus_household_members')->insertOrIgnore([
            'owner_id' => $owner->id, 'member_id' => $member->id, 'status' => self::INVITED,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $member->notify(new BillingNotice('plus_household_invite', $owner->first_name.' запрошує вас у спільну підписку GameCon+ до '.$until->format('d.m.Y').'.', '/plus'));
    }

    public function accept(User $member, int $rowId): void
    {
        $row = DB::table('plus_household_members')->where('id', $rowId)->where('member_id', $member->id)->where('status', self::INVITED)->first()
            ?? throw ValidationException::withMessages(['invite' => 'Запрошення не знайдено.']);
        $owner = User::query()->find((int) $row->owner_id);
        $until = $owner ? $this->until($owner) : null;
        if ($owner === null || $until === null) {
            throw ValidationException::withMessages(['invite' => 'Підписка власника вже не діє.']);
        }
        if (DB::table('plus_household_members')->where('member_id', $member->id)->where('status', self::ACTIVE)->exists()) {
            throw ValidationException::withMessages(['invite' => 'Ви вже в іншій спільній підписці — спершу вийдіть із неї.']);
        }

        DB::transaction(function () use ($member, $owner, $until, $rowId) {
            $grant = PlusGrant::query()->create([
                'owner_type' => 'user', 'owner_id' => $member->id, 'source' => 'household_member',
                'by_user_id' => $owner->id, 'note' => 'Спільна підписка', 'starts_at' => now(), 'ends_at' => $until,
            ]);
            DB::table('plus_household_members')->where('id', $rowId)->update(['status' => self::ACTIVE, 'plus_grant_id' => $grant->id, 'updated_at' => now()]);
            $this->plus->refresh($member);
        });
        $owner->notify(new BillingNotice('plus_household_joined', $member->first_name.' приєднується до вашої спільної підписки GameCon+.', '/plus'));
    }

    /** Вийти, відхилити запрошення (людина) чи прибрати людину (власник). */
    public function remove(User $actor, int $rowId): void
    {
        $row = DB::table('plus_household_members')->where('id', $rowId)
            ->where(fn ($q) => $q->where('owner_id', $actor->id)->orWhere('member_id', $actor->id))->first()
            ?? throw ValidationException::withMessages(['member' => 'Не знайдено.']);
        DB::transaction(function () use ($row) {
            if ($row->plus_grant_id !== null && ($grant = PlusGrant::query()->find((int) $row->plus_grant_id)) !== null && $grant->ends_at->isFuture()) {
                $this->plus->revoke($grant);
            }
            DB::table('plus_household_members')->where('id', $row->id)->delete();
        });
    }

    /** Після оплати чи продовження: періоди учасників тягнуться до нового кінця підписки власника. */
    public function sync(User $owner): void
    {
        // Підписка закінчилась чи гроші повернули — періоди учасників закриваються зараз.
        $until = $this->until($owner) ?? now();
        $rows = DB::table('plus_household_members')->where('owner_id', $owner->id)->where('status', self::ACTIVE)->whereNotNull('plus_grant_id')->get();
        foreach ($rows as $row) {
            $grant = PlusGrant::query()->find((int) $row->plus_grant_id);
            $member = User::query()->find((int) $row->member_id);
            if ($grant === null || $member === null) {
                continue;
            }
            $grant->update(['ends_at' => $until->max($grant->starts_at)]);
            $this->plus->refresh($member);
        }
    }

    /**
     * Стан для сторінки GameCon+: моя підписка (якщо я власник), де я учасник, мої запрошення.
     *
     * @return array<string, mixed>
     */
    public function state(User $user): array
    {
        $until = $this->until($user);
        $people = fn ($rows) => $rows->map(function ($row) use ($user) {
            $other = User::query()->find((int) ((int) $row->owner_id === $user->id ? $row->member_id : $row->owner_id));

            return $other ? ['id' => $row->id, 'status' => $row->status, 'user' => $other->toCard()] : null;
        })->filter()->values()->all();
        $memberOf = DB::table('plus_household_members')->where('member_id', $user->id)->where('status', self::ACTIVE)->first();
        $owner = $memberOf ? User::query()->find((int) $memberOf->owner_id) : null;

        return [
            'max' => self::MAX_MEMBERS,
            'until' => $until?->toIso8601String(),
            'members' => $until ? $people(DB::table('plus_household_members')->where('owner_id', $user->id)->orderBy('id')->get()) : [],
            'member_of' => $memberOf && $owner ? ['id' => $memberOf->id, 'owner' => $owner->toCard(), 'until' => $this->until($owner)?->toIso8601String()] : null,
            'invites' => $people(DB::table('plus_household_members')->where('member_id', $user->id)->where('status', self::INVITED)->get()),
        ];
    }
}
