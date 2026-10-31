<?php

namespace App\Services\Chat;

use App\Jobs\AiBotReply;
use App\Models\ChatAutomation;
use App\Models\Community;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Services\Messenger;
use App\Support\Plugins\Plugins;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Боти бесід (групи й канали спільнот): «Привітання» — вітає новеньких від імені бота;
 * «Автопости» — повідомлення за розкладом (раз, щодня, у вибрані дні тижня, час за Києвом).
 * Налаштовують адміністратори бесіди; у каналі — адміністратори спільноти.
 */
class ChatBots
{
    public const TIMEZONE = 'Europe/Kyiv';

    public const MAX_POSTS = 10;

    /** Скільки пам’ятаємо, що людину вже привітали в цій бесіді. */
    private const GREETED_DAYS = 30;

    public function __construct(private readonly Messenger $messenger) {}

    public function authorize(Conversation $conversation, User $user): void
    {
        abort_unless($conversation->isGroup(), 422, 'Боти працюють у групах і каналах.');
        abort_unless($conversation->participantFor($user)?->canManage() || $user->isStaff(), 403, 'Ботами керують адміністратори бесіди.');
    }

    /**
     * @return array{ai: array<string, mixed>|null, welcome: array<string, mixed>|null, posts: list<array<string, mixed>>}
     */
    public function overview(Conversation $conversation): array
    {
        $all = ChatAutomation::query()->where('conversation_id', $conversation->id)->orderBy('id')->get();
        $welcome = $all->firstWhere('kind', ChatAutomation::WELCOME);

        $ai = $all->firstWhere('kind', ChatAutomation::AI);

        return [
            'ai' => $ai ? $this->card($ai) : null,
            'welcome' => $welcome ? $this->card($welcome) : null,
            'posts' => array_values($all->where('kind', ChatAutomation::POST)->map(fn (ChatAutomation $a) => $this->card($a))->all()),
        ];
    }

    /**
     * @param  array{enabled: bool, body: string, bot_name?: string|null}  $data
     */
    public function saveWelcome(Conversation $conversation, User $user, array $data): ChatAutomation
    {
        return ChatAutomation::query()->updateOrCreate(
            ['conversation_id' => $conversation->id, 'kind' => ChatAutomation::WELCOME],
            [
                'enabled' => $data['enabled'],
                'body' => trim($data['body']),
                'bot_name' => $this->botName($data['bot_name'] ?? null),
                'created_by' => $user->id,
            ],
        );
    }

    /**
     * ШІ-бот бесіди: ім’я, характер (що він знає й як говорить).
     *
     * @param  array{enabled: bool, body?: string|null, bot_name?: string|null}  $data
     */
    public function saveAi(Conversation $conversation, User $user, array $data): ChatAutomation
    {
        return ChatAutomation::query()->updateOrCreate(
            ['conversation_id' => $conversation->id, 'kind' => ChatAutomation::AI],
            [
                'enabled' => $data['enabled'],
                'body' => trim((string) ($data['body'] ?? '')),
                'bot_name' => $this->botName($data['bot_name'] ?? 'ШІ'),
                'created_by' => $user->id,
            ],
        );
    }

    /**
     * Нове повідомлення людини: якщо в бесіді є ШІ-бот і його згадали — відповісти (у черзі, після відповіді сервера).
     * Не частіше 20 відповідей на годину в бесіді.
     */
    public function maybeAiReply(Conversation $conversation, Message $message): void
    {
        $body = trim((string) $message->body);
        if ($message->user_id === null || $message->publish_at !== null || $body === '' || ! $conversation->isGroup() || ! app(Plugins::class)->on('ai_chat_bot')) {
            return;
        }
        $bot = ChatAutomation::query()->where('conversation_id', $conversation->id)->where('kind', ChatAutomation::AI)->where('enabled', true)->first();
        if ($bot === null) {
            return;
        }
        $called = preg_match('~^/(ші|ai)(?=\s|$)~iu', $body) === 1 || mb_stripos($body, '@'.$bot->bot_name) !== false;
        if (! $called || RateLimiter::tooManyAttempts('ai-bot:'.$conversation->id, 20)) {
            return;
        }
        RateLimiter::hit('ai-bot:'.$conversation->id, 3600);
        AiBotReply::dispatch($bot->id, $message->id)->afterResponse();
    }

    /**
     * @param  array{body: string, bot_name?: string|null, repeat: string, at?: string|null, time?: string|null, weekdays?: list<int>|null}  $data
     */
    public function addPost(Conversation $conversation, User $user, array $data): ChatAutomation
    {
        if (ChatAutomation::query()->where('conversation_id', $conversation->id)->where('kind', ChatAutomation::POST)->count() >= self::MAX_POSTS) {
            throw ValidationException::withMessages(['body' => 'У бесіді може бути до '.self::MAX_POSTS.' автопостів.']);
        }
        $automation = new ChatAutomation([
            'conversation_id' => $conversation->id,
            'kind' => ChatAutomation::POST,
            'body' => trim($data['body']),
            'bot_name' => $this->botName($data['bot_name'] ?? null),
            'repeat' => $data['repeat'],
            'time' => $data['repeat'] === ChatAutomation::ONCE ? null : ($data['time'] ?? null),
            'weekdays' => $data['repeat'] === ChatAutomation::WEEKLY ? array_values(array_unique(array_map('intval', $data['weekdays'] ?? []))) : null,
            'enabled' => true,
            'created_by' => $user->id,
        ]);
        if ($automation->repeat === ChatAutomation::ONCE) {
            $at = CarbonImmutable::parse((string) ($data['at'] ?? ''), self::TIMEZONE);
            if ($at->isPast()) {
                throw ValidationException::withMessages(['at' => 'Виберіть час у майбутньому.']);
            }
            $automation->next_run_at = $at->utc();
        } else {
            if ($automation->time === null || preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $automation->time) !== 1) {
                throw ValidationException::withMessages(['time' => 'Вкажіть час у форматі ГГ:ХХ.']);
            }
            if ($automation->repeat === ChatAutomation::WEEKLY && $automation->weekdays === []) {
                throw ValidationException::withMessages(['weekdays' => 'Виберіть хоча б один день тижня.']);
            }
            $automation->next_run_at = $this->nextRun($automation, CarbonImmutable::now());
        }
        $automation->save();

        return $automation;
    }

    public function toggle(ChatAutomation $automation, bool $enabled): void
    {
        $automation->enabled = $enabled;
        if ($enabled && $automation->kind === ChatAutomation::POST && $automation->repeat !== ChatAutomation::ONCE) {
            $automation->next_run_at = $this->nextRun($automation, CarbonImmutable::now());
        }
        $automation->save();
    }

    /** Наступний запуск щоденного чи щотижневого автопоста після вказаного моменту. */
    public function nextRun(ChatAutomation $automation, CarbonImmutable $after): ?CarbonImmutable
    {
        if ($automation->time === null) {
            return null;
        }
        [$hour, $minute] = array_map('intval', explode(':', $automation->time));
        $local = $after->setTimezone(self::TIMEZONE);
        for ($day = 0; $day <= 7; $day++) {
            $candidate = $local->addDays($day)->setTime($hour, $minute);
            if ($candidate->lessThanOrEqualTo($local)) {
                continue;
            }
            if ($automation->repeat === ChatAutomation::WEEKLY && ! in_array($candidate->dayOfWeekIso, $automation->weekdays ?? [], true)) {
                continue;
            }

            return $candidate->utc();
        }

        return null;
    }

    /** Розіслати автопости, час яких настав (планувальник щохвилини). */
    public function runDue(): int
    {
        if (! app(Plugins::class)->on('chat_autoposter')) {
            return 0;
        }
        $count = 0;
        ChatAutomation::query()->with('conversation')
            ->where('kind', ChatAutomation::POST)->where('enabled', true)
            ->whereNotNull('next_run_at')->where('next_run_at', '<=', now())
            ->orderBy('next_run_at')->limit(100)->get()
            ->each(function (ChatAutomation $automation) use (&$count) {
                $once = $automation->repeat === ChatAutomation::ONCE;
                $automation->forceFill([
                    'last_run_at' => now(),
                    'enabled' => ! $once,
                    'next_run_at' => $once ? null : $this->nextRun($automation, CarbonImmutable::now()),
                ])->save();
                if ($automation->conversation !== null) {
                    $this->messenger->sendAsBot($automation->conversation, $automation->bot_name, $automation->body);
                    $count++;
                }
            });

        return $count;
    }

    /**
     * Привітати новеньких у бесіді (кожного — раз на місяць, щоб вихід і повернення не спамили).
     *
     * @param  iterable<User>  $users
     */
    public function greet(Conversation $conversation, iterable $users): void
    {
        if (! app(Plugins::class)->on('chat_welcome_bot')) {
            return;
        }
        $bot = ChatAutomation::query()->where('conversation_id', $conversation->id)->where('kind', ChatAutomation::WELCOME)->where('enabled', true)->first();
        if ($bot === null) {
            return;
        }
        $names = [];
        foreach ($users as $user) {
            if (Cache::add("chat-welcome:{$conversation->id}:{$user->id}", 1, now()->addDays(self::GREETED_DAYS))) {
                $names[] = $user->name;
            }
        }
        if ($names === []) {
            return;
        }
        $text = strtr($bot->body, [
            '{name}' => implode(', ', $names),
            '{chat}' => (string) $conversation->title,
        ]);
        $this->messenger->sendAsBot($conversation, $bot->bot_name, $text);
    }

    /** Людина вступила в спільноту — привітати в каналах, де ввімкнено «Привітання». */
    public function greetCommunity(Community $community, User $user): void
    {
        $community->channels()->whereNotNull('conversation_id')->where('is_private', false)
            ->with('conversation')->get()
            ->each(fn ($channel) => $channel->conversation && $this->greet($channel->conversation, [$user]));
    }

    /**
     * @return array<string, mixed>
     */
    private function card(ChatAutomation $automation): array
    {
        return [
            'id' => $automation->id,
            'kind' => $automation->kind,
            'bot_name' => $automation->bot_name,
            'body' => $automation->body,
            'enabled' => $automation->enabled,
            'repeat' => $automation->repeat,
            'time' => $automation->time,
            'weekdays' => $automation->weekdays,
            'next_run_at' => $automation->next_run_at?->toIso8601String(),
            'last_run_at' => $automation->last_run_at?->toIso8601String(),
        ];
    }

    private function botName(?string $name): string
    {
        $name = trim((string) $name);

        return $name === '' ? 'Бот' : mb_substr($name, 0, 40);
    }
}
