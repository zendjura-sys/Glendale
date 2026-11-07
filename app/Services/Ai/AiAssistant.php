<?php

namespace App\Services\Ai;

use App\Models\ChatAutomation;
use App\Models\Community;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageReport;
use App\Models\User;
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
