<?php

namespace App\Services\Growth;

use App\Models\PromoBanner;
use App\Models\PromoBannerVariant;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * A/B-тести банерів: людина стабільно бачить один варіант (хеш від id людини й банера з урахуванням
 * ваг), показ рахується раз на добу, клік — через перехід /promo/{variant}. Закриті банери не повертаються.
 */
class BannerTests
{
    /**
     * Банер для людини в місці показу (або null).
     *
     * @return array<string, mixed>|null
     */
    public function for(User $user, string $placement): ?array
    {
        $dismissed = array_map('intval', (array) $user->pref('dismissed_banners', []));
        // У кеші — лише id (кеш сайту не зберігає об’єкти моделей).
        $ids = Cache::remember("promo:running:{$placement}", 60, fn () => PromoBanner::query()
            ->where('placement', $placement)->where('status', 'running')
            ->where(fn ($q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', now()))
            ->latest('id')->pluck('id')->all());
        $ids = array_values(array_diff(array_map('intval', (array) $ids), $dismissed));
        if ($ids === []) {
            return null;
        }
        $banners = PromoBanner::query()->with('variants')->whereIn('id', $ids)->latest('id')->get();
        $banner = $banners->first(fn (PromoBanner $b) => $b->variants->isNotEmpty());
        if ($banner === null) {
            return null;
        }
        $variant = $this->pick($banner, $user);
        if (Cache::add("promo:seen:{$variant->id}:{$user->id}:".now()->toDateString(), 1, now()->addDay())) {
            PromoBannerVariant::query()->whereKey($variant->id)->increment('impressions');
        }

        return [
            'banner_id' => $banner->id,
            'variant_id' => $variant->id,
            'title' => $variant->title,
            'text' => $variant->text,
            'cta' => $variant->cta,
            'tone' => $variant->tone,
            'href' => '/promo/'.$variant->id,
        ];
    }

    public function pick(PromoBanner $banner, User $user): PromoBannerVariant
    {
        $variants = $banner->variants;
        if ($banner->winner_id && ($winner = $variants->firstWhere('id', $banner->winner_id))) {
            return $winner;
        }
        $total = max(1, (int) $variants->sum('weight'));
        $point = hexdec(substr(hash('sha256', "{$banner->id}:{$user->id}"), 0, 8)) % $total;
        foreach ($variants as $v) {
            $point -= $v->weight;
            if ($point < 0) {
                return $v;
            }
        }

        return $variants->first();
    }

    /**
     * Статистика: CTR кожного варіанта й упевненість, що різниця з A не випадкова (z-тест двох частот).
     *
     * @return list<array<string, mixed>>
     */
    public function stats(PromoBanner $banner): array
    {
        $base = $banner->variants->first();

        return $banner->variants->map(function (PromoBannerVariant $v) use ($base) {
            $lift = null;
            $confidence = null;
            if ($base && $v->id !== $base->id && $base->impressions > 0 && $v->impressions > 0) {
                $p1 = $base->ctr();
                $p2 = $v->ctr();
                $lift = $p1 > 0 ? round(($p2 - $p1) / $p1 * 100, 1) : null;
                $pool = ($base->clicks + $v->clicks) / ($base->impressions + $v->impressions);
                $se = sqrt($pool * (1 - $pool) * (1 / $base->impressions + 1 / $v->impressions));
                $confidence = $se > 0 ? (int) round((1 - 2 * (1 - $this->normalCdf(abs($p2 - $p1) / $se))) * 100) : null;
            }

            return [
                'id' => $v->id,
                'label' => $v->label,
                'title' => $v->title,
                'text' => $v->text,
                'cta' => $v->cta,
                'url' => $v->url,
                'tone' => $v->tone,
                'weight' => $v->weight,
                'impressions' => $v->impressions,
                'clicks' => $v->clicks,
                'ctr' => round($v->ctr() * 100, 2),
                'lift' => $lift,
                'confidence' => $confidence,
            ];
        })->values()->all();
    }

    public function forget(string $placement): void
    {
        Cache::forget("promo:running:{$placement}");
    }

    /** Функція розподілу стандартного нормального (наближення Абрамовіца–Стіган). */
    private function normalCdf(float $z): float
    {
        $t = 1 / (1 + 0.2316419 * $z);
        $d = 0.3989423 * exp(-$z * $z / 2);

        return 1 - $d * $t * (0.3193815 + $t * (-0.3565638 + $t * (1.781478 + $t * (-1.821256 + $t * 1.330274))));
    }
}
