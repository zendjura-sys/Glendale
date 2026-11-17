<?php

namespace App\Services\Shows;

use App\Models\GcGift;
use App\Models\GcGiftPack;
use App\Models\LiveShow;
use App\Models\LiveShowGift;
use App\Models\LiveShowLike;
use App\Models\LiveShowMember;
use App\Models\User;
use App\Models\UserGcGift;
use App\Services\Billing\Wallet;
use App\Support\Shows\GiftRarities;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Паки подарунків GameCast: купівля з балансу, рол рідкостей (pity), дарування й лайки в ефірі.
 */
class GiftPacks
{
    public function __construct(private readonly Wallet $wallet) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function shop(): array
    {
        return GcGiftPack::query()->active()->orderBy('position')->orderBy('id')
            ->get()->map(fn (GcGiftPack $p) => $p->toCard())->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function inventory(User $user): array
    {
        return UserGcGift::query()->with('gift')->where('user_id', $user->id)->where('status', UserGcGift::READY)
            ->latest('id')->limit(100)->get()->map(fn (UserGcGift $g) => $g->toCard())->all();
    }

    /**
     * Купити пак і одразу відкрити (ролі подарунків у інвентар).
     *
     * @return array{pack: array<string, mixed>, opened: list<array<string, mixed>>, balance: int}
     */
    public function buy(User $user, GcGiftPack $pack): array
    {
        abort_unless($pack->is_active, 422, 'Цей пак зараз не в продажу.');
        abort_if($pack->gifts_count < 1, 422, 'Пак порожній.');

        return DB::transaction(function () use ($user, $pack) {
            $this->wallet->debit(
                $user,
                $pack->price,
                'gc_gift_pack',
                'Пак «'.$pack->name.'»',
                'gc_gift_pack:'.$pack->id,
            );

            $opened = $this->open($user, $pack);

            return [
                'pack' => $pack->toCard(),
                'opened' => $opened,
                'balance' => (int) $user->fresh()->balance,
            ];
        });
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function open(User $user, GcGiftPack $pack): array
    {
        $pity = DB::table('user_gc_pack_pity')->where('user_id', $user->id)->where('gc_gift_pack_id', $pack->id)->lockForUpdate()->first();
        $misses = (int) ($pity->misses ?? 0);
        $odds = GiftRarities::sanitizeOdds($pack->odds);
        $opened = [];

        for ($i = 0; $i < $pack->gifts_count; $i++) {
            $forcePity = $pack->pity_after > 0 && $misses >= $pack->pity_after;
            $rarity = $this->rollRarity($odds, $forcePity);
            $gift = $this->pickGift($rarity);
            if ($gift === null) {
                // Немає доступних у цій рідкості — падаємо на звичайний.
                $gift = $this->pickGift(GiftRarities::COMMON) ?? GcGift::query()->active()->first();
            }
            if ($gift === null) {
                throw ValidationException::withMessages(['pack' => 'Каталог подарунків порожній.']);
            }

            if ($gift->stock !== null) {
                $locked = GcGift::query()->whereKey($gift->id)->lockForUpdate()->first();
                if ($locked === null || ! $locked->available()) {
                    $gift = $this->pickGift(GiftRarities::COMMON) ?? $gift;
                } else {
                    $locked->decrement('stock');
                    $gift = $locked->fresh();
                }
            }

            $row = UserGcGift::query()->create([
                'user_id' => $user->id,
                'gc_gift_id' => $gift->id,
                'gc_gift_pack_id' => $pack->id,
                'status' => UserGcGift::READY,
                'opened_at' => now(),
            ]);
            $row->setRelation('gift', $gift);
            $opened[] = $row->toCard();

            if (GiftRarities::isPityTier($gift->rarity)) {
                $misses = 0;
            } else {
                $misses++;
            }
        }

        DB::table('user_gc_pack_pity')->upsert(
            [[
                'user_id' => $user->id,
                'gc_gift_pack_id' => $pack->id,
                'misses' => $misses,
                'created_at' => now(),
                'updated_at' => now(),
            ]],
            ['user_id', 'gc_gift_pack_id'],
            ['misses', 'updated_at'],
        );

        return $opened;
    }

    /**
     * @param  array<string, int>  $odds
     */
    private function rollRarity(array $odds, bool $forcePity): string
    {
        if ($forcePity) {
            $odds = array_intersect_key($odds, array_flip(GiftRarities::PITY_FLOOR));
            if (array_sum($odds) <= 0) {
                return GiftRarities::RARE;
            }
        }
        // Унікали без залишку не крутимо.
        if (($odds[GiftRarities::UNIQUE] ?? 0) > 0 && ! $this->hasUniqueStock()) {
            $odds[GiftRarities::UNIQUE] = 0;
        }
        $total = array_sum($odds);
        if ($total <= 0) {
            return GiftRarities::COMMON;
        }
        $roll = random_int(1, $total);
        $cursor = 0;
        foreach ($odds as $rarity => $weight) {
            $cursor += $weight;
            if ($roll <= $cursor) {
                return $rarity;
            }
        }

        return GiftRarities::COMMON;
    }

    private function hasUniqueStock(): bool
    {
        return GcGift::query()->active()->where('rarity', GiftRarities::UNIQUE)
            ->where(fn ($q) => $q->whereNull('stock')->orWhere('stock', '>', 0))->exists();
    }

    private function pickGift(string $rarity): ?GcGift
    {
        $pool = GcGift::query()->active()->where('rarity', $rarity)
            ->where(fn ($q) => $q->whereNull('stock')->orWhere('stock', '>', 0))
            ->get();
        if ($pool->isEmpty()) {
            return null;
        }

        return $pool->random();
    }

    /** Лайк ведучому / співведучому / гостю в ефірі (перемикач). */
    public function toggleLike(LiveShow $show, User $from, User $to): array
    {
        abort_unless($show->status === LiveShow::LIVE, 422, 'Лайкати можна лише під час ефіру.');
        abort_if($from->id === $to->id, 422, 'Собі лайк не ставиться.');
        abort_unless($this->isGiftableTarget($show, $to), 422, 'Лайк лише ведучим і гостям на сцені.');

        $existing = LiveShowLike::query()
            ->where('live_show_id', $show->id)
            ->where('from_user_id', $from->id)
            ->where('to_user_id', $to->id)
            ->first();
        if ($existing) {
            $existing->delete();

            return ['liked' => false, 'likes' => $this->likeCount($show, $to->id)];
        }
        LiveShowLike::query()->create([
            'live_show_id' => $show->id,
            'from_user_id' => $from->id,
            'to_user_id' => $to->id,
        ]);

        return ['liked' => true, 'likes' => $this->likeCount($show, $to->id)];
    }

    public function sendGift(LiveShow $show, User $from, User $to, UserGcGift $owned): LiveShowGift
    {
        abort_unless($show->status === LiveShow::LIVE, 422, 'Дарувати можна лише під час ефіру.');
        abort_if($from->id === $to->id, 422, 'Собі дарувати не можна.');
        abort_unless($owned->user_id === $from->id && $owned->status === UserGcGift::READY, 403, 'Цього подарунка немає в інвентарі.');
        abort_unless($this->isGiftableTarget($show, $to), 422, 'Дарувати можна ведучим і гостям на сцені.');

        return DB::transaction(function () use ($show, $from, $to, $owned) {
            $row = UserGcGift::query()->whereKey($owned->id)->lockForUpdate()->firstOrFail();
            abort_unless($row->status === UserGcGift::READY && $row->user_id === $from->id, 422, 'Подарунок уже використано.');
            $row->update(['status' => UserGcGift::GIFTED, 'gifted_at' => now()]);

            return LiveShowGift::query()->create([
                'live_show_id' => $show->id,
                'from_user_id' => $from->id,
                'to_user_id' => $to->id,
                'gc_gift_id' => $row->gc_gift_id,
                'user_gc_gift_id' => $row->id,
            ]);
        });
    }

    private function isGiftableTarget(LiveShow $show, User $to): bool
    {
        $member = LiveShowMember::query()->where('live_show_id', $show->id)->where('user_id', $to->id)->first();
        if ($member === null) {
            return false;
        }
        if (in_array($member->role, ['host', 'speaker'], true)) {
            return true;
        }

        return $member->role === 'guest' && $member->mic_until !== null && $member->mic_until->isFuture();
    }

    public function likeCount(LiveShow $show, int $userId): int
    {
        return LiveShowLike::query()->where('live_show_id', $show->id)->where('to_user_id', $userId)->count();
    }

    /**
     * @return array{counts: array<int, int>, mine: list<int>}
     */
    public function likesFor(LiveShow $show, ?User $viewer): array
    {
        $counts = LiveShowLike::query()->where('live_show_id', $show->id)
            ->selectRaw('to_user_id, count(*) as c')->groupBy('to_user_id')->pluck('c', 'to_user_id')->all();
        $mine = [];
        if ($viewer) {
            $mine = LiveShowLike::query()->where('live_show_id', $show->id)->where('from_user_id', $viewer->id)
                ->pluck('to_user_id')->all();
        }

        return ['counts' => array_map('intval', $counts), 'mine' => array_map('intval', $mine)];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function recentGifts(LiveShow $show, int $limit = 20): array
    {
        return LiveShowGift::query()->with(['from', 'to', 'gift'])->where('live_show_id', $show->id)
            ->latest('id')->limit($limit)->get()->map(fn (LiveShowGift $g) => $g->toCard())->all();
    }

    /** Підсвітка останнього божественного / унікального дару. */
    public function spotlight(LiveShow $show): ?array
    {
        $gift = LiveShowGift::query()->with(['from', 'to', 'gift'])->where('live_show_id', $show->id)
            ->whereHas('gift', fn ($q) => $q->whereIn('rarity', [GiftRarities::DIVINE, GiftRarities::UNIQUE]))
            ->latest('id')->first();
        if ($gift === null || $gift->created_at === null || $gift->created_at->lt(now()->subMinutes(2))) {
            return null;
        }

        return $gift->toCard();
    }
}
