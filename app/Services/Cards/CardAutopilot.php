<?php

namespace App\Services\Cards;

use App\Models\CardCharacter;
use App\Models\Game;
use App\Models\User;
use App\Services\Ai\AiAssistant;
use App\Services\Ai\AiClient;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Автопілот колекційних карток: цілодобово, але лише коли на сайті тихо (нічні години або мало
 * людей онлайн), підтягує персонажів тайтлів, персонажів ігор (ІІ), ранги й тематичні набори.
 * ІІ-запити — в межах денного бюджету, щоб не вийти за безкоштовний ліміт провайдера.
 */
class CardAutopilot
{
    public const DEFAULTS = [
        'enabled' => true,
        // Години тиші за Києвом (від–до), коли робота йде без огляду на онлайн.
        'quiet_from' => 1,
        'quiet_to' => 7,
        // Поза тихими годинами — лише якщо онлайн менше за поріг.
        'online_below' => 30,
        // Скільки ІІ-запитів на добу можна витратити на картки.
        'ai_daily' => 60,
        // Загальний денний ліміт ІІ сайту (безкоштовний тариф), до якого автопілот не наближається.
        'ai_site_cap' => 300,
    ];

    public function __construct(private readonly SiteSettings $settings) {}

    /** @return array{enabled: bool, quiet_from: int, quiet_to: int, online_below: int, ai_daily: int, ai_site_cap: int} */
    public function config(): array
    {
        $stored = $this->settings->get('cards_autopilot');
        $c = [...self::DEFAULTS, ...(is_array($stored) ? $stored : [])];

        return [
            'enabled' => (bool) $c['enabled'],
            'quiet_from' => max(0, min(23, (int) $c['quiet_from'])),
            'quiet_to' => max(0, min(23, (int) $c['quiet_to'])),
            'online_below' => max(0, (int) $c['online_below']),
            'ai_daily' => max(0, (int) $c['ai_daily']),
            'ai_site_cap' => max(0, (int) $c['ai_site_cap']),
        ];
    }

    public function online(): int
    {
        return User::query()->where('last_seen_at', '>=', now()->subMinutes(5))->count();
    }

    /** Чи зараз тихо: тихі години або мало людей онлайн. */
    public function quiet(): bool
    {
        $c = $this->config();
        $hour = (int) now('Europe/Kyiv')->format('G');
        $inQuiet = $c['quiet_from'] <= $c['quiet_to']
            ? $hour >= $c['quiet_from'] && $hour < $c['quiet_to']
            : $hour >= $c['quiet_from'] || $hour < $c['quiet_to'];

        return $inQuiet || $this->online() < $c['online_below'];
    }

    public function aiUsedToday(): int
    {
        return (int) Cache::get('cards.ai.'.now()->format('Y-m-d'), 0);
    }

    /** Скільки ІІ-запитів ще можна витратити зараз. */
    public function aiLeft(): int
    {
        $c = $this->config();
        if (! app(AiClient::class)->configured()) {
            return 0;
        }

        return max(0, min($c['ai_daily'] - $this->aiUsedToday(), $c['ai_site_cap'] - app(AiClient::class)->today()));
    }

    public function spendAi(int $n = 1): void
    {
        $key = 'cards.ai.'.now()->format('Y-m-d');
        Cache::add($key, 0, now()->addDays(2));
        Cache::increment($key, $n);
    }

    /**
     * Один прохід. Повертає, що зроблено.
     *
     * @return array<string, int|string>
     */
    public function run(bool $force = false): array
    {
        $c = $this->config();
        if (! $c['enabled'] && ! $force) {
            return ['skipped' => 'вимкнено'];
        }
        if (! $force && ! $this->quiet()) {
            return ['skipped' => 'на сайті людно'];
        }
        $done = ['titles' => 0, 'game_characters' => 0, 'ranked' => 0, 'themed' => 0];

        // 1. Персонажі тайтлів (Shikimori / TMDB) — без ІІ.
        Artisan::call('cards:characters', ['--limit' => 15]);
        $done['titles'] = 15;

        // 2. Персонажі ігор — ІІ (по одній грі на запит).
        $games = Game::query()->where('is_published', true)
            ->whereNotIn('id', CardCharacter::query()->whereNotNull('game_id')->select('game_id'))
            ->whereNotIn('id', (array) Cache::get('cards.games_without_characters', []))
            ->orderByDesc('popularity')->limit(3)->get(['id', 'name', 'popularity']);
        foreach ($games as $game) {
            if ($this->aiLeft() <= 0) {
                break;
            }
            $this->spendAi();
            $list = app(AiAssistant::class)->gameCharacters($game->name);
            if ($list === []) {
                // Гра без персонажів — не питаємо про неї знову тиждень.
                Cache::put('cards.games_without_characters', [...(array) Cache::get('cards.games_without_characters', []), $game->id], now()->addWeek());

                continue;
            }
            foreach ($list as $row) {
                CardCharacter::query()->firstOrCreate(
                    ['game_id' => $game->id, 'source' => 'ai', 'source_id' => Str::slug(Str::ascii($row['name'])) ?: md5($row['name'])],
                    ['movie_id' => null, 'name' => $row['name'], 'role' => $row['role'], 'popularity' => $row['role'] === 'main' ? 100 : 40],
                );
                $done['game_characters']++;
            }
        }

        // 3. Ранги й набори від ІІ — пачками, поки є бюджет.
        if ($this->aiLeft() > 0) {
            $this->spendAi();
            Artisan::call('cards:ai-rank', ['--batches' => 1]);
            $done['ranked'] = 1;
        }
        if ($this->aiLeft() > 0) {
            $this->spendAi();
            Artisan::call('cards:ai-themes', ['--batches' => 1]);
            $done['themed'] = 1;
        }
        Cache::forget('cards.catalog');
        Cache::put('cards.autopilot.last', ['at' => now()->toIso8601String(), ...$done], now()->addWeek());
        Log::info('cards: autopilot run', $done);

        return $done;
    }
}
