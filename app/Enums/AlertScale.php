<?php

namespace App\Enums;

/**
 * Масштаб повітряної тривоги (AIR): уся область, район, громада чи населений пункт — колір заливки й бейджа.
 */
enum AlertScale: string
{
    case OBLAST = 'oblast';
    case RAION = 'raion';
    case HROMADA = 'hromada';
    case CITY = 'city';

    /** Сирий тип місця з API (oblast/State, raion/District, hromada/Community, city) → масштаб. */
    public static function fromApi(string $raw): self
    {
        return match (strtolower(trim($raw))) {
            'raion', 'district' => self::RAION,
            'hromada', 'community' => self::HROMADA,
            'city', 'settlement' => self::CITY,
            default => self::OBLAST,
        };
    }

    /** Рівень у наших даних (1 — область, 2 — район, 3 — громада). */
    public static function fromLevel(int $level): self
    {
        return match ($level) {
            2 => self::RAION,
            3 => self::HROMADA,
            4 => self::CITY,
            default => self::OBLAST,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::OBLAST => 'Вся область',
            self::RAION => 'Район',
            self::HROMADA => 'Громада (ОТГ)',
            self::CITY => 'Населений пункт',
        };
    }

    /**
     * @return array{hex: string, fill: string, border: string, text: string}
     */
    public function colors(): array
    {
        return match ($this) {
            self::OBLAST => ['hex' => '#DC2626', 'fill' => 'rgba(220, 38, 38, 0.38)', 'border' => 'rgba(248, 113, 113, 0.60)', 'text' => '#F87171'],
            self::RAION => ['hex' => '#E11D48', 'fill' => 'rgba(225, 29, 72, 0.30)', 'border' => 'rgba(251, 113, 133, 0.50)', 'text' => '#FB7185'],
            self::HROMADA => ['hex' => '#F43F5E', 'fill' => 'rgba(244, 63, 94, 0.24)', 'border' => 'rgba(251, 113, 133, 0.42)', 'text' => '#FDA4AF'],
            self::CITY => ['hex' => '#FB7185', 'fill' => 'rgba(251, 113, 133, 0.18)', 'border' => 'rgba(253, 164, 175, 0.38)', 'text' => '#FECDD3'],
        };
    }
}
