# Геодані мапи тривог

- `ukraine-outline.json` — контур України з Кримом (world-atlas / Natural Earth, суспільне надбання).
- `ua-units.json` (райони, м. Київ, м. Севастополь і межі областей), `ua-hromadas.json` (громади) — спрощені межі
  з [alexbabintsev/ua-geo](https://github.com/alexbabintsev/ua-geo): реєстр КАТОТТГ (Мінрозвитку, відкриті дані)
    - межі з OpenStreetMap. **© учасники OpenStreetMap, ODbL 1.0** — ці файли (похідна база даних) поширюються
      на умовах ODbL; підпис «© OpenStreetMap» показується на мапі.
- `chez` у `ua-units.json` — Чорнобильська зона відчуження: Вишгородський район мінус його громади.
- Сервер: `app/Services/Alerts/units.json` — код КАТОТТГ → [назва, рівень, область, район].

Проєкція: lng 22.0–40.4, lat 44.2–52.5 → 1000×680 (як `project()` у `components/alerts/alert-map.tsx`).
