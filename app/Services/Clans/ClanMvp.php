<?php

namespace App\Services\Clans;

use App\Models\Clan;
use App\Models\ClanMember;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/** «Гравець місяця» в клані: учасники голосують за одного з клану; переможець минулого місяця — на сторінці клану. */
class ClanMvp
{
    public function month(int $offset = 0): string
    {
        return now('Europe/Kyiv')->startOfMonth()->subMonths($offset)->format('Y-m');
    }

    public function vote(Clan $clan, User $voter, User $candidate): void
    {
        abort_if($voter->id === $candidate->id, 422, 'За себе голосувати не можна.');
        $isMember = fn (User $u) => ClanMember::query()->where('clan_id', $clan->id)->where('user_id', $u->id)->where('status', ClanMember::STATUS_ACTIVE)->exists();
        abort_unless($isMember($voter) && $isMember($candidate), 403, 'Голосують і обираються лише учасники клану.');
        DB::table('clan_mvp_votes')->updateOrInsert(
            ['clan_id' => $clan->id, 'month' => $this->month(), 'voter_id' => $voter->id],
            ['user_id' => $candidate->id, 'updated_at' => now(), 'created_at' => now()],
        );
    }

    /**
     * Стан для сторінки клану: переможець минулого місяця, лідери поточного й мій голос.
     *
     * @return array<string, mixed>
     */
    public function state(Clan $clan, ?User $viewer): array
    {
        $tally = fn (string $month) => DB::table('clan_mvp_votes')->where('clan_id', $clan->id)->where('month', $month)
            ->selectRaw('user_id, count(*) as votes')->groupBy('user_id')->orderByDesc('votes')->orderBy('user_id')->limit(5)->get();
        $users = fn ($rows) => User::query()->whereIn('id', $rows->pluck('user_id'))->get()->keyBy('id');
        $last = $tally($this->month(1));
        $current = $tally($this->month());
        $people = $users($last->concat($current));
        $winner = $last->first();

        return [
            'month' => $this->month(),
            'winner' => $winner && $people->has($winner->user_id) ? ['user' => $people[$winner->user_id]->toCard(), 'votes' => (int) $winner->votes, 'month' => $this->month(1)] : null,
            'leaders' => $current->filter(fn ($r) => $people->has($r->user_id))->map(fn ($r) => ['user' => $people[$r->user_id]->toCard(), 'votes' => (int) $r->votes])->values()->all(),
            'my_vote' => $viewer ? DB::table('clan_mvp_votes')->where('clan_id', $clan->id)->where('month', $this->month())->where('voter_id', $viewer->id)->value('user_id') : null,
        ];
    }
}
