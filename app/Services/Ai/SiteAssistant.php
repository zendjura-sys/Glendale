<?php

namespace App\Services\Ai;

use App\Models\User;
use App\Support\Help\HelpCatalog;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

/**
 * ШІ-помічник по сайту: відповідає на «як зробити…» лише за статтями довідки (HelpCatalog).
 * Спершу знаходимо 4 найближчі статті за словами питання, потім ШІ відповідає з посиланнями на них.
 * Без ключа ШІ — повертає самі знайдені статті.
 */
class SiteAssistant
{
    private const PER_HOUR = 30;

    public function __construct(
        private readonly AiClient $ai,
        private readonly HelpCatalog $help,
    ) {}

    /**
     * @param  list<array{role: 'user'|'assistant', content: string}>  $history
     * @return array{answer: string, sources: list<array{title: string, url: string}>, ai: bool}
     *
     * @throws AiException
     */
    public function answer(?User $user, string $question, array $history = []): array
    {
        $question = Str::limit(trim($question), 500, '');
        $found = $this->search($question.' '.implode(' ', array_map(fn ($m) => $m['role'] === 'user' ? $m['content'] : '', array_slice($history, -2))));
        $sources = array_map(fn (array $a) => ['title' => $a['title'], 'url' => $a['url']], $found);
        // Гостям — лише пошук у довідці: ШІ коштує грошей, тож він для тих, хто увійшов.
        $ai = $user !== null && app(Plugins::class)->on('ai_site_assistant');

        if (! $ai) {
            return [
                'answer' => $found === [] ? 'У довідці нічого не знайшлося — спробуйте інакше сформулювати питання або напишіть у підтримку.' : 'Ось що є в довідці на цю тему:',
                'sources' => $sources,
                'ai' => false,
            ];
        }
        $this->limit($user);

        $context = implode("\n\n", array_map(
            fn (array $a) => "### {$a['title']} ({$a['url']})\n".Str::limit($a['text'], 2500),
            $found,
        ));
        $messages = [];
        foreach (array_slice($history, -6) as $turn) {
            $messages[] = ['role' => $turn['role'], 'content' => Str::limit($turn['content'], 1000, '')];
        }
        $messages[] = ['role' => 'user', 'content' => "Статті довідки:\n\n".($context !== '' ? $context : '(нічого не знайдено)')."\n\nПитання: ".$question];

        try {
            $answer = trim($this->ai->complete(
                'Ти — помічник соцмережі для геймерів GameCon (сайт і застосунок). Відповідай українською, коротко й по кроках: куди натиснути й що обрати. '
                .'Спирайся лише на надані статті довідки; якщо в них немає відповіді — чесно скажи, що не знаєш, і порадь «Підтримка» в меню. '
                .'Не вигадуй розділів і кнопок. Посилання давай у вигляді [Назва статті](/help/…), лише з наданих. Без вступів і підсумків.',
                $messages,
                700,
                [],
                'assistant',
            ));
        } catch (AiException) {
            // ШІ недоступний — не лишаємо людину без відповіді: статті довідки на тему.
            return [
                'answer' => $found === [] ? 'Помічник зараз недоступний, і в довідці нічого не знайшлося — напишіть у підтримку.' : 'Помічник зараз недоступний. Ось що є в довідці на цю тему:',
                'sources' => $sources,
                'ai' => false,
            ];
        }

        return ['answer' => $answer, 'sources' => $sources, 'ai' => true];
    }

    /**
     * Найближчі статті за словами питання (основи слів, назва важить більше).
     *
     * @return list<array{title: string, url: string, text: string}>
     */
    public function search(string $query, int $limit = 4): array
    {
        $terms = $this->stems($query);
        if ($terms === []) {
            return [];
        }
        $scored = [];
        foreach ($this->help->categories() as $category) {
            foreach ($category['articles'] as $article) {
                $text = $this->text($article['blocks']);
                $title = mb_strtolower($article['title'].' '.$category['title']);
                $summary = mb_strtolower($article['summary']);
                $body = mb_strtolower($text);
                $score = 0;
                foreach ($terms as $term) {
                    $score += substr_count($title, $term) * 6 + substr_count($summary, $term) * 3 + min(5, substr_count($body, $term));
                }
                if ($score > 0) {
                    $scored[] = ['score' => $score, 'title' => $article['title'], 'url' => '/help/'.$category['slug'].'/'.$article['slug'], 'text' => $article['summary']."\n".$text];
                }
            }
        }
        usort($scored, fn ($a, $b) => $b['score'] <=> $a['score']);

        return array_map(fn (array $a) => ['title' => $a['title'], 'url' => $a['url'], 'text' => $a['text']], array_slice($scored, 0, $limit));
    }

    /**
     * Основи слів: нижній регістр, без коротких службових слів, перші 5 літер (грубий стемінг для укр./рос.).
     *
     * @return list<string>
     */
    private function stems(string $query): array
    {
        $words = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($query), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $stop = ['як', 'що', 'де', 'чи', 'або', 'для', 'мені', 'можна', 'треба', 'зробити', 'хочу', 'мене', 'мой', 'моя', 'как', 'где', 'это', 'сделать', 'how', 'the', 'what'];
        $out = [];
        foreach ($words as $word) {
            if (mb_strlen($word) < 3 || in_array($word, $stop, true)) {
                continue;
            }
            $out[] = mb_substr($word, 0, mb_strlen($word) > 6 ? 5 : max(3, mb_strlen($word) - 1));
        }

        return array_values(array_unique($out));
    }

    /** @param  list<array<string, mixed>>  $blocks */
    private function text(array $blocks): string
    {
        $lines = [];
        foreach ($blocks as $block) {
            if (isset($block['text'])) {
                $lines[] = (string) $block['text'];
            }
            foreach ($block['items'] ?? [] as $item) {
                $lines[] = '• '.$item;
            }
            foreach ($block['pins'] ?? [] as $pin) {
                $lines[] = '• '.$pin['text'];
            }
        }

        return implode("\n", $lines);
    }

    /** @throws AiException */
    private function limit(?User $user): void
    {
        $key = 'ai-help:'.($user?->id ?? request()->ip());
        if (RateLimiter::tooManyAttempts($key, self::PER_HOUR)) {
            throw new AiException('Забагато питань помічнику. Спробуйте за '.ceil(RateLimiter::availableIn($key) / 60).' хв.');
        }
        RateLimiter::hit($key, 3600);
    }
}
