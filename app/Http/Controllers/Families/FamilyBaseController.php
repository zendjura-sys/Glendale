<?php

namespace App\Http\Controllers\Families;

use App\Http\Controllers\Controller;
use App\Models\Family;
use App\Models\FamilyCashout;
use App\Models\FamilyItemLog;
use App\Models\FamilyMember;
use App\Models\FamilyReport;
use App\Services\Families\FamilyGate;
use App\Support\Money;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

abstract class FamilyBaseController extends Controller
{
    public function __construct(protected readonly FamilyGate $gate) {}

    /**
     * Активний учасник сім’ї (інакше 403). Для змін — перевіряє, що сім’ю не призупинено.
     */
    protected function member(Request $request, Family $family, ?string $permission = null, bool $write = false): FamilyMember
    {
        $member = $this->gate->member($family, $request->user());
        abort_unless($member !== null, 403, 'Розділ доступний лише учасникам сім’ї.');

        if ($write) {
            abort_if($family->isSuspended(), 423, 'Сім’ю призупинено платформою — зміни недоступні.');
        }
        if ($permission) {
            $this->gate->authorize($member, $family, $permission);
        }

        return $member;
    }

    /**
     * @param  array<string, mixed>  $props
     */
    protected function page(Family $family, FamilyMember $member, string $component, string $section, array $props = []): Response
    {
        $family->loadMissing('server');
        $can = $this->gate->abilities($member, $family);

        return Inertia::render($component, [
            'family' => [
                ...$family->toCard(),
                'description' => $family->description,
                'status_reason' => $family->status_reason,
                'treasury' => $family->treasury,
                'conversation_id' => $family->conversation_id,
                'owner_id' => $family->owner_id,
                'rank_titles' => $family->rankTitles(),
            ],
            'me' => [...$member->toCard($family), 'balance' => $member->balance],
            'can' => $can,
            'section' => $section,
            'badges' => fn () => $this->badges($family, $member, $can),
            ...$props,
        ]);
    }

    /**
     * @param  array<string, bool>  $can
     * @return array<string, int>
     */
    protected function badges(Family $family, FamilyMember $member, array $can): array
    {
        $types = collect(array_keys(FamilyReport::TYPES))->filter(fn ($t) => $can['reports.'.$t] ?? false)->values()->all();

        return [
            'queue' => ($types ? FamilyReport::query()->where('family_id', $family->id)->where('status', FamilyReport::STATUS_PENDING)->whereIn('type', $types)->count() : 0)
                + ($can['treasury.manage'] ? FamilyCashout::query()->where('family_id', $family->id)->where('status', FamilyCashout::STATUS_PENDING)->count() : 0),
            'applications' => $can['members.manage'] ? FamilyMember::query()->where('family_id', $family->id)->where('status', FamilyMember::STATUS_PENDING)->count() : 0,
            'alerts' => $can['warehouse.manage'] ? FamilyItemLog::query()->where('family_id', $family->id)->where('is_suspicious', true)->where('created_at', '>=', now()->subDay())->count() : 0,
            'my_pending' => FamilyReport::query()->where('beneficiary_id', $member->id)->where('status', FamilyReport::STATUS_PENDING)->count(),
        ];
    }

    /**
     * @return list<array{id: int, display: string, rank: int}>
     */
    protected function roster(Family $family): array
    {
        return FamilyMember::query()
            ->where('family_id', $family->id)
            ->where('status', FamilyMember::STATUS_ACTIVE)
            ->orderByDesc('rank')
            ->orderBy('rp_nickname')
            ->get(['id', 'rp_nickname', 'static_id', 'rank'])
            ->map(fn (FamilyMember $m) => ['id' => $m->id, 'display' => $m->displayName(), 'rank' => $m->rank])
            ->all();
    }

    protected function money(mixed $value): int
    {
        return Money::toMinor(is_scalar($value) ? $value : 0);
    }

    /**
     * @return array<string, mixed>
     */
    public static function nicknameRules(): array
    {
        return [
            'rp_nickname' => ['required', 'string', 'max:40', 'regex:'.FamilyMember::NICKNAME_PATTERN],
            'static_id' => ['required', 'string', 'regex:/^\d{1,10}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function nicknameMessages(): array
    {
        return [
            'rp_nickname.regex' => 'Нікнейм — у форматі Ім’я_Прізвище латиницею, наприклад Marco_Scaletta.',
            'static_id.regex' => 'Static ID — лише цифри (до 10).',
        ];
    }
}
