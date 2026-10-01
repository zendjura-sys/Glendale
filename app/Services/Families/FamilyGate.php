<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Хто є учасником сім’ї та що йому дозволено за матрицею прав.
 */
class FamilyGate
{
    /** @var array<string, FamilyMember|null> */
    private array $members = [];

    public function member(Family $family, ?User $user): ?FamilyMember
    {
        if (! $user) {
            return null;
        }

        $key = $family->id.':'.$user->id;
        if (! array_key_exists($key, $this->members)) {
            $member = FamilyMember::query()
                ->where('family_id', $family->id)
                ->where('user_id', $user->id)
                ->where('status', FamilyMember::STATUS_ACTIVE)
                ->first();
            $member?->setRelation('family', $family);
            $member?->setRelation('user', $user);
            $this->members[$key] = $member;
        }

        return $this->members[$key];
    }

    public function forget(): void
    {
        $this->members = [];
    }

    public function can(?FamilyMember $member, Family $family, string $permission): bool
    {
        if (! $member || ! $member->isActive()) {
            return false;
        }

        return $member->user_id === $family->owner_id || $family->rankAllows($member->rank, $permission);
    }

    public function authorize(?FamilyMember $member, Family $family, string $permission): void
    {
        abort_unless($this->can($member, $family, $permission), 403, 'Недостатньо прав у сім’ї для цієї дії.');
    }

    /**
     * @return array<string, bool>
     */
    public function abilities(?FamilyMember $member, Family $family): array
    {
        $abilities = [];
        foreach (array_keys(Family::PERMISSIONS) as $permission) {
            $abilities[$permission] = $this->can($member, $family, $permission);
        }
        $abilities['reports.review'] = collect(['bizwar', 'contract', 'investment', 'other'])->contains(fn ($t) => $abilities['reports.'.$t]);
        $abilities['owner'] = $member !== null && $member->user_id === $family->owner_id;

        return $abilities;
    }

    /**
     * Активні учасники з певним правом (для сповіщень).
     *
     * @return Collection<int, FamilyMember>
     */
    public function holders(Family $family, string $permission): Collection
    {
        return $family->activeMembers()->with('user')->get()
            ->filter(fn (FamilyMember $m) => $this->can($m, $family, $permission))
            ->values();
    }
}
