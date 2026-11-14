# Увійти через GameCon — Discourse

1. У `containers/app.yml` додайте до `hooks.after_code`:

```yaml
hooks:
  after_code:
    - exec:
        cd: $home/plugins
        cmd:
          - wget -qO gamecon.zip https://gamecon.online/developers/plugins/discourse/download && unzip -oq gamecon.zip && rm gamecon.zip
```

2. `./launcher rebuild app`
3. На GameCon: Розробникам → Новий застосунок, адреса повернення `https://ваш-форум/auth/gamecon/callback`.
4. Адмінка → Налаштування → Плагіни: Client ID, Secret, увімкніть `gamecon login enabled`.
