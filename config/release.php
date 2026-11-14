<?php

/*
 * Версія сайту у форматі Г.YYMM.Y.X — обчислюється сама з журналу релізів нижче:
 *  Г    — покоління сайту (1 — поточне, публічне API /api/v1);
 *  YYMM — місяць ОСТАННЬОГО релізу: до першого релізу нового місяця лишається попередній;
 *  Y.X  — номер релізу в цьому місяці: X росте з кожним релізом, на 10 переходить у Y (Y + 1),
 *         а X знову 0 (…0.9 → …1.0); новий місяць починається з 0.0.
 * Новий реліз — новий рядок у $releases (або `node scripts/version.mjs site --write`).
 * Кодова назва — сузір'я, задається на релізі з нововведеннями; без неї діє попередня.
 */
$generation = 1;

/** @var array<string, array{0: string, 1: string}|null> $releases дата релізу => [кодова назва, пояснення] */
$releases = [
    '2026-11-01' => null,
    '2026-11-06' => null,
    '2026-11-14' => ['Lyra', 'Сузір’я Ліри з яскравою Вегою — одна з перших зірок, що видно влітку над Україною'],
];

ksort($releases);
$dates = array_keys($releases);
$last = (string) end($dates);
$month = substr($last, 2, 2).substr($last, 5, 2);
$number = count(array_filter($dates, fn (string $date) => substr($date, 0, 7) === substr($last, 0, 7))) - 1;
$named = array_values(array_filter($releases));
$codename = $named === [] ? ['GameCon', ''] : end($named);

return [
    'version' => sprintf('%d.%s.%d.%d', $generation, $month, intdiv($number, 10), $number % 10),
    'codename' => $codename[0],
    // Пояснення до кодової назви (українською, показується в «Що нового» й довідці).
    'codename_note' => $codename[1],
    'date' => $last,
];
