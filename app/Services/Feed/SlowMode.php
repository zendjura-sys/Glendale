<?php

namespace App\Services\Feed;

use App\Models\Comment;
use App\Models\Post;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Повільний режим коментарів: на гарячому записі кожен пише не частіше, ніж раз на інтервал.
 * Вмикається сам, коли під записом зливаються десятки коментарів за кілька хвилин, або вручну —
 * автором запису чи персоналом. Автор і персонал пишуть без обмежень.
 */
class SlowMode
{
    /** Скільки коментарів за вікно роблять запис «гарячим». */
    public const HOT_COMMENTS = 25;

    public const HOT_WINDOW_MINUTES = 10;

    /** Автоматичний режим: інтервал і тривалість. */
    public const AUTO_SECONDS = 60;

    public const AUTO_MINUTES = 60;

    /** Інтервали, які можна обрати вручну (0 — вимкнено). */
    public const CHOICES = [0, 15, 30, 60, 120, 300];

    public function active(Post $post): bool
    {
        return ($post->slow_mode_seconds ?? 0) > 0 && $post->slow_mode_until !== null && $post->slow_mode_until->isFuture();
    }

    /**
     * Стан для картки запису.
     *
     * @return array{seconds: int, until: string, auto: bool}|null
     */
    public function card(Post $post): ?array
    {
        return $this->active($post)
            ? ['seconds' => (int) $post->slow_mode_seconds, 'until' => $post->slow_mode_until->toIso8601String(), 'auto' => (bool) $post->slow_mode_auto]
            : null;
    }

    public function exempt(Post $post, User $user): bool
    {
        return $post->author_id === $user->id || $user->isStaff();
    }

    /** Перед новим коментарем: чи минув інтервал від попереднього коментаря цієї людини. */
    public function guard(Post $post, User $user): void
    {
        if (! $this->active($post) || $this->exempt($post, $user)) {
            return;
        }
        $last = Comment::query()->where('post_id', $post->id)->where('user_id', $user->id)->latest('id')->value('created_at');
        if ($last === null) {
            return;
        }
        $wait = (int) ceil((int) $post->slow_mode_seconds - now()->parse($last)->diffInSeconds(now(), true));
        if ($wait > 0) {
            throw ValidationException::withMessages(['body' => "Повільний режим: наступний коментар можна написати через {$wait} с."]);
        }
    }

    /** Після коментаря: увімкнути режим, якщо запис «загорівся». */
    public function afterComment(Post $post): void
    {
        if ($this->active($post)) {
            return;
        }
        $recent = Comment::query()->where('post_id', $post->id)->where('created_at', '>=', now()->subMinutes(self::HOT_WINDOW_MINUTES))->count();
        if ($recent >= self::HOT_COMMENTS) {
            $post->forceFill(['slow_mode_seconds' => self::AUTO_SECONDS, 'slow_mode_until' => now()->addMinutes(self::AUTO_MINUTES), 'slow_mode_auto' => true])->save();
            Log::info('slow_mode: auto enabled', ['post' => $post->id, 'recent' => $recent]);
        }
    }

    /** Вручну: автор запису або персонал. */
    public function set(Post $post, User $by, int $seconds, int $minutes): void
    {
        $post->forceFill([
            'slow_mode_seconds' => $seconds > 0 ? $seconds : null,
            'slow_mode_until' => $seconds > 0 ? now()->addMinutes($minutes) : null,
            'slow_mode_auto' => false,
        ])->save();
        Log::info('slow_mode: set', ['post' => $post->id, 'by' => $by->id, 'seconds' => $seconds, 'minutes' => $minutes]);
    }
}
