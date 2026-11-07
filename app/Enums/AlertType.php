<?php

namespace App\Enums;

/**
 * Єдині типи тривог для мапи (стандарти Мінцифри / Ajax ukrainealarm, alerts.in.ua, NEPTUN): код, пріоритет,
 * назви, іконка Lucide й палітра під темне матове скло. Кілька тривог в одному регіоні — головна та,
 * в якої найвищий priority(), решта — вторинні бейджі.
 */
enum AlertType: string
{
    case NUCLEAR = 'NUCLEAR';
    case CHEMICAL = 'CHEMICAL';
    case BALLISTIC = 'BALLISTIC';
    case AIR = 'AIR';
    case ARTILLERY = 'ARTILLERY';
    case URBAN_FIGHTS = 'URBAN_FIGHTS';
    case UAV = 'UAV';
    case CLEAR = 'CLEAR';
    case NO_DATA = 'NO_DATA';

    /**
     * Сирий тип з будь-якого API → наш код: AIR, air_raid, artillery_shelling, urban_fights, chemical, nuclear,
     * а також рівні загроз (ballistic, kab, missile → BALLISTIC; uav, shahed → UAV).
     */
    public static function fromApi(string $rawType): self
    {
        $raw = strtolower(trim($rawType));

        return match (true) {
            in_array($raw, ['nuclear', 'radiation', 'radiational'], true) => self::NUCLEAR,
            in_array($raw, ['chemical', 'chem'], true) => self::CHEMICAL,
            in_array($raw, ['ballistic', 'ballistics', 'kab', 'missile', 'rocket', 'red'], true) => self::BALLISTIC,
            in_array($raw, ['artillery', 'artillery_shelling', 'shelling'], true) => self::ARTILLERY,
            in_array($raw, ['urban_fights', 'urban_fight', 'street_fights'], true) => self::URBAN_FIGHTS,
            in_array($raw, ['uav', 'drone', 'drones', 'shahed', 'yellow'], true) => self::UAV,
            in_array($raw, ['clear', 'none', 'no_alert', 'off'], true) => self::CLEAR,
            in_array($raw, ['no_data', 'unknown', 'stale'], true) => self::NO_DATA,
            // AIR, air_raid, air — і все невідоме з «тривогою» за замовчуванням.
            default => self::AIR,
        };
    }

    public function priority(): int
    {
        return match ($this) {
            self::NUCLEAR => 100,
            self::CHEMICAL => 90,
            self::BALLISTIC => 80,
            self::AIR => 70,
            self::ARTILLERY => 60,
            self::URBAN_FIGHTS => 50,
            self::UAV => 40,
            self::CLEAR => 10,
            self::NO_DATA => 0,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::NUCLEAR => 'Радіаційна небезпека',
            self::CHEMICAL => 'Хімічна загроза',
            self::BALLISTIC => 'Ракетна небезпека (Балістика)',
            self::AIR => 'Повітряна тривога',
            self::ARTILLERY => 'Загроза артобстрілу',
            self::URBAN_FIGHTS => 'Вуличні бої',
            self::UAV => 'Загроза БпЛА',
            self::CLEAR => 'Немає тривоги',
            self::NO_DATA => 'Немає даних',
        };
    }

    public function shortLabel(): string
    {
        return match ($this) {
            self::NUCLEAR => 'Радіація',
            self::CHEMICAL => 'Хімзагроза',
            self::BALLISTIC => 'Балістика',
            self::AIR => 'Тривога',
            self::ARTILLERY => 'Артобстріл',
            self::URBAN_FIGHTS => 'Бої',
            self::UAV => 'БпЛА',
            self::CLEAR => 'Спокійно',
            self::NO_DATA => 'Невідомо',
        };
    }

    /** Іконка Lucide (kebab-case). */
    public function icon(): string
    {
        return match ($this) {
            self::NUCLEAR => 'radiation',
            self::CHEMICAL => 'biohazard',
            self::BALLISTIC => 'flame',
            self::AIR => 'siren',
            self::ARTILLERY => 'bomb',
            self::URBAN_FIGHTS => 'swords',
            self::UAV => 'plane',
            self::CLEAR => 'shield-check',
            self::NO_DATA => 'help-circle',
        };
    }

    /**
     * Палітра під темне скло; для AIR — за масштабом.
     *
     * @return array{hex: string, fill: string, border: string, text: string}
     */
    public function colors(?AlertScale $scale = null): array
    {
        if ($this === self::AIR && $scale !== null) {
            return $scale->colors();
        }

        return match ($this) {
            self::NUCLEAR => ['hex' => '#9333EA', 'fill' => 'rgba(147, 51, 234, 0.34)', 'border' => 'rgba(192, 132, 252, 0.55)', 'text' => '#C084FC'],
            self::CHEMICAL => ['hex' => '#84CC16', 'fill' => 'rgba(132, 204, 22, 0.30)', 'border' => 'rgba(163, 230, 53, 0.52)', 'text' => '#A3E635'],
            self::BALLISTIC => ['hex' => '#BE123C', 'fill' => 'rgba(190, 18, 60, 0.44)', 'border' => 'rgba(251, 113, 133, 0.65)', 'text' => '#FDA4AF'],
            self::AIR => AlertScale::OBLAST->colors(),
            self::ARTILLERY => ['hex' => '#F97316', 'fill' => 'rgba(249, 115, 22, 0.32)', 'border' => 'rgba(251, 146, 60, 0.52)', 'text' => '#FB923C'],
            self::URBAN_FIGHTS => ['hex' => '#EA580C', 'fill' => 'rgba(234, 88, 12, 0.35)', 'border' => 'rgba(249, 115, 22, 0.55)', 'text' => '#F97316'],
            self::UAV => ['hex' => '#F59E0B', 'fill' => 'rgba(245, 158, 11, 0.26)', 'border' => 'rgba(251, 191, 36, 0.48)', 'text' => '#FBBF24'],
            self::CLEAR => ['hex' => '#10B981', 'fill' => 'rgba(16, 185, 129, 0.14)', 'border' => 'rgba(52, 211, 153, 0.35)', 'text' => '#34D399'],
            self::NO_DATA => ['hex' => '#475569', 'fill' => 'rgba(71, 85, 105, 0.28)', 'border' => 'rgba(100, 116, 139, 0.40)', 'text' => '#94A3B8'],
        };
    }

    /**
     * Головна тривога серед кількох — з найвищим пріоритетом.
     *
     * @param  iterable<self>  $types
     */
    public static function primary(iterable $types): self
    {
        $best = self::CLEAR;
        foreach ($types as $type) {
            if ($type->priority() > $best->priority()) {
                $best = $type;
            }
        }

        return $best;
    }

    /**
     * Від найважливішої до найменш важливої, без повторів.
     *
     * @param  iterable<self>  $types
     * @return list<self>
     */
    public static function sorted(iterable $types): array
    {
        $unique = [];
        foreach ($types as $type) {
            $unique[$type->value] = $type;
        }
        $list = array_values($unique);
        usort($list, fn (self $a, self $b) => $b->priority() <=> $a->priority());

        return $list;
    }
}
