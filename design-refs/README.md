# Design references

## awesome-design-md

Vendored brand `DESIGN.md` specs from
[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)
(84 brands).

```
design-refs/awesome-design-md/apple/DESIGN.md
design-refs/awesome-design-md/nike/DESIGN.md
design-refs/awesome-design-md/spotify/DESIGN.md
design-refs/awesome-design-md/spacex/DESIGN.md
…
```

Usage for agents and humans: put the brand file in context and ask to build or
restyle **in that style**. GameCon’s own system stays in `/DESIGN.md`.

Refresh:

```bash
git clone --depth 1 https://github.com/VoltAgent/awesome-design-md.git /tmp/awesome-design-md
rsync -a --delete /tmp/awesome-design-md/design-md/ design-refs/awesome-design-md/
```

## Related skills

- `.claude/skills/design-taste-frontend` — taste / anti-slop frontend
- `.claude/skills/open-design` — Open Design catalogue binder
- `.open-design.json` — active OD binding for this repo
