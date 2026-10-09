// Одноразовий кодмод: обгортає український текст у TSX/TS у tr() з '@/lib/i18n'.
// Запуск: node scripts/i18n/wrap-web.mjs [файли…] (без аргументів — уся resources/js).
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const CYR = /[А-Яа-яЁёІіЇїЄєҐґ’]/;
const ROOT = 'resources/js';
const SKIP_DIRS = [
    'resources/js/routes',
    'resources/js/actions',
    'resources/js/wayfinder',
    'resources/js/types',
];
const SKIP_FILES = ['resources/js/lib/i18n.ts'];
// Виклики, аргументи яких не перекладаємо (порівняння, пошук, вже перекладене, множина).
const SKIP_CALLS = new Set([
    'tr',
    'plural',
    'pluralForm',
    'includes',
    'startsWith',
    'endsWith',
    'indexOf',
    'lastIndexOf',
    'replace',
    'replaceAll',
    'split',
    'match',
    'test',
    'RegExp',
    'log',
    'warn',
    'error',
    'info',
    'debug',
    'has',
    'get',
    'set',
    'delete',
    'getItem',
    'setItem',
    'removeItem',
    'querySelector',
    'querySelectorAll',
    'localeCompare',
]);
const COMPARE = new Set([
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
]);

function walk(dir, out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (!SKIP_DIRS.includes(p)) walk(p, out);
        } else if (
            /\.(tsx?|ts)$/.test(e.name) &&
            !e.name.endsWith('.d.ts') &&
            !SKIP_FILES.includes(p)
        ) {
            out.push(p);
        }
    }
    return out;
}

const quote = (s) =>
    "'" +
    s
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t') +
    "'";

/** Текст JSX за правилами React: рядки обрізаються, порожні викидаються, з’єднуються пробілом. */
function cleanJsx(raw) {
    const lines = raw.split(/\r\n|\n|\r/);
    let last = 0;
    lines.forEach((l, i) => {
        if (/[^ \t]/.test(l)) last = i;
    });
    let str = '';
    lines.forEach((line, i) => {
        let t = line.replace(/\t/g, ' ');
        if (i !== 0) t = t.replace(/^[ ]+/, '');
        if (i !== lines.length - 1) t = t.replace(/[ ]+$/, '');
        if (t) {
            if (i !== last) t += ' ';
            str += t;
        }
    });
    return str;
}

function calleeName(call) {
    const e = call.expression;
    if (ts.isIdentifier(e)) return e.text;
    if (ts.isPropertyAccessExpression(e)) return e.name.text;
    return null;
}

function skipLiteral(node) {
    const p = node.parent;
    if (!p) return true;
    if (
        ts.isImportDeclaration(p) ||
        ts.isExportDeclaration(p) ||
        ts.isExternalModuleReference(p)
    )
        return true;
    if (ts.isLiteralTypeNode(p)) return true;
    if (
        (ts.isPropertyAssignment(p) ||
            ts.isPropertySignature(p) ||
            ts.isMethodDeclaration(p) ||
            ts.isPropertyDeclaration(p) ||
            ts.isEnumMember(p)) &&
        p.name === node
    )
        return true;
    if (ts.isElementAccessExpression(p) && p.argumentExpression === node)
        return true;
    if (ts.isBinaryExpression(p) && COMPARE.has(p.operatorToken.kind))
        return true;
    if (ts.isCaseClause(p)) return true;
    if (ts.isJsxAttribute(p)) {
        const n = p.name.getText();
        if (
            n === 'key' ||
            n === 'className' ||
            n === 'href' ||
            (n === 'value' && false)
        )
            return true;
    }
    // Аргумент «службового» виклику або всередині tr()/plural().
    let cur = node;
    while (cur.parent && !ts.isSourceFile(cur.parent)) {
        const par = cur.parent;
        if (ts.isCallExpression(par) && par.arguments.includes(cur)) {
            const name = calleeName(par);
            const consoleCall =
                ts.isPropertyAccessExpression(par.expression) &&
                par.expression.expression.getText() === 'console';
            if (
                consoleCall ||
                (name &&
                    SKIP_CALLS.has(name) &&
                    !['log', 'warn', 'error', 'info', 'debug'].includes(name))
            )
                return true;
            break;
        }
        if (ts.isNewExpression(par) && par.expression.getText() === 'RegExp')
            return true;
        // Масив форм множини: plural(n, ['a','b','c']) — дивимось через масив.
        if (
            ts.isArrayLiteralExpression(par) ||
            ts.isAsExpression(par) ||
            ts.isParenthesizedExpression(par)
        ) {
            cur = par;
            continue;
        }
        break;
    }
    // Масиви, які порівнюють: ['Українська'].includes(x)
    if (
        ts.isArrayLiteralExpression(p) &&
        ts.isPropertyAccessExpression(p.parent) &&
        ['includes', 'indexOf'].includes(p.parent.name.text)
    )
        return true;
    return false;
}

function placeholderName(expr, used) {
    let base = 'v';
    let e = expr;
    while (
        ts.isParenthesizedExpression(e) ||
        ts.isNonNullExpression(e) ||
        ts.isAsExpression(e)
    )
        e = e.expression;
    if (ts.isIdentifier(e)) base = e.text;
    else if (ts.isPropertyAccessExpression(e)) base = e.name.text;
    else if (ts.isCallExpression(e)) {
        const n = calleeName(e);
        if (n && /^[a-z]\w*$/i.test(n)) base = n;
    }
    if (!/^\w+$/.test(base)) base = 'v';
    let name = base;
    let i = 2;
    while (used.has(name)) name = base + i++;
    used.add(name);
    return name;
}

function transform(file) {
    const src = fs.readFileSync(file, 'utf8');
    if (!CYR.test(src)) return 0;
    const sf = ts.createSourceFile(
        file,
        src,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const edits = [];

    const visit = (node) => {
        if (ts.isJsxText(node)) {
            const raw = node.getFullText();
            if (CYR.test(raw)) {
                const clean = cleanJsx(raw);
                const core = clean.trim();
                if (core) {
                    const lead = /^\s/.test(clean) ? "{' '}" : '';
                    const trail = /\s$/.test(clean) ? "{' '}" : '';
                    edits.push([
                        node.pos,
                        node.end,
                        `${lead}{tr(${quote(core)})}${trail}`,
                    ]);
                }
            }
            return;
        }
        if (
            (ts.isStringLiteral(node) ||
                ts.isNoSubstitutionTemplateLiteral(node)) &&
            CYR.test(node.text)
        ) {
            if (!skipLiteral(node)) {
                const p = node.parent;
                const text =
                    node.text.trim() === node.text ? node.text : node.text;
                if (ts.isJsxAttribute(p))
                    edits.push([
                        node.getStart(sf),
                        node.end,
                        `{tr(${quote(text)})}`,
                    ]);
                else
                    edits.push([
                        node.getStart(sf),
                        node.end,
                        `tr(${quote(text)})`,
                    ]);
            }
            return;
        }
        if (
            ts.isTemplateExpression(node) &&
            !ts.isTaggedTemplateExpression(node.parent)
        ) {
            const parts = [
                node.head.text,
                ...node.templateSpans.map((s) => s.literal.text),
            ];
            if (parts.some((t) => CYR.test(t)) && !skipLiteral(node)) {
                // Спочатку перетворюємо вкладене, потім збираємо ключ із тексту виразів після правок.
                const used = new Set();
                let key = node.head.text;
                const params = [];
                for (const span of node.templateSpans) {
                    const name = placeholderName(span.expression, used);
                    const exprText = applyNested(span.expression);
                    params.push(
                        name === exprText ? name : `${name}: ${exprText}`,
                    );
                    key += `{${name}}` + span.literal.text;
                }
                const call = `tr(${quote(key)}, { ${params.join(', ')} })`;
                edits.push([
                    node.getStart(sf),
                    node.end,
                    ts.isJsxExpression(node.parent) ||
                    !ts.isJsxAttribute(node.parent)
                        ? call
                        : `{${call}}`,
                ]);
                return;
            }
        }
        ts.forEachChild(node, visit);
    };

    // Вкладені правки всередині виразу шаблону: застосовуємо локально й не дублюємо.
    function applyNested(expr) {
        const start = expr.getStart(sf);
        const before = edits.length;
        ts.forEachChild(expr, visit);
        if (
            ts.isStringLiteral(expr) ||
            ts.isTemplateExpression(expr) ||
            ts.isNoSubstitutionTemplateLiteral(expr)
        )
            visit(expr);
        const inner = edits.splice(before).sort((a, b) => b[0] - a[0]);
        let text = src.slice(start, expr.end);
        for (const [s, e, r] of inner)
            text = text.slice(0, s - start) + r + text.slice(e - start);
        return text;
    }

    visit(sf);
    if (edits.length === 0) return 0;
    edits.sort((a, b) => b[0] - a[0]);
    let out = src;
    for (const [s, e, r] of edits) out = out.slice(0, s) + r + out.slice(e);

    if (!/import \{[^}]*\btr\b[^}]*\} from '@\/lib\/i18n'/.test(out)) {
        if (/import \{([^}]*)\} from '@\/lib\/i18n';/.test(out)) {
            out = out.replace(
                /import \{([^}]*)\} from '@\/lib\/i18n';/,
                (m, names) =>
                    `import { ${names.trim()}, tr } from '@/lib/i18n';`,
            );
        } else {
            const sf2 = ts.createSourceFile(
                file,
                out,
                ts.ScriptTarget.Latest,
                true,
                file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
            );
            const imports = sf2.statements.filter((s) =>
                ts.isImportDeclaration(s),
            );
            const at = imports.length ? imports[imports.length - 1].end : 0;
            out =
                out.slice(0, at) +
                (at ? '\n' : '') +
                "import { tr } from '@/lib/i18n';" +
                (at ? '' : '\n') +
                out.slice(at);
        }
    }
    fs.writeFileSync(file, out);
    return edits.length;
}

const files = process.argv.length > 2 ? process.argv.slice(2) : walk(ROOT);
let total = 0;
for (const f of files) {
    const n = transform(f);
    if (n) {
        total += n;
    }
}
console.log(`wrapped ${total} strings in ${files.length} files`);
