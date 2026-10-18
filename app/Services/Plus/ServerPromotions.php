<?php

namespace App\Services\Plus;

use App\Models\GtaServer;
use App\Models\ServerPromotion;
use App\Models\User;
use Carbon\CarbonInterface;

/**
 * Платне просування серверів. Місць у топі небагато: якщо все зайнято,
 * оплачений період стає в чергу й починається, щойно звільниться місце.
 */
class ServerPromotions
{
    public function slots(string $kind): int
    {
        return (int) config("plus.promo_slots.{$kind}", 1);
    }

    /** Коли звільниться місце (now — уже вільне). */
    public function freeAt(string $kind): CarbonInterface
    {
        $ends = ServerPromotion::query()->where('kind', $kind)->where('ends_at', '>', now())
            ->orderBy('ends_at')->pluck('ends_at', 'id');
        $taken = $ends->count();
        if ($taken < $this->slots($kind)) {
            return now();
        }

        // Найраніший кінець серед зайнятих місць (спрощено: черга по одному).
        $first = $ends->values()->get($taken - $this->slots($kind));

        return $first instanceof CarbonInterface ? $first : now()->parse((string) $first);
    }

    public function start(GtaServer $server, string $kind, int $days, ?User $user, ?int $paymentId = null): ServerPromotion
    {
        // Продовження: нове просування того самого сервера йде одразу після чинного.
        $current = ServerPromotion::query()->where('gta_server_id', $server->id)->where('kind', $kind)
            ->where('ends_at', '>', now())->max('ends_at');
        $start = $current !== null ? now()->parse($current) : $this->freeAt($kind);

        return ServerPromotion::query()->create([
            'gta_server_id' => $server->id,
            'kind' => $kind,
            'user_id' => $user?->id,
            'payment_id' => $paymentId,
            'starts_at' => $start,
            'ends_at' => $start->copy()->addDays($days),
        ]);
    }

    /**
     * Сервери з чинним просуванням: id → список видів.
     *
     * @return array<int, list<string>>
     */
    public function live(): array
    {
        $out = [];
        foreach (ServerPromotion::query()->live()->get(['gta_server_id', 'kind']) as $row) {
            $out[$row->gta_server_id][] = $row->kind;
        }

        return $out;
    }

    /**
     * Для власника: чинні й заплановані просування.
     *
     * @return list<array{kind: string, starts_at: string, ends_at: string}>
     */
    public function forServer(GtaServer $server): array
    {
        return array_values(ServerPromotion::query()->where('gta_server_id', $server->id)->where('ends_at', '>', now())
            ->orderBy('starts_at')->get()
            ->map(fn (ServerPromotion $p) => ['kind' => $p->kind, 'starts_at' => $p->starts_at->toIso8601String(), 'ends_at' => $p->ends_at->toIso8601String()])
            ->all());
    }
}
