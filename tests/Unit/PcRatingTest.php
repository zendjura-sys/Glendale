<?php

namespace Tests\Unit;

use App\Services\Games\PcRating;
use PHPUnit\Framework\TestCase;

/** №224: оцінка збірки й поради апгрейду. */
class PcRatingTest extends TestCase
{
    public function test_old_build_gets_low_score_and_upgrade_advice(): void
    {
        $rating = PcRating::rate(['cpu' => 'Intel Core i5-4460', 'gpu' => 'GTX 1060', 'ram' => 8]);

        $this->assertNotNull($rating);
        $this->assertLessThan(45, $rating['score']);
        $this->assertSame('Початкова', $rating['tier']);
        $advice = implode(' ', $rating['advice']);
        $this->assertStringContainsString('пам’яті', $advice);
        $this->assertStringContainsString('RTX 4060', $advice);
    }

    public function test_balanced_top_build_needs_no_upgrade(): void
    {
        $rating = PcRating::rate(['cpu' => 'Ryzen 7 7800X3D', 'gpu' => 'RTX 4070 Super', 'ram' => 32]);

        $this->assertSame('Топова', $rating['tier']);
        $this->assertNull($rating['weak']);
        $this->assertSame(['Збірка збалансована — апгрейд поки не потрібен.'], $rating['advice']);
    }

    public function test_bottleneck_and_unknown_parts(): void
    {
        $weakCpu = PcRating::rate(['cpu' => 'Core i5-4460', 'gpu' => 'RTX 4080', 'ram' => 16]);
        $this->assertSame('cpu', $weakCpu['weak']);

        $unknown = PcRating::rate(['cpu' => 'щось своє', 'gpu' => null, 'ram' => null]);
        $this->assertNull($unknown['score']);
        $this->assertStringContainsString('не впізнали', $unknown['advice'][0]);

        $this->assertNull(PcRating::rate([]));
    }
}
