<?php

namespace App\Services;

use App\Models\Community;
use App\Models\Post;
use Illuminate\Support\Str;

/**
 * Тижневий дайджест спільноти: щопонеділка найкращі записи тижня (за реакціями й коментарями)
 * збираються в один запис від імені спільноти. Вмикає адмін у правилах спільноти.
 */
class CommunityDigest
{
    /** Скільки записів у дайджесті і скільки потрібно, щоб він вийшов. */
    public const TOP = 5;

    public const MIN_POSTS = 3;

    public function publish(Community $community): ?Post
    {
        if (! $community->weekly_digest || $community->owner_id === null) {
            return null;
        }
        $from = now()->subWeek();
        $posts = $community->posts()->with('author')
            ->where('is_draft', false)->where('is_pending', false)->where('as_community', false)
            ->where('created_at', '>=', $from)
            ->get();
        if ($posts->count() < self::MIN_POSTS) {
            return null;
        }
        $top = $posts->sortByDesc(fn (Post $p) => (int) $p->likes_count * 2 + (int) $p->comments_count * 3)->take(self::TOP);
        $lines = [];
        foreach ($top->values() as $i => $post) {
            $excerpt = Str::limit(trim((string) preg_replace('/\s+/u', ' ', (string) $post->body)), 90) ?: 'Запис без тексту';
            $lines[] = ($i + 1).'. '.$post->author->name.': «'.$excerpt.'» — '.url('/posts/'.$post->id);
        }
        $body = "Найкраще в спільноті за тиждень:\n\n".implode("\n", $lines)
            ."\n\nЗаписів за тиждень: ".$posts->count().'. Пишіть більше — потрапите в наступний дайджест!';

        return Post::query()->create([
            'author_id' => $community->owner_id,
            'wall_type' => 'community',
            'wall_id' => $community->id,
            'as_community' => true,
            'body' => $body,
            'visibility' => 'public',
            'comments_enabled' => true,
        ]);
    }

    /** Усі спільноти з увімкненим дайджестом. */
    public function run(): int
    {
        $count = 0;
        Community::query()->where('weekly_digest', true)->each(function (Community $community) use (&$count) {
            $count += $this->publish($community) !== null ? 1 : 0;
        });

        return $count;
    }
}
