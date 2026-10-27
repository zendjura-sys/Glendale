<?php

namespace App\Services\Party;

use App\Models\PartyPost;
use App\Models\PartyTimeSlot;
use App\Models\User;
use App\Notifications\PartyTimePicked;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Голосування за час гри: 2–4 варіанти від автора, кожен позначає всі зручні («мені підходить»),
 * автор закріплює один — він стає часом старту, а учасники й ті, хто голосував, отримують сповіщення.
 */
class PartyTimeVote
{
    public const MIN = 2;

    public const MAX = 4;

    public const ZONE = 'Europe/Kyiv';

    /**
     * Додати варіанти до нового паті.
     *
     * @param  list<Carbon>  $times
     */
    public function open(PartyPost $party, array $times): void
    {
        foreach ($times as $time) {
            PartyTimeSlot::query()->create(['party_post_id' => $party->id, 'starts_at' => $time]);
        }
    }

    /**
     * Замінити свій вибір: позначені варіанти — ті, що підходять (можна жодного).
     *
     * @param  list<int>  $slotIds
     */
    public function vote(PartyPost $party, User $user, array $slotIds): void
    {
        abort_unless($party->isOpen(), 422, 'Оголошення вже закрите.');
        abort_if($party->starts_at !== null, 422, 'Час уже закріплено.');
        $own = $party->timeSlots()->pluck('id')->all();
        $picked = array_values(array_intersect(array_map('intval', $slotIds), $own));

        DB::transaction(function () use ($own, $picked, $user) {
            DB::table('party_time_votes')->whereIn('party_time_slot_id', $own)->where('user_id', $user->id)->delete();
            DB::table('party_time_votes')->insert(array_map(fn (int $id) => ['party_time_slot_id' => $id, 'user_id' => $user->id, 'created_at' => now()], $picked));
        });
    }

    /** Автор закріплює час: старт паті, оголошення живе ще 3 години після нього, сповіщення людям. */
    public function pick(PartyPost $party, User $host, PartyTimeSlot $slot): void
    {
        abort_unless($party->user_id === $host->id, 403);
        abort_unless($slot->party_post_id === $party->id, 404);
        abort_unless($party->isOpen(), 422, 'Оголошення вже закрите.');
        abort_if($party->starts_at !== null, 422, 'Час уже закріплено.');

        $party->update(['starts_at' => $slot->starts_at, 'expires_at' => $slot->starts_at->copy()->addHours(PartyBoard::HOURS)]);

        $at = Carbon::instance($slot->starts_at)->setTimezone(self::ZONE);
        $at->locale('uk');
        $when = $at->translatedFormat('j F, H:i');
        $ids = array_unique([
            ...$party->members()->pluck('user_id')->all(),
            ...DB::table('party_time_votes')->whereIn('party_time_slot_id', $party->timeSlots()->pluck('id'))->pluck('user_id')->all(),
        ]);
        User::query()->whereIn('id', $ids)->where('id', '!=', $host->id)->get()
            ->each(fn (User $user) => $user->notify(new PartyTimePicked($host, $party, $when)));
    }

    /**
     * Голосування для картки паті (null — паті без голосування).
     *
     * @return array{decided: bool, options: list<array{id: int, starts_at: string, votes: int, mine: bool, picked: bool, voters: list<array<string, mixed>>}>}|null
     */
    public function card(PartyPost $party, User $viewer): ?array
    {
        $party->loadMissing('timeSlots.voters');
        if ($party->timeSlots->isEmpty()) {
            return null;
        }

        return [
            'decided' => $party->starts_at !== null,
            'options' => array_values($party->timeSlots->map(fn (PartyTimeSlot $slot) => [
                'id' => $slot->id,
                'starts_at' => $slot->starts_at->toIso8601String(),
                'votes' => $slot->voters->count(),
                'mine' => $slot->voters->contains('id', $viewer->id),
                'picked' => $party->starts_at !== null && $party->starts_at->equalTo($slot->starts_at),
                'voters' => array_values($slot->voters->take(5)->map(fn (User $user) => $user->toCard())->all()),
            ])->all()),
        ];
    }
}
