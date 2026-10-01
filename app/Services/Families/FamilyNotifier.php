<?php

namespace App\Services\Families;

use App\Events\FamilyUpdated;
use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\User;
use App\Notifications\FamilyActivity;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class FamilyNotifier
{
    public function __construct(private readonly FamilyGate $gate) {}

    /**
     * @param  iterable<FamilyMember>|FamilyMember  $members
     */
    public function members(iterable|FamilyMember $members, Family $family, string $kind, string $text, string $url): void
    {
        $users = collect($members instanceof FamilyMember ? [$members] : $members)
            ->map(fn (FamilyMember $m) => $m->relationLoaded('user') ? $m->user : User::query()->find($m->user_id))
            ->filter()
            ->unique('id');

        $this->send($users, $family, $kind, $text, $url);
    }

    /**
     * Сповіщає всіх, хто має право $permission, крім $except.
     */
    public function holders(Family $family, string $permission, string $kind, string $text, string $url, ?FamilyMember $except = null): void
    {
        $holders = $this->gate->holders($family, $permission)->reject(fn (FamilyMember $m) => $m->id === $except?->id);
        $this->members($holders, $family, $kind, $text, $url);
    }

    /**
     * @param  Collection<int, User>  $users
     */
    private function send(Collection $users, Family $family, string $kind, string $text, string $url): void
    {
        if ($users->isEmpty()) {
            return;
        }

        DB::afterCommit(fn () => Notification::send($users, new FamilyActivity($kind, $family, $text, $url)));
    }

    /**
     * Реальний час — бонус: якщо Reverb недоступний, дія все одно виконується.
     */
    public function refresh(Family $family, string $section): void
    {
        if (in_array($section, ['reports', 'events', 'settings', 'members'], true)) {
            Cache::forever('family.rating.v.'.$family->id, (int) Cache::get('family.rating.v.'.$family->id, 0) + 1);
        }

        DB::afterCommit(fn () => rescue(fn () => broadcast(new FamilyUpdated($family->id, $section)), report: false));
    }
}
