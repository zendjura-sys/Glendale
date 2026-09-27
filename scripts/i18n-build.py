"""Builds locales/<lang>.json from translation sources in locales/src/:
  <lang>.txt        "index<TAB>translation" lines aligned with _keys.v1.json (the first batch of keys)
  <lang>.extra.txt  "source<TAB>translation" lines for keys added later (optional)

Checks: every key translated, same {placeholders} as the source, plural keys keep the "|" form separator.
Usage: python3 scripts/i18n-build.py uk en ...
"""
import json, re, sys

keys = json.load(open('locales/src/_keys.v1.json'))
ph = lambda s: sorted(re.findall(r'\{(\w+)\}', s))
ok = True
for lang in sys.argv[1:]:
    rows = {}
    for n, line in enumerate(open(f'locales/src/{lang}.txt', encoding='utf8'), 1):
        line = line.rstrip('\n')
        if not line.strip():
            continue
        idx, _, text = line.partition('\t')
        rows[int(idx)] = text
    out, problems = {}, []
    for i, k in enumerate(keys):
        if i not in rows:
            problems.append(f'missing #{i} {k!r}')
            continue
        v = rows[i]
        if ph(v) != ph(k):
            problems.append(f'#{i} placeholders {ph(k)} != {ph(v)}: {v!r}')
        if '|' in k and '|' not in v and lang not in ('zh', 'ja'):
            problems.append(f'#{i} plural forms missing: {v!r}')
        out[k] = v
    try:
        for line in open(f'locales/src/{lang}.extra.txt', encoding='utf8'):
            line = line.rstrip('\n')
            if not line.strip():
                continue
            k, _, v = line.partition('\t')
            if ph(v) != ph(k):
                problems.append(f'extra {k!r} placeholders differ: {v!r}')
            out[k] = v
    except FileNotFoundError:
        pass
    extra = sorted(set(rows) - set(range(len(keys))))
    if extra:
        problems.append(f'extra rows {extra}')
    for p in problems:
        print(lang, p)
    ok &= not problems
    json.dump(out, open(f'locales/{lang}.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1, sort_keys=True)
    print(lang, len(out), 'keys', 'OK' if not problems else f'{len(problems)} problems')
sys.exit(0 if ok else 1)
