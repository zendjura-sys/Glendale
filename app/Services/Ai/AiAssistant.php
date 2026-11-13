<?php

namespace App\Services\Ai;

use App\Models\ChatAutomation;
use App\Models\Community;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageReport;
use App\Models\User;
use App\Services\Cards\CardCollection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Що вміє ШІ на сайті: переписати текст, підсумок чату, опис спільноти, оцінка скарги,
 * перевірка фото й відповіді ШІ-бота в бесіді. Людина — не більше 40 запитів на годину.
 */
class AiAssistant
{
    public const MODES = ['improve', 'fix', 'shorter', 'friendly', 'formal', 'en', 'uk'];

    private const PER_HOUR = 40;

    private const MAX_INPUT = 2000;

    public function __construct(private readonly AiClient $ai) {}

    public function rewrite(User $user, string $text, string $mode): string
    {
        $this->limit($user);
        $task = match ($mode) {
            'fix' => 'Виправ орфографічні, граматичні й пунктуаційні помилки. Нічого іншого не змінюй.',
            'shorter' => 'Скороти текст, зберігши сенс і тон.',
            'friendly' => 'Перепиши текст дружніше й тепліше, як повідомлення друзям у грі.',
            'formal' => 'Перепиши текст офіційніше й ввічливіше.',
            'en' => 'Переклади текст англійською.',
            'uk' => 'Переклади текст українською.',
            default => 'Покращ текст: зроби його чіткішим і природнішим, зберігши сенс і тон автора.',
        };
        $language = in_array($mode, ['en', 'uk'], true) ? '' : ' Відповідай мовою оригіналу.';

        return $this->ai->complete(
            "Ти редактор повідомлень соцмережі для геймерів GameCon. {$task}{$language} Поверни лише готовий текст — без лапок, пояснень і варіантів. Емодзі й згадки (@нік, #тег) лишай як є.",
            [['role' => 'user', 'content' => Str::limit($text, self::MAX_INPUT, '')]],
            1024,
        );
    }

    /** Підсумок останніх повідомлень бесіди (кеш на 10 хвилин, доки немає нових). */
    public function summary(User $user, Conversation $conversation): string
    {
        $key = "ai.summary.{$conversation->id}.{$conversation->last_message_id}";
        if (($cached = Cache::get($key)) !== null) {
            return (string) $cached;
        }
        $this->limit($user);
        $transcript = $this->transcript($conversation, 80);
        if ($transcript === '') {
            return 'У бесіді ще немає повідомлень.';
        }
        $summary = $this->ai->complete(
            'Ти коротко переказуєш груповий чат геймерів українською. Дай 3–6 пунктів: про що говорили, до чого домовилися (час, гра, хто що робить), відкриті питання. Без вступу, лише пункти через «• ». Не вигадуй того, чого немає в чаті.',
            [['role' => 'user', 'content' => "Чат «{$conversation->title}»:\n\n{$transcript}"]],
            800,
        );
        Cache::put($key, $summary, now()->addMinutes(10));

        return $summary;
    }

    public function communityDescription(User $user, Community $community, string $hints = ''): string
    {
        $this->limit($user);
        $facts = collect([
            'Назва: '.$community->name,
            'Тематика: '.(Community::CATEGORIES[$community->category] ?? $community->category),
            $community->status ? 'Статус: '.$community->status : null,
            $community->city ? 'Місто: '.$community->city : null,
            $community->rules ? 'Правила (уривок): '.Str::limit((string) $community->rules, 400) : null,
            $hints !== '' ? 'Побажання адміністратора: '.Str::limit($hints, 400) : null,
        ])->filter()->implode("\n");

        return $this->ai->complete(
            'Ти пишеш опис спільноти для соцмережі геймерів GameCon українською: 2–3 коротких абзаци, жваво, без канцеляриту й гучних обіцянок. Що тут роблять, для кого спільнота, як долучитися. Без хештегів і без вигаданих фактів. Поверни лише текст опису.',
            [['role' => 'user', 'content' => $facts]],
            700,
        );
    }

    /**
     * Оцінка скарги на повідомлення: терміновість (low | medium | high) і коротка причина.
     *
     * @return array{severity: string, reason: string}|null
     */
    public function assessReport(MessageReport $report): ?array
    {
        $message = $report->message()->withTrashed()->first();
        if ($message === null || trim((string) $message->body) === '') {
            return null;
        }
        $context = $this->transcript($message->conversation, 6, $message->id);
        try {
            $raw = $this->ai->complete(
                'Ти допомагаєш модераторам соцмережі геймерів. Оціни повідомлення, на яке поскаржились: чи порушує воно правила (образи, погрози, переслідування, спам, шахрайство, відвертий вміст, загроза дітям). Відповідай лише JSON без пояснень: {"severity":"low|medium|high","reason":"до 120 символів українською"}. high — погрози, загроза дітям, шахрайство, жорсткі образи; medium — грубість, спам; low — порушення не видно.',
                [['role' => 'user', 'content' => "Причина скарги: {$report->reason}\nКонтекст:\n{$context}\n\nПовідомлення: ".Str::limit((string) $message->body, 1500)]],
                300,
            );
        } catch (AiException) {
            return null;
        }
        $json = json_decode((string) Str::of($raw)->after('{')->beforeLast('}')->prepend('{')->append('}'), true);
        if (! is_array($json) || ! in_array($json['severity'] ?? null, ['low', 'medium', 'high'], true)) {
            return null;
        }

        return ['severity' => (string) $json['severity'], 'reason' => Str::limit((string) ($json['reason'] ?? ''), 160)];
    }

    /**
     * Токсичність коментаря 0–100 (образи, погрози, цькування; ігровий сленг і жарти — ні).
     *
     * @return array{score: int, reason: string}|null
     */
    public function toxicity(string $text): ?array
    {
        try {
            $raw = $this->ai->complete(
                'Ти модератор коментарів соцмережі геймерів. Оціни токсичність коментаря від 0 до 100: образи людей, погрози, цькування, мова ворожнечі — високо; ігровий сленг, сарказм без образ, критика гри — низько. Відповідай лише JSON: {"score":0-100,"reason":"до 80 символів українською"}.',
                [['role' => 'user', 'content' => Str::limit($text, 1500)]],
                150,
            );
        } catch (AiException) {
            return null;
        }
        $json = json_decode((string) Str::of($raw)->after('{')->beforeLast('}')->prepend('{')->append('}'), true);
        if (! is_array($json) || ! is_numeric($json['score'] ?? null)) {
            return null;
        }

        return ['score' => max(0, min(100, (int) $json['score'])), 'reason' => Str::limit((string) ($json['reason'] ?? ''), 80)];
    }

    /**
     * Ранги персонажів для колекційних карток: чим сильніший, впливовіший і культовіший персонаж — тим вищий ранг.
     *
     * @param  list<array{id: int, name: string, title: string, role: string}>  $characters
     * @return array<int, array{rank: string, reason: string}>
     */
    public function cardRanks(array $characters): array
    {
        if ($characters === []) {
            return [];
        }
        $list = implode("\n", array_map(fn (array $c) => "{$c['id']}. {$c['name']} — «{$c['title']}» (".($c['role'] === 'main' ? 'головний' : 'другорядний').')', $characters));
        try {
            $raw = $this->ai->complete(
                'Ти експерт з аніме, фільмів і серіалів. Признач кожному персонажу ранг колекційної картки за шкалою від найнижчого до найвищого: N, G, F, E, D, C, B, A, R, SR, SSR, S, SS, SSS, EX, U. Враховуй силу, вплив на сюжет, культовість і популярність: масовка й епізодичні — N–D, помітні другорядні — C–A, сильні й улюблені — R–SSR, головні герої й легенди жанру — S–SSS, надзвичайні — EX, абсолютні ікони світового рівня — U (дуже рідко). Відповідай лише JSON: {"id": {"rank": "…", "reason": "до 80 символів українською"}, …}.',
                [['role' => 'user', 'content' => $list]],
                1500,
            );
        } catch (AiException) {
            return [];
        }
        $json = json_decode((string) Str::of($raw)->after('{')->beforeLast('}')->prepend('{')->append('}'), true);
        $out = [];
        foreach (is_array($json) ? $json : [] as $id => $row) {
            $rank = is_array($row) ? strtoupper((string) ($row['rank'] ?? '')) : '';
            if (in_array($rank, CardCollection::RARITIES, true)) {
                $out[(int) $id] = ['rank' => $rank, 'reason' => Str::limit((string) ($row['reason'] ?? ''), 190)];
            }
        }

        return $out;
    }

    /**
     * Відомі персонажі гри для колекційних карток (герої, лиходії, культові NPC). Порожньо — у гри немає персонажів.
     *
     * @return list<array{name: string, role: string}>
     */
    public function gameCharacters(string $game, int $limit = 8): array
    {
        try {
            $raw = $this->ai->complete(
                'Ти знавець відеоігор. Назви до '.$limit.' найвідоміших персонажів гри — лише справжніх, з канону гри (герої, лиходії, культові NPC). Якщо в грі немає іменованих персонажів (симулятори, спорт, пісочниці без героїв) — порожній список. Імена пиши як прийнято в українській спільноті (або оригінал). Відповідай лише JSON: {"characters":[{"name":"…","role":"main|supporting"}]}.',
                [['role' => 'user', 'content' => 'Гра: '.Str::limit($game, 120)]],
                600,
            );
        } catch (AiException) {
            return [];
        }
        $json = json_decode((string) Str::of($raw)->after('{')->beforeLast('}')->prepend('{')->append('}'), true);
        $out = [];
        foreach ((array) ($json['characters'] ?? []) as $row) {
            $name = is_array($row) ? trim((string) ($row['name'] ?? '')) : '';
            if ($name !== '' && mb_strlen($name) <= 120) {
                $out[] = ['name' => $name, 'role' => ($row['role'] ?? '') === 'main' ? 'main' : 'supporting'];
            }
        }

        return array_slice($out, 0, $limit);
    }

    /**
     * Тематичні набори колекційних карток: до якого набору з переліку належить кожна картка.
     *
     * @param  list<array{key: string, name: string, about: string}>  $cards
     * @param  list<string>  $themes
     * @return array<string, string>
     */
    public function cardThemes(array $cards, array $themes): array
    {
        if ($cards === []) {
            return [];
        }
        $list = implode("\n", array_map(fn (array $c) => "{$c['key']}: {$c['name']} ({$c['about']})", $cards));
        try {
            $raw = $this->ai->complete(
                'Розклади колекційні картки (ігри й персонажі аніме, фільмів, серіалів) за тематичними наборами. Обирай рівно одну назву з переліку: '.implode(', ', $themes).'. «Круті хлопці» — харизматичні круті герої, «Лиходії» — антагоністи, «Меха» — роботи й пілоти, «Супергерої» — герої з надздібностями. Відповідай лише JSON: {"ключ": "набір", …}.',
                [['role' => 'user', 'content' => $list]],
                1500,
            );
        } catch (AiException) {
            return [];
        }
        $json = json_decode((string) Str::of($raw)->after('{')->beforeLast('}')->prepend('{')->append('}'), true);
        $out = [];
        foreach (is_array($json) ? $json : [] as $key => $theme) {
            if (is_string($theme) && in_array($theme, $themes, true)) {
                $out[(string) $key] = $theme;
            }
        }

        return $out;
    }

    /** Ймовірність відвертого вмісту на фото 0..1 (запасний варіант до Sightengine). */
    public function imageScore(string $path): ?float
    {
        $disk = Storage::disk('public');
        if (! $disk->exists($path)) {
            return null;
        }
        $mime = (string) $disk->mimeType($path);
        if (! in_array($mime, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], true)) {
            return null;
        }
        try {
            $raw = $this->ai->complete(
                'Ти перевіряєш фото для соцмережі. Оціни ймовірність відвертого сексуального вмісту або оголеного тіла від 0 до 1. Відповідай лише числом, напр. 0.05.',
                [['role' => 'user', 'content' => 'Оціни це фото.']],
                16,
                [['mime' => $mime, 'data' => base64_encode((string) $disk->get($path))]],
            );
        } catch (AiException) {
            return null;
        }

        return preg_match('/\d+(?:[.,]\d+)?/', $raw, $m) === 1 ? max(0.0, min(1.0, (float) str_replace(',', '.', $m[0]))) : null;
    }

    /** Відповідь ШІ-бота на повідомлення, де його згадали. */
    public function botReply(Conversation $conversation, ChatAutomation $bot, Message $trigger): string
    {
        $persona = trim($bot->body) !== '' ? trim($bot->body) : 'Ти дружній помічник геймерської спільноти.';
        $transcript = $this->transcript($conversation, 20, $trigger->id);
        $author = $trigger->user->name ?? 'Учасник';

        return $this->ai->complete(
            "Ти бот «{$bot->bot_name}» у груповому чаті «{$conversation->title}» соцмережі геймерів GameCon. {$persona}\nВідповідай коротко (до 5 речень), мовою запитання, без markdown-заголовків. Не вигадуй фактів про людей із чату. Якщо не знаєш — так і скажи.",
            [['role' => 'user', 'content' => "Останні повідомлення чату:\n{$transcript}\n\n{$author} звертається до тебе: ".Str::limit((string) $trigger->body, 1500)]],
            700,
        );
    }

    private function limit(User $user): void
    {
        $key = 'ai:'.$user->id;
        if (RateLimiter::tooManyAttempts($key, self::PER_HOUR)) {
            throw new AiException('Забагато запитів до ШІ. Спробуйте за '.ceil(RateLimiter::availableIn($key) / 60).' хв.');
        }
        RateLimiter::hit($key, 3600);
    }

    /** Останні текстові повідомлення бесіди рядками «Ім’я: текст». */
    private function transcript(Conversation $conversation, int $limit, ?int $upTo = null): string
    {
        return Message::query()->with('user')
            ->where('conversation_id', $conversation->id)
            ->where('type', Message::TYPE_TEXT)
            ->whereNotNull('body')
            ->whereNull('publish_at')
            ->when($upTo, fn ($q, int $id) => $q->where('id', '<', $id))
            ->latest('id')->limit($limit)->get()->reverse()
            ->map(function (Message $m) {
                $name = $m->user->name ?? ($m->meta['bot']['name'] ?? ($m->meta['guest']['name'] ?? 'Учасник'));

                return $name.': '.Str::limit(str_replace("\n", ' ', (string) $m->body), 400);
            })->implode("\n");
    }
}
