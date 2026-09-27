import os, re, json
keys = set()
STR = r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\""
def unq(m): 
    v = m.group(1) if m.group(1) is not None else m.group(2)
    return v.replace("\\'", "'").replace('\\"', '"')
CYR = re.compile('[А-Яа-яЁё]')
def walk(root, exts):
    for dp, _, fs in os.walk(root):
        if 'node_modules' in dp or 'dist' in dp: continue
        for f in fs:
            if f.endswith(exts): yield os.path.join(dp, f)
# client
for p in walk('client/src', ('.ts', '.tsx')):
    s = open(p).read()
    for m in re.finditer(r"\btr\(\s*(?:" + STR + ")", s): keys.add(unq(m))
    for m in re.finditer(r"\b(?:tp|countLabel|plural)\([^,]+,\s*(?:" + STR + ")", s): keys.add(unq(m))
# plural keys given as plain literals to BarChart / SERIES
for p in walk('client/src', ('.tsx',)):
    s = open(p).read()
    for m in re.finditer(r"'([^'\n]*[А-Яа-яЁё][^'\n]*\|[^'\n]*)'", s): keys.add(m.group(1))
# server
for p in walk('server/src', ('.js',)):
    if p.endswith(('seed.js', 'demoAudio.js')): continue
    s = open(p).read()
    for m in re.finditer(r"\b(?:fail\(\s*\d+,\s*|need\(\s*req,\s*'[a-z_]+',\s*|translate\(\s*|system\([^,]+,[^,]+,\s*(?:leaving \? )?)(?:" + STR + ")", s): keys.add(unq(m))
    for m in re.finditer(r"leaving \? '[^']+' : '([^']+)'|role === 'admin' \? '[^']+' : '([^']+)'", s):
        keys.add(m.group(1) or m.group(2))
    for m in re.finditer(r"role === 'admin' \? '([^']+)'", s): keys.add(m.group(1))
    for m in re.finditer(r"new Error\((?:" + STR + ")", s): keys.add(unq(m))
# report categories, resolutions, default levels
s = open('server/src/api.js').read()
cats = re.search(r"REPORT_CATEGORIES = \{([^}]*)\}", s).group(1)
for m in re.finditer(r":\s*'([^']+)'", cats): keys.add(m.group(1))
for w in ['контент удалён', 'автор заблокирован', 'отклонена']: keys.add(w)
d = open('server/src/db.js').read()
for m in re.finditer(r"ins\.run\('([^']+)', '([^']+)'", d): keys.add(m.group(1)); keys.add(m.group(2))
keys = sorted(k for k in keys if CYR.search(k))
base = set(json.load(open('locales/src/_keys.v1.json')))
new = [k for k in keys if k not in base]
json.dump(new, open('locales/src/_keys.new.json', 'w'), ensure_ascii=False, indent=1)
print(len(keys), 'keys total,', len(new), 'not in _keys.v1.json (see locales/src/_keys.new.json)')
