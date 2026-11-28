<?php

namespace App\Services\Fun;

use App\Models\Game;
use App\Models\GameScore;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Random\Engine\Mt19937;
use Random\Randomizer;

/**
 * Щоденна вікторина про ігри: 5 питань з каталогу, однакові для всіх у межах дня
 * (зерно — дата). Відповісти можна один раз; результат іде в таблицю дня.
 */
class DailyTrivia
{
    public const QUESTIONS = 5;

    public const KIND = 'trivia';

    /**
     * Питання дня з правильними відповідями (лише для сервера).
     *
     * @return list<array{type: string, question: string, image: string|null, options: list<string>, answer: int}>
     */
    public function questions(?CarbonInterface $day = null): array
    {
        $day ??= today();

        return Cache::remember('trivia:'.$day->toDateString(), now()->addDay(), fn () => $this->build($day));
    }

    /**
     * Те, що бачить гравець: питання без відповідей, а якщо вже грав — результат і правильні відповіді.
     *
     * @return array<string, mixed>
     */
    public function state(User $user): array
    {
        $questions = $this->questions();
        $played = GameScore::query()->where('user_id', $user->id)->where('kind', self::KIND)->whereDate('day', today())->first();

        return [
            'questions' => array_map(fn (array $q) => [
                'type' => $q['type'],
                'question' => $q['question'],
                'image' => $q['image'],
                'options' => $q['options'],
            ], $questions),
            'played' => $played === null ? null : [
                'score' => $played->score,
                'total' => $played->total,
                'answers' => array_column($questions, 'answer'),
            ],
            'top' => GameScore::top(self::KIND),
        ];
    }

    /**
     * @param  list<int|null>  $answers
     * @return array{score: int, total: int, answers: list<int>, already: bool}
     */
    public function submit(User $user, array $answers): array
    {
        $questions = $this->questions();
        $correct = array_column($questions, 'answer');
        $existing = GameScore::query()->where('user_id', $user->id)->where('kind', self::KIND)->whereDate('day', today())->first();
        if ($existing !== null) {
            return ['score' => $existing->score, 'total' => $existing->total, 'answers' => $correct, 'already' => true];
        }
        $score = 0;
        foreach ($correct as $i => $answer) {
            if (($answers[$i] ?? null) === $answer) {
                $score++;
            }
        }
        GameScore::query()->create(['user_id' => $user->id, 'kind' => self::KIND, 'day' => today(), 'score' => $score, 'total' => count($questions)]);

        return ['score' => $score, 'total' => count($questions), 'answers' => $correct, 'already' => false];
    }

    /**
     * @return list<array{type: string, question: string, image: string|null, options: list<string>, answer: int}>
     */
    private function build(CarbonInterface $day): array
    {
        $random = new Randomizer(new Mt19937(crc32('trivia:'.$day->toDateString())));
        /** @var Collection<int, Game> $pool */
        $pool = Game::query()->where('is_published', true)->orderByDesc('popularity')->orderBy('id')->limit(300)
            ->get(['id', 'name', 'released', 'genres', 'platforms', 'cover']);
        if ($pool->count() < 4) {
            return [];
        }
        $games = $random->shuffleArray($pool->all());
        $genres = array_values($pool->flatMap(fn (Game $g) => $g->genres ?? [])->unique()->all());
        $questions = [];
        $types = ['cover', 'year', 'genre', 'platform'];
        foreach ($games as $game) {
            if (count($questions) >= self::QUESTIONS) {
                break;
            }
            foreach ($random->shuffleArray($types) as $type) {
                $q = $this->make($type, $game, $pool, $genres, $random);
                if ($q !== null) {
                    $questions[] = $q;
                    // Різноманіття: той самий тип не двічі поспіль.
                    $types = [...array_values(array_diff($types, [$type])), $type];

                    break;
                }
            }
        }

        return $questions;
    }

    /**
     * @param  Collection<int, Game>  $pool
     * @param  list<string>  $genres
     * @return array{type: string, question: string, image: string|null, options: list<string>, answer: int}|null
     */
    private function make(string $type, Game $game, Collection $pool, array $genres, Randomizer $random): ?array
    {
        [$question, $image, $right, $wrong] = match ($type) {
            'cover' => $game->cover ? [
                'Що це за гра?',
                $game->cover,
                $game->name,
                $pool->where('id', '!=', $game->id)->pluck('name')->unique()->all(),
            ] : [null, null, null, []],
            'year' => $game->released ? [
                'У якому році вийшла '.$game->name.'?',
                null,
                (string) $game->released->year,
                array_map('strval', array_values(array_diff(range($game->released->year - 6, $game->released->year + 4), [$game->released->year]))),
            ] : [null, null, null, []],
            'genre' => ($game->genres ?? []) !== [] ? [
                'Який жанр у '.$game->name.'?',
                null,
                $random->shuffleArray($game->genres ?? [])[0],
                array_values(array_diff($genres, $game->genres ?? [])),
            ] : [null, null, null, []],
            'platform' => ($game->platforms ?? []) !== [] ? [
                'На якій із платформ є '.$game->name.'?',
                null,
                Game::PLATFORMS[$random->shuffleArray($game->platforms ?? [])[0]] ?? null,
                array_values(array_map(fn (string $p) => Game::PLATFORMS[$p], array_diff(array_keys(Game::PLATFORMS), $game->platforms ?? []))),
            ] : [null, null, null, []],
            default => [null, null, null, []],
        };
        $wrong = array_values(array_unique(array_filter($wrong, fn ($w) => is_string($w) && $w !== $right)));
        if ($question === null || $right === null || count($wrong) < 3) {
            return null;
        }
        $options = [$right, ...array_slice($random->shuffleArray($wrong), 0, 3)];
        $options = $random->shuffleArray($options);

        return [
            'type' => $type,
            'question' => $question,
            'image' => $image,
            'options' => $options,
            'answer' => (int) array_search($right, $options, true),
        ];
    }
}
