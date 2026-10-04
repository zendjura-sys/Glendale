#!/usr/bin/env python3
"""Одноразовий кодмод: обгортає український текст у Dart (mobile/lib) у tr() з i18n.dart.
Потім: python3 scripts/i18n/wrap-dart.py --fix — прибирає const, що заважають, за помилками flutter analyze."""
import json, os, re, subprocess, sys

CYR = re.compile(r'[А-Яа-яЁёІіЇїЄєҐґ]')
LIB = 'mobile/lib'
SKIP_FILES = {'i18n.dart'}
SKIP_CALLS = {'tr', 'plural', 'contains', 'startsWith', 'endsWith', 'split', 'replaceAll', 'replaceFirst', 'indexOf', 'lastIndexOf', 'RegExp', 'debugPrint', 'print', 'getString', 'setString', 'remove', 'containsKey', 'hasMatch', 'firstMatch', 'allMatches', 'ValueKey', 'Key', 'PageStorageKey', 'channel', 'invokeMethod', 'MethodChannel'}


def scan(src):
    """Повертає список рядкових літералів: dict(start, end, raw, parts=[('t', text)|('e', src)])."""
    out = []
    i, n = 0, len(src)
    while i < n:
        c = src[i]
        if src.startswith('//', i):
            j = src.find('\n', i)
            i = n if j < 0 else j
            continue
        if src.startswith('/*', i):
            j = src.find('*/', i + 2)
            i = n if j < 0 else j + 2
            continue
        if c in '\'"' or (c in 'rR' and i + 1 < n and src[i + 1] in '\'"' and (i == 0 or not (src[i - 1].isalnum() or src[i - 1] == '_'))):
            lit, j = read_string(src, i)
            out.append(lit)
            i = j
            continue
        i += 1
    return out


def read_string(src, i):
    start = i
    raw = False
    if src[i] in 'rR':
        raw = True
        i += 1
    q = src[i]
    triple = src.startswith(q * 3, i)
    delim = q * 3 if triple else q
    i += len(delim)
    parts = []
    buf = []
    n = len(src)
    while i < n:
        if src.startswith(delim, i):
            i += len(delim)
            break
        c = src[i]
        if not raw and c == '\\' and i + 1 < n:
            nxt = src[i + 1]
            buf.append({'n': '\n', 't': '\t', 'r': '\r', '\\': '\\', "'": "'", '"': '"', '$': '$'}.get(nxt, '\\' + nxt))
            i += 2
            continue
        if not raw and c == '$' and i + 1 < n:
            if src[i + 1] == '{':
                depth = 1
                j = i + 2
                while j < n and depth:
                    ch = src[j]
                    if ch in '\'"':
                        _, j = read_string(src, j)
                        continue
                    if ch == '{':
                        depth += 1
                    elif ch == '}':
                        depth -= 1
                    j += 1
                if buf:
                    parts.append(('t', ''.join(buf)))
                    buf = []
                parts.append(('e', src[i + 2:j - 1]))
                i = j
                continue
            m = re.match(r'[A-Za-z_]\w*', src[i + 1:])
            if m:
                if buf:
                    parts.append(('t', ''.join(buf)))
                    buf = []
                parts.append(('e', m.group(0)))
                i += 1 + len(m.group(0))
                continue
        buf.append(c)
        i += 1
    if buf:
        parts.append(('t', ''.join(buf)))
    return {'start': start, 'end': i, 'raw': raw, 'parts': parts, 'triple': triple}, i


def enc(text):
    return "'" + text.replace('\\', '\\\\').replace("'", "\\'").replace('$', '\\$').replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t') + "'"


def prev_sig(src, pos):
    k = pos - 1
    while k >= 0 and src[k] in ' \t\r\n':
        k -= 1
    return src[max(0, k - 12):k + 1]


def next_sig(src, pos):
    k = pos
    while k < len(src) and src[k] in ' \t\r\n':
        k += 1
    return src[k:k + 3]


def enclosing_call(src, pos, mask):
    depth = 0
    k = pos - 1
    while k >= 0:
        if mask[k]:
            k -= 1
            continue
        ch = src[k]
        if ch in ')]}':
            depth += 1
        elif ch in '([{':
            if depth == 0:
                if ch != '(':
                    if ch == '[':
                        k -= 1
                        continue
                    return None
                m = re.search(r'([A-Za-z_]\w*)\s*(<[^>]*>)?\s*$', src[max(0, k - 60):k])
                return m.group(1) if m else None
            depth -= 1
        elif ch == ';' and depth == 0:
            return None
        k -= 1
    return None


def name_for(expr, used):
    e = expr.strip()
    m = re.search(r'([A-Za-z_]\w*)\s*(\(\))?\s*[!?]?$', e)
    base = m.group(1) if m and re.fullmatch(r"[\w.?!\[\]'()]+", e) else 'v'
    if base in ('length', 'toString', 'value', 'text'):
        base = 'v'
    name, i = base, 2
    while name in used:
        name, i = f'{base}{i}', i + 1
    used.add(name)
    return name


def transform(path):
    src = open(path, encoding='utf-8').read()
    if not CYR.search(src):
        return 0
    lits = scan(src)
    mask = [False] * len(src)
    for l in lits:
        for k in range(l['start'], l['end']):
            mask[k] = True
    # Склеювання сусідніх літералів: 'a' 'b'.
    groups = []
    for l in lits:
        if groups and re.fullmatch(r'\s*', src[groups[-1][-1]['end']:l['start']]):
            groups[-1].append(l)
        else:
            groups.append([l])
    edits = []
    for g in groups:
        parts = [p for l in g for p in l['parts']]
        text = ''.join(p[1] for p in parts if p[0] == 't')
        if not CYR.search(text) or any(l['raw'] for l in g):
            continue
        start, end = g[0]['start'], g[-1]['end']
        before, after = prev_sig(src, start), next_sig(src, end)
        if re.search(r'(==|!=|case|import|export|part)$', before) or after.startswith(('==', '!=')):
            continue
        if after.startswith(':') and re.search(r'[{,]$', before):
            continue
        if after.startswith('=>') and re.search(r'[(,{]$|case$', before):
            continue
        call = enclosing_call(src, start, mask)
        if call in SKIP_CALLS:
            continue
        used, key, params = set(), '', []
        for kind, val in parts:
            if kind == 't':
                key += val.replace('{', '{{').replace('}', '}}') if False else val
            else:
                nm = name_for(val, used)
                key += '{' + nm + '}'
                params.append(f"'{nm}': {val.strip()}")
        call_src = f"tr({enc(key)}" + (", {" + ', '.join(params) + "})" if params else ')')
        edits.append((start, end, call_src))
    if not edits:
        return 0
    for s, e, r in sorted(edits, reverse=True):
        src = src[:s] + r + src[e:]
    if "import 'i18n.dart';" not in src:
        imports = list(re.finditer(r"^import [^\n]+;\n", src, re.M))
        at = imports[-1].end() if imports else 0
        src = src[:at] + "import 'i18n.dart';\n" + src[at:]
    open(path, 'w', encoding='utf-8').write(src)
    return len(edits)


def fix():
    """Прибирає const навколо tr() за помилками аналізатора; дефолтні значення параметрів повертає як були."""
    for rnd in range(40):
        res = subprocess.run(['../../flutter/bin/flutter', 'analyze', '--no-pub', '--no-fatal-infos', '--no-fatal-warnings'], cwd='mobile', capture_output=True, text=True)
        errs = re.findall(r'error • (.*?) • (lib/[\w/]+\.dart):(\d+):(\d+) • (\w+)', res.stdout)
        if not errs:
            print('analyze OK after', rnd, 'rounds')
            return
        fixed = 0
        by_file = {}
        for msg, f, line, col, code in errs:
            by_file.setdefault(f, []).append((int(line), int(col), code, msg))
        for f, items in by_file.items():
            p = os.path.join('mobile', f)
            src = open(p, encoding='utf-8').read()
            lines = src.split('\n')
            offs = [0]
            for l in lines:
                offs.append(offs[-1] + len(l) + 1)
            done = set()
            for line, col, code, msg in sorted(items, reverse=True):
                pos = offs[line - 1] + col - 1
                if code == 'non_constant_default_value':
                    m = re.match(r"tr\('((?:[^'\\]|\\.)*)'\)", src[pos:])
                    if m:
                        src = src[:pos] + "'" + m.group(1) + "'" + src[pos + m.end():]
                        fixed += 1
                    continue
                if 'const' not in code and code not in ('invalid_constant',):
                    continue
                # Найближчий const ліворуч.
                k = src.rfind('const', 0, pos + 1)
                while k >= 0 and not (re.match(r'const\b', src[k:]) and (k == 0 or not (src[k - 1].isalnum() or src[k - 1] == '_'))):
                    k = src.rfind('const', 0, k)
                if k < 0 or k in done:
                    continue
                # Оголошення const-конструктора (const Name({this.x…})) не чіпаємо.
                decl = re.match(r'const\s+\w+(\.\w+)?\s*\(([^()]*)', src[k:])
                if decl and re.search(r'\bthis\.|\bsuper\.|\{\s*required\b', decl.group(2) or ''):
                    continue
                done.add(k)
                line_start = src.rfind('\n', 0, k) + 1
                prefix = src[line_start:k]
                if re.fullmatch(r'\s*(static\s+)?', prefix) and re.match(r'const\s+(\w+\s+)?\w+\s*=', src[k:]):
                    src = src[:k] + 'final' + src[k + 5:]
                else:
                    src = src[:k] + src[k + 5:].lstrip(' ') if src[k + 5:k + 6] == ' ' else src[:k] + src[k + 5:]
                fixed += 1
            open(p, 'w', encoding='utf-8').write(src)
        if not fixed:
            print('unfixable errors:')
            print('\n'.join(f'{f}:{l}:{c} {code} {m}' for m, f, l, c, code in errs[:40]))
            return
    print('gave up')


if __name__ == '__main__':
    if '--fix' in sys.argv:
        fix()
    else:
        total = 0
        for root, _, files in os.walk(LIB):
            for f in files:
                if f.endswith('.dart') and f not in SKIP_FILES:
                    total += transform(os.path.join(root, f))
        print('wrapped', total)
