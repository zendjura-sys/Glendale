<?php

namespace App\Services\Ai;

use App\Models\FamilyMember;
use App\Models\FamilyShift;
use App\Models\Post;
use App\Models\User;
use App\Services\Families\ShiftGoals;
use App\Services\FriendshipService;
use App\Services\MorningDigest;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

/**
 * ШІ-зведення дня (сторінка «Сьогодні»): факти дня людини — події, зміни сім’ї, дні народження,
 * найкраще в друзів за добу, непрочитане — і короткий переказ від ШІ поверх них.
 * Без ключа ШІ чи з вимкненим плагіном лишаються самі факти. Переказ кешується, доки факти ті самі.
 */
class DailyBrief
{
    public function __construct(
        private readonly AiClient $ai,
        private readonly MorningDigest $digest,
        private readonly FriendshipService $friendships,
    ) {}

    /**
     * @return array{date: string, facts: list<array{icon: string, text: string, href: string|null}>, summary: string|null, ai: bool}
     */
    public function for(User $user, bool $refresh = false): array
    {
        $facts = $this->facts($user);
        $ai = app(Plugins::class)->on('ai_daily_brief');
        $summary = null;
        if ($ai && $facts !== []) {
            $key = 'ai.brief.'.$user->id.'.'.md5((string) json_encode($facts));
            $summary = $refresh ? null : Cache::get($key);
            if ($summary === null && $this->allowed($user)) {
                try {
                    $summary = $this->summarize($user, $facts);
                    Cache::put($key, $summary, now()->addHours(3));
                } catch (AiException) {
                    $summary = null;
                }
            }
        }

        return [
            'date' => Carbon::now(MorningDigest::TZ)->toDateString(),
            'facts' => $facts,
            'summary' => $summary,
            'ai' => $ai,
        ];
    }

    /**
     * Факти дня рядками з посиланнями (без ШІ).
     *
     * @return list<array{icon: string, text: string, href: string|null}>
     */
    public function facts(User $user): array
    {
        $today = Carbon::now(MorningDigest::TZ);
        $facts = [];

        // Зміни сім’ї, які людина взяла на сьогодні.
        $members = FamilyMember::query()->with('family')->where('user_id', $user->id)->where('status', FamilyMember::STATUS_ACTIVE)->get();
        if ($members->isNotEmpty()) {
            $shifts = FamilyShift::query()->whereIn('member_id', $members->pluck('id'))
                ->whereBetween('starts_at', [$today->copy()->startOfDay()->utc(), $today->copy()->endOfDay()->utc()])
                ->orderBy('starts_at')->limit(3)->get();
            foreach ($shifts as $shift) {
                $family = $members->firstWhere('id', $shift->member_id)?->family;
                $facts[] = [
                    'icon' => 'shift',
                    'text' => 'Зміна «'.$shift->title.'» о '.$shift->starts_at->setTimezone(MorningDigest::TZ)->format('H:i')
                        .($shift->goal ? ' — завдання: '.ShiftGoals::label($shift->goal) : ''),
                    'href' => $family ? '/f/'.$family->slug.'/shifts' : null,
                ];
            }
        }

        // Ранковий дайджест: події, турніри, дні народження, завдання, непрочитане.
        foreach ($this->digest->lines($user) as $line) {
            $facts[] = ['icon' => $this->iconFor($line), 'text' => $line, 'href' => $this->hrefFor($line)];
        }

        // Найкраще в друзів за добу.
        $friendIds = $this->friendships->friendIds($user);
        if ($friendIds !== []) {
            $posts = Post::query()->with('author')->visibleTo($user, $friendIds)
                ->whereIn('author_id', $friendIds)->where('as_community', false)
                ->where('created_at', '>=', now()->subDay())
                ->orderByRaw('likes_count + comments_count * 2 desc')->limit(3)->get();
            foreach ($posts as $post) {
                $excerpt = Str::limit(trim((string) preg_replace('/\s+/u', ' ', (string) $post->body)), 90);
                $facts[] = [
                    'icon' => 'post',
                    'text' => ($post->author->name ?? 'Друг').($excerpt !== '' ? ': «'.$excerpt.'»' : ' поділився записом')
                        .($post->likes_count > 0 ? ' · ♥ '.$post->likes_count : ''),
                    'href' => '/posts/'.$post->id,
                ];
            }
        }

        return $facts;
    }

    /**
     * @param  list<array{icon: string, text: string, href: string|null}>  $facts
     *
     * @throws AiException
     */
    private function summarize(User $user, array $facts): string
    {
        $list = implode("\n", array_map(fn (array $f) => '- '.$f['text'], $facts));
        $name = $user->first_name ?: $user->name;

        return trim($this->ai->complete(
            'Ти — помічник соцмережі для геймерів GameCon. Напиши коротке зведення дня українською для людини на ім’я '.$name.': 2–4 речення, дружньо, без вступу на кшталт «Ось зведення». '
            .'Спершу найважливіше на сьогодні (час подій і змін), далі друзі й непрочитане. Не вигадуй нічого, чого немає у фактах, не додавай посилань і списків.',
            [['role' => 'user', 'content' => "Факти дня:\n".$list]],
            400,
            [],
            'brief',
        ));
    }

    /** Окремий ліміт на зведення: 10 переказів на годину на людину. */
    private function allowed(User $user): bool
    {
        $key = 'ai-brief:'.$user->id;
        if (RateLimiter::tooManyAttempts($key, 10)) {
            return false;
        }
        RateLimiter::hit($key, 3600);

        return true;
    }

    private function iconFor(string $line): string
    {
        return match (true) {
            str_starts_with($line, 'Под') => 'event',
            str_starts_with($line, 'Турнір') => 'tournament',
            str_starts_with($line, 'День народження') => 'birthday',
            str_starts_with($line, 'Завдань') => 'quest',
            default => 'unread',
        };
    }

    private function hrefFor(string $line): ?string
    {
        return match (true) {
            str_starts_with($line, 'Под') => '/events',
            str_starts_with($line, 'Турнір') => '/tournaments',
            str_starts_with($line, 'День народження') => '/friends',
            str_starts_with($line, 'Завдань') => '/quests',
            str_starts_with($line, 'Непрочитано') => '/messages',
            default => null,
        };
    }
}
