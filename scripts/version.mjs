#!/usr/bin/env node
// Версії GameCon у форматі Г.YYMM.Y.X (сайт і застосунок однаково).
//  YYMM змінюється сам на першому оновленні нового місяця, до того лишається попередній;
//  Y.X — лічильник оновлень місяця: X до 9, далі Y + 1 і X = 0; новий місяць — з 0.0.
//
//  node scripts/version.mjs next 1.2611.0.9            → 1.2611.1.0 (у листопаді 2026)
//  node scripts/version.mjs app [--write] [--date=YYYY-MM-DD]
//      наступна версія застосунку з mobile/pubspec.yaml (gamecon_version); --write записує її
//      й піднімає номер збірки (+N) — це запускає збірку застосунку, тож лише за командою.
//  node scripts/version.mjs site [--write] [--date=YYYY-MM-DD]
//      новий реліз сайту: дата в журналі config/release.php, версію сайт рахує сам.
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const today = flag('date') ?? new Date().toISOString().slice(0, 10);
const yymm = today.slice(2, 4) + today.slice(5, 7);

export function nextVersion(current, date = today) {
    const [g, month, y, x] = String(current).split('.').map((p) => p.trim());
    const generation = Number(g) || 1;
    const now = date.slice(2, 4) + date.slice(5, 7);
    if (month !== now) return `${generation}.${now}.0.0`;
    const n = (Number(y) || 0) * 10 + (Number(x) || 0) + 1;
    return `${generation}.${now}.${Math.floor(n / 10)}.${n % 10}`;
}

const [command, value] = args;
const write = args.includes('--write');

if (command === 'next') {
    console.log(nextVersion(value));
} else if (command === 'app') {
    const path = 'mobile/pubspec.yaml';
    let pubspec = readFileSync(path, 'utf8');
    const current = pubspec.match(/^gamecon_version:\s*(\S+)/m)?.[1] ?? `1.${yymm}.0.0`;
    const next = pubspec.match(/^gamecon_version:/m) ? nextVersion(current) : `1.${yymm}.0.0`;
    console.log(next);
    if (write) {
        pubspec = pubspec.match(/^gamecon_version:/m)
            ? pubspec.replace(/^gamecon_version:.*$/m, `gamecon_version: ${next}`)
            : pubspec.replace(/^(version:.*)$/m, `$1\ngamecon_version: ${next}`);
        pubspec = pubspec.replace(/^version:\s*([^+\s]+)\+(\d+)/m, (_, v, b) => `version: ${v}+${Number(b) + 1}`);
        writeFileSync(path, pubspec);
    }
} else if (command === 'site') {
    const path = 'config/release.php';
    const config = readFileSync(path, 'utf8');
    if (config.includes(`'${today}' =>`)) {
        console.log(`Реліз ${today} уже є в журналі.`);
    } else if (write) {
        writeFileSync(path, config.replace(/(\$releases = \[[\s\S]*?)(\n\];)/, `$1\n    '${today}' => null,$2`));
        console.log(`Додано реліз ${today}.`);
    } else {
        console.log(`Буде додано реліз ${today} (запустіть з --write).`);
    }
} else {
    console.log('Використання: node scripts/version.mjs next <версія> | app [--write] | site [--write] [--date=YYYY-MM-DD]');
}
