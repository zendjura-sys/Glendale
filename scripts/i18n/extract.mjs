// Каталог перекладів lang/catalog.json: усі українські рядки сайту (tr(), plural()),
// сервера (scripts/i18n/extract-php.php) і застосунку (tr() у mobile/lib).
// node scripts/i18n/extract.mjs — оновити; --check — перевірка в CI, що каталог актуальний.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const OUT = 'lang/catalog.json';

function walk(dir, test, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, test, out);
        else if (test(p)) out.push(p);
    }
    return out;
}

function webKeys() {
    const keys = new Set();
    for (const file of walk(
        'resources/js',
        (p) => /\.tsx?$/.test(p) && !p.endsWith('.d.ts'),
    )) {
        const src = fs.readFileSync(file, 'utf8');
        if (!src.includes('tr(') && !src.includes('plural(')) continue;
        const sf = ts.createSourceFile(
            file,
            src,
            ts.ScriptTarget.Latest,
            true,
            file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
        const visit = (node) => {
            if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
                const name = node.expression.text;
                const [first, second] = node.arguments;
                if (
                    name === 'tr' &&
                    first &&
                    (ts.isStringLiteral(first) ||
                        ts.isNoSubstitutionTemplateLiteral(first))
                ) {
                    keys.add(first.text);
                }
                if (
                    (name === 'plural' || name === 'pluralForm') &&
                    second &&
                    ts.isArrayLiteralExpression(second)
                ) {
                    const forms = second.elements
                        .filter((e) => ts.isStringLiteral(e))
                        .map((e) => e.text);
                    if (forms.length === 3) keys.add(forms.join('|'));
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sf);
    }
    return [...keys];
}

function serverKeys() {
    const out = execFileSync(
        'php',
        ['scripts/i18n/extract-php.php', 'app', 'routes', 'lang/uk'],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    const keys = new Set(JSON.parse(out));
    // Шаблони листів: $t('…') у Blade.
    for (const file of walk('resources/views', (p) =>
        p.endsWith('.blade.php'),
    )) {
        const src = fs.readFileSync(file, 'utf8');
        for (const m of src.matchAll(/\$t\('((?:[^'\\]|\\.)*)'/g))
            keys.add(m[1].replace(/\\(.)/g, '$1'));
    }
    return [...keys];
}

function appKeys() {
    const keys = new Set();
    for (const file of walk('mobile/lib', (p) => p.endsWith('.dart'))) {
        const src = fs.readFileSync(file, 'utf8');
        for (const m of src.matchAll(/\btr\(\s*'((?:[^'\\]|\\.)*)'/g))
            keys.add(m[1].replace(/\\(.)/g, '$1'));
        for (const m of src.matchAll(
            /\bplural\(\s*[^,]+,\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'/g,
        )) {
            keys.add(
                [m[1], m[2], m[3]]
                    .map((s) => s.replace(/\\(.)/g, '$1'))
                    .join('|'),
            );
        }
    }
    return [...keys];
}

const sort = (list) =>
    [...new Set(list)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const catalog = {
    web: sort(webKeys()),
    server: sort(serverKeys()),
    app: sort(appKeys()),
};
const json = JSON.stringify(catalog, null, 1) + '\n';

if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (current !== json) {
        console.error(
            'lang/catalog.json застарів: запустіть node scripts/i18n/extract.mjs',
        );
        process.exit(1);
    }
    console.log('catalog OK');
} else {
    fs.writeFileSync(OUT, json);
    console.log(
        `web ${catalog.web.length}, server ${catalog.server.length}, app ${catalog.app.length}`,
    );
}
