<?php

namespace App\Services\Cinema;

use App\Models\Movie;
use App\Models\User;
use App\Services\Ai\AiClient;
use App\Services\Ai\AiException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Добірка «Що подивитися» для віджета: фільм, серіал, аніме — під смак людини.
 * Якщо в адмінці підключено ШІ, він обирає з кандидатів сайту й пише коротку причину;
 * інакше — алгоритм за улюбленими жанрами. Кеш на людину — 12 годин.
 */
class AiPicks
{
    public const COUNT = 4;

    public function __construct(private readonly AiClient $ai) {}

    /**
     * @return array{ai: bool, items: list<array<string, mixed>>}
     */
    public function for(User $user): array
    {
        return Cache::remember("cinema:ai-picks:{$user->id}", now()->addHours(12), fn () => $this->build($user));
    }

    public function forget(User $user): void
    {
        Cache::forget("cinema:ai-picks:{$user->id}");
    }

    /**
     * @return array{ai: bool, items: list<array<string, mixed>>}
     */
    private function build(User $user): array
    {
        $seen = DB::table('movie_user')->where('user_id', $user->id)->pluck('movie_id')->map(fn ($id) => (int) $id)->all();
        $liked = Movie::query()->whereIn('id', DB::table('movie_user')->where('user_id', $user->id)
            ->where(fn ($q) => $q->where('rating', '>=', 7)->orWhereIn('status', ['watched', 'watching', 'favorite']))
            ->orderByDesc('updated_at')->limit(15)->pluck('movie_id'))->get(['id', 'title', 'type', 'genres']);

        $candidates = Movie::query()->published()->whereNotIn('id', $seen ?: [0])
            ->orderByDesc('views_count')->orderByDesc('id')->limit(60)->get();
        if ($candidates->isEmpty()) {
            return ['ai' => false, 'items' => []];
        }

        if ($this->ai->configured() && $liked->isNotEmpty()) {
            try {
                $items = $this->ask($liked, $candidates);
                if (count($items) >= 2) {
                    return ['ai' => true, 'items' => $items];
                }
            } catch (AiException|\JsonException $e) {
                Log::info('cinema.ai_picks.failed', ['error' => $e->getMessage()]);
            }
        }

        return ['ai' => false, 'items' => $this->byGenres($liked, $candidates)];
    }

    /**
     * @param  Collection<int, Movie>  $liked
     * @param  Collection<int, Movie>  $candidates
     * @return list<array<string, mixed>>
     *
     * @throws AiException|\JsonException
     */
    private function ask(Collection $liked, Collection $candidates): array
    {
        $line = fn (Movie $m) => $m->id.' | '.$m->title.' | '.(Movie::TYPES[$m->type] ?? $m->type).' | '.implode(', ', array_slice($m->genres ?? [], 0, 4));
        $prompt = "Людині сподобалось:\n".$liked->map($line)->implode("\n")
            ."\n\nКандидати з каталогу сайту (id | назва | тип | жанри):\n".$candidates->map($line)->implode("\n")
            ."\n\nОбери ".self::COUNT.' кандидатів, що найбільше підійдуть, бажано різних типів (фільм, серіал, аніме). '
            .'Відповідай лише JSON-масивом: [{"id": 123, "why": "до 70 символів українською, чому підійде"}].';
        $raw = $this->ai->complete('Ти — кінокуратор соцмережі для геймерів. Обирай лише з наданих кандидатів, без вигаданих назв.', [['role' => 'user', 'content' => $prompt]], 400, task: 'cinema');
        $json = trim((string) preg_replace('/^```(?:json)?|```$/m', '', $raw));
        $rows = json_decode($json, true, 4, JSON_THROW_ON_ERROR);
        $byId = $candidates->keyBy('id');
        $out = [];
        foreach (is_array($rows) ? $rows : [] as $row) {
            $movie = is_array($row) && is_numeric($row['id'] ?? null) ? $byId->get((int) $row['id']) : null;
            if ($movie && count($out) < self::COUNT) {
                $out[] = [...$movie->toCard(), 'why' => mb_substr(trim((string) ($row['why'] ?? '')), 0, 90) ?: null];
                $byId->forget($movie->id);
            }
        }

        return $out;
    }

    /**
     * Запасний варіант без ШІ: збіг жанрів з улюбленим, різні типи, потім популярність.
     *
     * @param  Collection<int, Movie>  $liked
     * @param  Collection<int, Movie>  $candidates
     * @return list<array<string, mixed>>
     */
    private function byGenres(Collection $liked, Collection $candidates): array
    {
        $weights = $liked->flatMap(fn (Movie $m) => $m->genres ?? [])->countBy();
        $scored = $candidates->map(function (Movie $m) use ($weights) {
            $match = collect($m->genres ?? [])->sum(fn (string $g) => $weights[$g] ?? 0);

            return ['movie' => $m, 'score' => $match * 10 + min(9, (int) log(max(1, $m->views_count), 2)), 'genre' => collect($m->genres ?? [])->first(fn (string $g) => isset($weights[$g]))];
        })->sortByDesc('score')->values();

        $out = [];
        $types = [];
        // Спершу по одному кожного типу, далі — решта за балами.
        foreach ([true, false] as $distinct) {
            foreach ($scored as $row) {
                $m = $row['movie'];
                if (count($out) >= self::COUNT || isset($out[$m->id]) || ($distinct && isset($types[$m->type]))) {
                    continue;
                }
                $types[$m->type] = true;
                $out[$m->id] = [...$m->toCard(), 'why' => $row['genre'] ? 'Бо ви любите: '.mb_strtolower($row['genre']) : null];
            }
        }

        return array_values($out);
    }
}
