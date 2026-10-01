<?php

namespace App\Services\Families;

use App\Models\FamilyReport;
use App\Models\FamilyReportProof;
use Illuminate\Http\UploadedFile;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;
use Throwable;

/**
 * Антифрод скріншотів: SHA-256 (точна копія) + dHash (пересжата, обрізана чи з іншим форматом копія).
 */
class ProofHasher
{
    /** До цієї відстані Геммінга скріншот вважається тим самим. */
    public const DUPLICATE_DISTANCE = 5;

    /** До цієї — дуже схожим (позначка для перевіряючого). */
    public const SIMILAR_DISTANCE = 11;

    /**
     * @return array{sha256: string, phash: string|null, width: int|null, height: int|null}
     */
    public function hash(UploadedFile $file): array
    {
        $path = (string) $file->getRealPath();
        $sha = (string) hash_file('sha256', $path);

        try {
            $image = (new ImageManager(new Driver))->read($path);
            $width = $image->width();
            $height = $image->height();
            $image->greyscale()->resize(9, 8);

            $bits = '';
            for ($y = 0; $y < 8; $y++) {
                for ($x = 0; $x < 8; $x++) {
                    $bits .= $this->luma($image->pickColor($x, $y)->toArray()) > $this->luma($image->pickColor($x + 1, $y)->toArray()) ? '1' : '0';
                }
            }
            $phash = str_pad(base_convert(substr($bits, 0, 32), 2, 16), 8, '0', STR_PAD_LEFT)
                .str_pad(base_convert(substr($bits, 32), 2, 16), 8, '0', STR_PAD_LEFT);
        } catch (Throwable) {
            return ['sha256' => $sha, 'phash' => null, 'width' => null, 'height' => null];
        }

        return ['sha256' => $sha, 'phash' => $phash, 'width' => $width, 'height' => $height];
    }

    public function distance(string $a, string $b): int
    {
        $distance = 0;
        for ($i = 0; $i < 16; $i += 8) {
            $distance += substr_count(decbin(hexdec(substr($a, $i, 8)) ^ hexdec(substr($b, $i, 8))), '1');
        }

        return $distance;
    }

    /**
     * Однотонні кадри (чорний екран, заливка) дають майже порожній dHash — такі порівнюємо лише за SHA-256.
     */
    public function informative(string $phash): bool
    {
        $bits = substr_count(decbin((int) hexdec(substr($phash, 0, 8))), '1') + substr_count(decbin((int) hexdec(substr($phash, 8, 8))), '1');

        return $bits >= 6 && $bits <= 58;
    }

    /**
     * Шукає збіги серед доказів сім’ї (крім відхилених звітів) за останні 180 днів.
     *
     * @param  array{sha256: string, phash: string|null}  $hash
     * @return array{duplicate: FamilyReportProof|null, similar: list<int>}
     */
    public function match(int $familyId, array $hash): array
    {
        $base = FamilyReportProof::query()
            ->where('family_id', $familyId)
            ->where('created_at', '>=', now()->subDays(180))
            ->whereHas('report', fn ($q) => $q->where('status', '!=', FamilyReport::STATUS_REJECTED));

        $exact = (clone $base)->where('sha256', $hash['sha256'])->with('report')->first();
        if ($exact) {
            return ['duplicate' => $exact, 'similar' => []];
        }

        $similar = [];
        if ($hash['phash'] !== null && $this->informative($hash['phash'])) {
            foreach ((clone $base)->whereNotNull('phash')->select(['id', 'report_id', 'phash'])->lazyById(500) as $proof) {
                $distance = $this->distance($hash['phash'], (string) $proof->phash);
                if ($distance <= self::DUPLICATE_DISTANCE) {
                    return ['duplicate' => $proof->load('report'), 'similar' => []];
                }
                if ($distance <= self::SIMILAR_DISTANCE) {
                    $similar[] = $proof->report_id;
                }
            }
        }

        return ['duplicate' => null, 'similar' => array_values(array_unique($similar))];
    }

    /**
     * @param  array<string, mixed>  $rgba
     */
    private function luma(array $rgba): float
    {
        return 0.299 * (float) ($rgba[0] ?? 0) + 0.587 * (float) ($rgba[1] ?? 0) + 0.114 * (float) ($rgba[2] ?? 0);
    }
}
