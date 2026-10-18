<?php

namespace App\Services;

use App\Models\Comment;
use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\Post;
use App\Models\User;
use App\Notifications\CommunityActivity;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/** Правила стіни спільноти: свої заборонені слова, повільний режим, черга на перевірку, мітки, привітання. */
class CommunityWall
{
    public const MAX_TAGS = 12;

    public const MAX_WORDS = 100;

    /** Варіанти повільного режиму, секунди. */
    public const SLOW_MODES = [0, 60, 300, 900, 3600, 21600, 86400];

    public function __construct(private readonly ScheduledPosts $scheduled) {}

    /**
     * Перевіряє запис учасника (керівників правила не стосуються).
     */
    public function guard(Community $community, User $user, ?CommunityMember $membership, ?string $body): void
    {
        if ($membership?->isManager() || $user->isStaff()) {
            return;
        }

        $this->ensureClean($community, $body);

        if ($community->slow_mode > 0) {
            $last = $community->posts()
                ->where('author_id', $user->id)
                ->where('created_at', '>', now()->subSeconds($community->slow_mode))
                ->max('created_at');
            if ($last !== null) {
                $wait = max(1, (int) ceil(now()->diffInSeconds(Carbon::parse((string) $last)->addSeconds($community->slow_mode)) / 60));
                throw ValidationException::withMessages(['body' => 'Повільний режим: наступний запис через '.$wait.' хв.']);
            }
        }
    }

    /**
     * Коментар під записом спільноти: лише заборонені слова.
     */
    public function guardComment(Post $post, User $user, ?string $body): void
    {
        $community = $post->wall;
        if (! $community instanceof Community || $community->banned_words === null || $community->banned_words === []) {
            return;
        }
        if ($community->membershipFor($user)?->isManager() || $user->isStaff()) {
            return;
        }
        $this->ensureClean($community, $body);
    }

    public function needsReview(Community $community, ?CommunityMember $membership): bool
    {
        return $community->premoderation && ! $membership?->isManager();
    }

    /**
     * Мітка запису: лише з тих, що задала спільнота.
     */
    public function tag(Community $community, ?string $tag): ?string
    {
        $tag = trim((string) $tag);
        if ($tag === '') {
            return null;
        }
        if (! in_array($tag, $community->post_tags ?? [], true)) {
            throw ValidationException::withMessages(['tag' => 'Такої мітки в спільноті немає.']);
        }

        return $tag;
    }

    public function bannedWord(Community $community, string $text): ?string
    {
        foreach ($community->banned_words ?? [] as $word) {
            if (preg_match('/(?<![\p{L}\p{N}])'.preg_quote($word, '/').'(?![\p{L}\p{N}])/iu', $text) === 1) {
                return $word;
            }
        }

        return null;
    }

    /**
     * Рядки з поля налаштувань → унікальний список без порожніх.
     *
     * @return list<string>
     */
    public static function lines(?string $text, int $max, int $length): array
    {
        $items = [];
        foreach (preg_split('/[\r\n,]+/u', (string) $text) ?: [] as $line) {
            $line = mb_substr(trim($line), 0, $length);
            if ($line !== '' && ! in_array(mb_strtolower($line), array_map('mb_strtolower', $items), true)) {
                $items[] = $line;
            }
        }

        return array_slice($items, 0, $max);
    }

    public function approve(Post $post): void
    {
        $post->forceFill(['is_pending' => false, 'created_at' => $post->publish_at?->isFuture() ? $post->created_at : now()])->save();
        if (! $post->is_draft && ($post->publish_at === null || ! $post->publish_at->isFuture())) {
            $this->scheduled->announce($post);
        }
        $community = $post->wall;
        if ($community instanceof Community && $post->author) {
            $post->author->notify(new CommunityActivity(CommunityActivity::POST_APPROVED, null, $community, $post->id));
        }
    }

    public function reject(Post $post): void
    {
        $community = $post->wall;
        $author = $post->author;
        $post->delete();
        if ($community instanceof Community && $author) {
            $author->notify(new CommunityActivity(CommunityActivity::POST_REJECTED, null, $community));
        }
    }

    /** Керівникам — про новий запис у черзі. */
    public function announcePending(Post $post, Community $community): void
    {
        $managers = User::query()
            ->whereIn('id', $community->activeMembers()->whereIn('role', CommunityMember::MANAGER_ROLES)->select('user_id'))
            ->whereKeyNot($post->author_id)
            ->get();
        Notification::send($managers, new CommunityActivity(CommunityActivity::POST_PENDING, $post->author, $community));
    }

    public function welcome(Community $community, User $user): void
    {
        if (trim((string) $community->welcome) !== '') {
            $user->notify(new CommunityActivity(CommunityActivity::WELCOME, null, $community));
        }
    }

    /**
     * Для адмінів: хто прийшов і хто пише за останні 30 днів, вступи по тижнях.
     *
     * @return array{joined: int, authors: int, posts: int, comments: int, active_share: int, weeks: list<array{week: string, joined: int, posts: int}>}
     */
    public function stats(Community $community): array
    {
        $since = now()->subDays(30);
        $posts = $community->posts()->where('is_draft', false)->where('is_pending', false);
        $postIds = (clone $posts)->select('id');
        $authors = (clone $posts)->where('created_at', '>=', $since)->distinct()->pluck('author_id');
        $commenters = Comment::query()->whereIn('post_id', $postIds)->where('created_at', '>=', $since)->distinct()->pluck('user_id');
        $writers = $authors->merge($commenters)->unique()->count();

        $weeks = [];
        for ($i = 7; $i >= 0; $i--) {
            $from = now()->startOfWeek()->subWeeks($i);
            $to = $from->copy()->addWeek();
            $weeks[] = [
                'week' => $from->toDateString(),
                'joined' => $community->activeMembers()->whereBetween('created_at', [$from, $to])->count(),
                'posts' => (clone $posts)->whereBetween('created_at', [$from, $to])->count(),
            ];
        }

        return [
            'joined' => $community->activeMembers()->where('created_at', '>=', $since)->count(),
            'authors' => $writers,
            'posts' => (clone $posts)->where('created_at', '>=', $since)->count(),
            'comments' => Comment::query()->whereIn('post_id', $postIds)->where('created_at', '>=', $since)->count(),
            'active_share' => $community->members_count > 0 ? (int) round($writers * 100 / $community->members_count) : 0,
            'weeks' => $weeks,
        ];
    }

    private function ensureClean(Community $community, ?string $body): void
    {
        if ($body !== null && $body !== '' && $this->bannedWord($community, $body) !== null) {
            throw ValidationException::withMessages(['body' => 'Запис містить слово, заборонене правилами спільноти.']);
        }
    }
}
