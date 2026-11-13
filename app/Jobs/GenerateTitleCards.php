<?php

namespace App\Jobs;

use App\Models\CardCharacter;
use App\Models\Game;
use App\Models\Movie;
use App\Services\Ai\AiAssistant;
use App\Services\Cards\CardAutopilot;
use App\Services\Cinema\Metadata\ShikimoriProvider;
use App\Services\Cinema\Metadata\TmdbProvider;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Нові колекційні картки поруч із парсингом: щойно балансер чи метадані додали тайтл (або каталог —
 * гру), підтягуємо його персонажів. Аніме — Shikimori, фільми й серіали — TMDB, ігри — ІІ
 * (у межах денного бюджету автопілота; не вистачило — догонить автопілот у тихі години).
 * Лише додає: наявні картки людей не зникають.
 */
class GenerateTitleCards implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public function __construct(public ?int $movieId = null, public ?int $gameId = null) {}

    public function handle(): void
    {
        try {
            $this->movieId !== null ? $this->movie() : $this->game();
        } catch (Throwable $e) {
            Log::warning('cards: title generation failed', ['movie' => $this->movieId, 'game' => $this->gameId, 'error' => $e->getMessage()]);
        }
        Cache::forget('cards.catalog');
    }

    private function movie(): void
    {
        $movie = Movie::query()->find($this->movieId);
        if (! $movie || ! $movie->is_published) {
            return;
        }
        $anime = $movie->type === 'anime';
        $rows = $anime ? app(ShikimoriProvider::class)->characters($movie) : app(TmdbProvider::class)->characters($movie);
        foreach ($rows as $row) {
            CardCharacter::query()->updateOrCreate(
                ['movie_id' => $movie->id, 'source' => $anime ? 'shikimori' : 'tmdb', 'source_id' => $row['source_id']],
                ['name' => $row['name'], 'image_url' => $row['image_url'], 'role' => $row['role'], 'popularity' => $row['popularity']],
            );
        }
    }

    private function game(): void
    {
        $game = Game::query()->find($this->gameId);
        $autopilot = app(CardAutopilot::class);
        // ІІ про ту саму гру — не частіше разу на тиждень (бережемо безкоштовний ліміт).
        if (! $game || ! $game->is_published || $autopilot->aiLeft() <= 0 || ! Cache::add('cards.game_checked.'.$game->id, true, now()->addWeek())) {
            return;
        }
        $autopilot->spendAi();
        // Наявних персонажів не дублюємо: бракує когось — додаємо.
        foreach (app(AiAssistant::class)->gameCharacters($game->name) as $row) {
            CardCharacter::query()->firstOrCreate(
                ['game_id' => $game->id, 'source' => 'ai', 'source_id' => Str::slug(Str::ascii($row['name'])) ?: md5($row['name'])],
                ['movie_id' => null, 'name' => $row['name'], 'role' => $row['role'], 'popularity' => $row['role'] === 'main' ? 100 : 40],
            );
        }
    }
}
