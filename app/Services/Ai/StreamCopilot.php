<?php

namespace App\Services\Ai;

use App\Models\Livecast;
use App\Models\LivecastMessage;
use App\Models\LiveShow;
use App\Models\LiveShowGift;
use App\Models\LiveShowLike;
use App\Models\LiveShowMember;
use App\Models\User;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

/**
 * ШІ-помічник ефіру: LiveCast і GameCast.
 * Стежить за чатом / залученістю, підказує промо й м’які сигнали модерації (ключ з адмінки).
 */
class StreamCopilot
{
    private const PER_HOUR = 30;

    public function __construct(private readonly AiClient $ai) {}

    public function available(string $surface): bool
    {
        $plugin = $surface === 'livecast' ? 'ai_livecast' : 'ai_gamecast';

        return app(Plugins::class)->on($plugin) && $this->ai->configured();
    }

    /**
     * Огляд ефіру для ведучого: настрій, ризики, що сказати далі, ідея промо.
     *
     * @return array{mood: string, risks: list<string>, tips: list<string>, promo: string, raw: string}
     */
    public function watchLiveCast(User $host, Livecast $stream): array
    {
        abort_unless($this->available('livecast'), 404);
        abort_unless($stream->host_id === $host->id || $host->isStaff(), 403);
        $this->limit($host);

        $messages = LivecastMessage::query()->with('user')->where('livecast_id', $stream->id)
            ->latest('id')->limit(40)->get()->reverse()->values();
        $lines = $messages->map(function (LivecastMessage $m) {
            $who = $m->user?->name ?? '…';
            $kind = $m->kind === LivecastMessage::GIFT ? '[подарунок]' : ($m->kind === LivecastMessage::DONATION ? '[донат]' : '');

            return trim($who.': '.$kind.' '.$m->body);
        })->filter()->implode("\n");

        $facts = collect([
            'Площадка: LiveCast (відеострім)',
            'Назва: '.$stream->title,
            $stream->category ? 'Категорія: '.$stream->category : null,
            'Глядачів зараз: '.$stream->viewers,
            'Статус: '.$stream->status,
            $lines !== '' ? "Останні повідомлення чату:\n{$lines}" : 'Чат поки порожній.',
        ])->filter()->implode("\n");

        return $this->parseWatch($this->askWatch($facts, 'відеостріму LiveCast'));
    }

    /**
     * @return array{mood: string, risks: list<string>, tips: list<string>, promo: string, raw: string}
     */
    public function watchGameCast(User $host, LiveShow $show): array
    {
        abort_unless($this->available('gamecast'), 404);
        abort_unless($show->host_id === $host->id || $host->isStaff(), 403);
        $this->limit($host);

        $members = LiveShowMember::query()->with('user')->where('live_show_id', $show->id)->get();
        $fresh = now()->subSeconds(45);
        $here = $members->filter(fn (LiveShowMember $m) => $m->seen_at !== null && $m->seen_at->gte($fresh));
        $stage = $here->whereIn('role', ['host', 'speaker'])->map(fn (LiveShowMember $m) => $m->user?->name)->filter()->implode(', ');
        $guests = $members->where('role', 'guest')->filter(fn (LiveShowMember $m) => $m->mic_until?->isFuture())
            ->map(fn (LiveShowMember $m) => $m->user?->name)->filter()->implode(', ');
        $hands = $here->whereNotNull('hand_at')->map(fn (LiveShowMember $m) => $m->user?->name)->filter()->implode(', ');
        $gifts = LiveShowGift::query()->with(['from', 'to', 'gift'])->where('live_show_id', $show->id)
            ->latest('id')->limit(15)->get()
            ->map(fn (LiveShowGift $g) => ($g->from?->name ?? '?').' → '.($g->to?->name ?? '?').': '.($g->gift?->emoji ?? '').' '.($g->gift?->name ?? ''))
            ->implode("\n");
        $likes = LiveShowLike::query()->where('live_show_id', $show->id)->count();

        $facts = collect([
            'Площадка: GameCast (аудіоподкаст наживо)',
            'Назва: '.$show->title,
            'Теми: '.implode(', ', $show->topicList()) ?: 'без тем',
            'Формат: '.$show->format,
            'Статус: '.$show->status,
            'На сцені: '.($stage !== '' ? $stage : 'нікого'),
            'Гості з питанням: '.($guests !== '' ? $guests : 'немає'),
            'Черга рук: '.($hands !== '' ? $hands : 'порожня'),
            'Слухачів зараз: '.$here->count(),
            'Лайків за ефір: '.$likes,
            $gifts !== '' ? "Останні подарунки:\n{$gifts}" : 'Подарунків ще не було.',
        ])->filter()->implode("\n");

        return $this->parseWatch($this->askWatch($facts, 'аудіошоу GameCast'));
    }

    /** Короткий промо-текст для поширення ефіру. */
    public function promo(User $user, string $surface, string $title, array $extra = []): string
    {
        abort_unless($this->available($surface), 404);
        $this->limit($user);
        $label = $surface === 'livecast' ? 'LiveCast' : 'GameCast';
        $bits = collect([
            "Площадка: {$label}",
            'Назва: '.$title,
            isset($extra['topics']) ? 'Теми: '.(is_array($extra['topics']) ? implode(', ', $extra['topics']) : $extra['topics']) : null,
            isset($extra['category']) ? 'Категорія: '.$extra['category'] : null,
            isset($extra['hint']) ? 'Побажання ведучого: '.Str::limit((string) $extra['hint'], 300) : null,
        ])->filter()->implode("\n");

        return $this->ai->complete(
            'Ти SMM-помічник GameCon українською. Напиши 1 короткий пост (2–4 речення) щоб покликати людей на ефір: жваво, без кліше «не пропустіть», без хештегів-спаму (макс 3), без вигаданих фактів. Поверни лише текст поста.',
            [['role' => 'user', 'content' => $bits]],
            400,
            [],
            'streams',
        );
    }

    /**
     * Кешований м’який порадник для панелі ведучого (раз на хвилину).
     *
     * @return array{mood: string, tips: list<string>}|null
     */
    public function softPulse(string $surface, int $id, callable $fresh): ?array
    {
        if (! $this->available($surface) || ! $this->ai->configured()) {
            return null;
        }
        $key = "ai.stream.pulse.{$surface}.{$id}";

        return Cache::remember($key, 60, function () use ($fresh) {
            try {
                $full = $fresh();

                return [
                    'mood' => $full['mood'],
                    'tips' => array_slice($full['tips'], 0, 3),
                ];
            } catch (\Throwable) {
                return null;
            }
        });
    }

    private function askWatch(string $facts, string $kind): string
    {
        return $this->ai->complete(
            'Ти ко-хост '.$kind.' на GameCon. Відповідай українською. Слідкуй за тоном залу, ризиками (токсичність, спам, небезпечні посилання), дай практичні підказки ведучому й короткий промо-рядок. Не вигадуй того, чого немає у даних. Відповідь ЛИШЕ JSON: {"mood":"коротко","risks":["…"],"tips":["…"],"promo":"1 речення для шапки/сторіс"}.',
            [['role' => 'user', 'content' => Str::limit($facts, 6000, '')]],
            700,
            [],
            'streams',
        );
    }

    /**
     * @return array{mood: string, risks: list<string>, tips: list<string>, promo: string, raw: string}
     */
    private function parseWatch(string $raw): array
    {
        $json = $raw;
        if (preg_match('/\{.*\}/s', $raw, $m) === 1) {
            $json = $m[0];
        }
        $data = json_decode($json, true);
        if (! is_array($data)) {
            return [
                'mood' => 'невідомо',
                'risks' => [],
                'tips' => [Str::limit($raw, 280)],
                'promo' => '',
                'raw' => $raw,
            ];
        }
        $list = static function (mixed $v): array {
            if (! is_array($v)) {
                return [];
            }

            return array_values(array_filter(array_map(fn ($x) => is_string($x) ? trim($x) : '', $v)));
        };

        return [
            'mood' => is_string($data['mood'] ?? null) ? trim($data['mood']) : 'невідомо',
            'risks' => $list($data['risks'] ?? []),
            'tips' => $list($data['tips'] ?? []),
            'promo' => is_string($data['promo'] ?? null) ? trim($data['promo']) : '',
            'raw' => $raw,
        ];
    }

    private function limit(User $user): void
    {
        $key = 'ai.stream:'.$user->id;
        if (RateLimiter::tooManyAttempts($key, self::PER_HOUR)) {
            abort(429, 'Забагато запитів до ШІ ефіру. Спробуйте за годину.');
        }
        RateLimiter::hit($key, 3600);
        if (! $this->ai->configured()) {
            throw new AiException('ШІ не підключено: додайте ключ в адмінці → Інтеграції.');
        }
    }
}
