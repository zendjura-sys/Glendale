<?php

namespace App\Services\Events;

use App\Models\SiteEvent;
use App\Models\User;
use App\Models\UserCosmetic;
use App\Services\Quests\SeasonPass;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Сезонні події: прогрес рахується з реальної активності за час події (записи, коментарі,
 * моменти, прослушування, фото, огляди) — без окремих лічильників. Спільна мета — сума по всіх.
 * Нагорода (косметика сезонного пропуску) лягає в інвентар один раз.
 */
class SiteEvents
{
    /** Метрика → [таблиця, колонка людини, колонка часу]. */
    public const METRICS = [
        'posts' => ['posts', 'author_id', 'created_at'],
        'comments' => ['comments', 'user_id', 'created_at'],
        'moments' => ['moments', 'user_id', 'created_at'],
        'plays' => ['music_plays', 'user_id', 'played_at'],
        'photos' => ['photos', 'user_id', 'created_at'],
        'reviews' => ['game_reviews', 'user_id', 'created_at'],
    ];

    /** Нагорода може бути лише косметикою, яку можна вдягнути. */
    public const REWARD_TYPES = ['frame', 'name', 'badge', 'header'];

    /**
     * Коротко про поточну подію для банера (спільний пропс, кеш хвилину).
     *
     * @return array{slug: string, title: string, theme: string, ends_at: string}|null
     */
    public function banner(): ?array
    {
        $e = $this->active();

        return $e ? ['slug' => $e->slug, 'title' => $e->title, 'theme' => $e->theme, 'ends_at' => $e->ends_at->toIso8601String()] : null;
    }

    public function active(): ?SiteEvent
    {
        $id = Cache::remember('site_event.active', 60, fn () => SiteEvent::query()
            ->where('starts_at', '<=', now())->where('ends_at', '>', now())->orderBy('ends_at')->value('id'));

        return $id ? SiteEvent::query()->find($id) : null;
    }

    public function count(SiteEvent $event, string $metric, ?int $userId): int
    {
        [$table, $userCol, $timeCol] = self::METRICS[$metric] ?? [null, null, null];
        if ($table === null) {
            return 0;
        }

        return (int) DB::table($table)->whereBetween($timeCol, [$event->starts_at, $event->ends_at])
            ->when($userId !== null, fn ($q) => $q->where($userCol, $userId))->count();
    }

    /**
     * Картка події для людини: завдання з прогресом, спільна мета, нагорода, чи можна забрати.
     *
     * @return array<string, mixed>
     */
    public function card(SiteEvent $event, ?User $user): array
    {
        $tasks = array_map(function (array $t) use ($event, $user) {
            $done = $user ? min((int) $t['target'], $this->count($event, $t['metric'], $user->id)) : 0;

            return ['metric' => $t['metric'], 'target' => (int) $t['target'], 'done' => $done];
        }, $event->tasks);
        $goal = $event->goal_metric && $event->goal_target
            ? ['metric' => $event->goal_metric, 'target' => $event->goal_target,
                'done' => Cache::remember("site_event.goal.{$event->id}", 300, fn () => $this->count($event, (string) $event->goal_metric, null))]
            : null;
        $complete = $tasks !== [] && collect($tasks)->every(fn ($t) => $t['done'] >= $t['target']);
        $claimed = $user && DB::table('site_event_claims')->where('site_event_id', $event->id)->where('user_id', $user->id)->exists();

        return [
            'id' => $event->id,
            'slug' => $event->slug,
            'title' => $event->title,
            'description' => $event->description,
            'theme' => $event->theme,
            'starts_at' => $event->starts_at->toIso8601String(),
            'ends_at' => $event->ends_at->toIso8601String(),
            'active' => $event->isActive(),
            'tasks' => $tasks,
            'goal' => $goal,
            'reward' => array_values(array_filter(array_map(fn (array $r) => app(SeasonPass::class)->reward($r), $event->reward))),
            'complete' => $complete,
            'claimed' => $claimed,
            'claimers' => DB::table('site_event_claims')->where('site_event_id', $event->id)->count(),
        ];
    }

    /** Забрати нагороду: усі завдання виконані, подія ще йде (або щойно закінчилась — 3 дні на це). */
    public function claim(SiteEvent $event, User $user): void
    {
        abort_if($event->starts_at->isFuture() || $event->ends_at->lt(now()->subDays(3)), 422, 'Подія вже закінчилась.');
        $card = $this->card($event, $user);
        if (! $card['complete']) {
            throw ValidationException::withMessages(['event' => 'Спершу виконайте всі завдання події.']);
        }
        DB::transaction(function () use ($event, $user) {
            $inserted = DB::table('site_event_claims')->insertOrIgnore(['site_event_id' => $event->id, 'user_id' => $user->id, 'created_at' => now()]);
            if ($inserted === 0) {
                return;
            }
            foreach ($event->reward as $r) {
                UserCosmetic::query()->firstOrCreate(['user_id' => $user->id, 'type' => $r['type'], 'value' => $r['value']], ['source' => 'event:'.$event->slug]);
            }
        });
        Log::info('site_event: reward claimed', ['event' => $event->id, 'user' => $user->id]);
    }
}
