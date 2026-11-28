<?php

namespace App\Services\Feed;

use App\Models\Post;
use App\Models\User;
use App\Models\UserBlock;
use App\Notifications\AccountNotice;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Сповіщення за ключовими словами: людина задає до 10 слів (назва гри, нік, тема) — і дізнається
 * про нові публічні записи з ними. Не частіше разу на годину за одним словом.
 */
class KeywordAlerts
{
    public const MAX = 10;

    /**
     * @return list<string>
     */
    public function for(User $user): array
    {
        return array_values(DB::table('keyword_alerts')->where('user_id', $user->id)->orderBy('keyword')->pluck('keyword')->map(fn ($k) => (string) $k)->all());
    }

    public function add(User $user, string $keyword): void
    {
        $keyword = Str::lower(trim(preg_replace('/\s+/u', ' ', $keyword) ?? ''));
        if (mb_strlen($keyword) < 3) {
            throw ValidationException::withMessages(['keyword' => 'Слово має бути від 3 символів.']);
        }
        if (DB::table('keyword_alerts')->where('user_id', $user->id)->count() >= self::MAX) {
            throw ValidationException::withMessages(['keyword' => 'Можна стежити за 10 словами.']);
        }
        DB::table('keyword_alerts')->insertOrIgnore(['user_id' => $user->id, 'keyword' => mb_substr($keyword, 0, 40), 'created_at' => now()]);
        Cache::forget('keyword-alerts:all');
    }

    public function remove(User $user, string $keyword): void
    {
        DB::table('keyword_alerts')->where('user_id', $user->id)->where('keyword', Str::lower(trim($keyword)))->delete();
        Cache::forget('keyword-alerts:all');
    }

    /** Новий публічний запис: кому з тих, хто стежить за словом із тексту, надіслати сповіщення. */
    public function match(Post $post): void
    {
        if ($post->is_draft || $post->is_pending || $post->visibility !== 'public' || trim((string) $post->body) === '') {
            return;
        }
        $body = ' '.Str::lower((string) $post->body).' ';
        /** @var list<string> $keywords */
        $keywords = Cache::remember('keyword-alerts:all', now()->addMinutes(10), fn () => array_values(DB::table('keyword_alerts')->distinct()->pluck('keyword')->map(fn ($k) => (string) $k)->all()));
        $hits = array_values(array_filter($keywords, fn (string $k) => preg_match('/(?<![\p{L}\p{N}])'.preg_quote($k, '/').'(?![\p{L}\p{N}])/u', $body) === 1));
        if ($hits === []) {
            return;
        }
        $author = $post->author;
        $rows = DB::table('keyword_alerts')->whereIn('keyword', $hits)->where('user_id', '!=', $post->author_id)->get(['user_id', 'keyword']);
        $users = User::query()->whereIn('id', $rows->pluck('user_id')->unique())->get()->keyBy('id');
        foreach ($rows->groupBy('user_id') as $userId => $matches) {
            $user = $users->get($userId);
            $keyword = (string) $matches->first()->keyword;
            if (! $user instanceof User || ($author && UserBlock::either($user, $author)) || ! Cache::add("keyword-alert:{$userId}:{$keyword}", true, now()->addHour())) {
                continue;
            }
            $user->notify(new AccountNotice('keyword', $author, 'Нове про «'.$keyword.'»', Str::limit((string) $post->body, 120), '/posts/'.$post->id));
        }
    }
}
