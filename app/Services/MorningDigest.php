<?php

namespace App\Services;

use App\Models\Tournament;
use App\Models\TournamentEntry;
use App\Models\User;
use App\Notifications\MorningDigestNotice;
use App\Services\Quests\DailyQuests;
use App\Support\Modules\ModuleManager;
use App\Support\NotifyPrefs;
use Illuminate\Support\Carbon;

/**
 * Ранковий дайджест о 9:00 (Київ): одне сповіщення з тим, що чекає сьогодні —
 * події, на які людина йде, турніри, дні народження друзів, нові завдання й непрочитане.
 * Порожній день — нічого не надсилаємо. Отримують ті, хто заходив за останні 30 днів.
 */
class MorningDigest
{
    public const TZ = 'Europe/Kyiv';

    public function __construct(
        private readonly ModuleManager $modules,
        private readonly FriendshipService $friendships,
        private readonly EventCalendar $calendar,
    ) {}

    public function sendAll(): int
    {
        $sent = 0;
        User::query()->whereNull('banned_at')->whereNull('frozen_at')->where('last_seen_at', '>=', now()->subDays(30))
            ->orderBy('id')->chunkById(200, function ($users) use (&$sent) {
                foreach ($users as $user) {
                    if (! $user->wantsDigest()) {
                        continue;
                    }
                    $lines = $this->lines($user);
                    if ($lines === []) {
                        continue;
                    }
                    $user->notify(new MorningDigestNotice($lines));
                    $sent++;
                }
            });

        return $sent;
    }

    /**
     * Рядки дайджесту (порожньо — нічого цікавого).
     *
     * @return list<string>
     */
    public function lines(User $user): array
    {
        $today = Carbon::now(self::TZ);
        $lines = [];

        $events = array_values(array_filter(
            $this->calendar->upcoming($user),
            fn (array $e) => ($e['status'] ?? null) === 'going' && Carbon::parse($e['starts_at'])->setTimezone(self::TZ)->isSameDay($today),
        ));
        if ($events !== []) {
            $first = $events[0];
            $lines[] = count($events) === 1
                ? 'Подія «'.$first['title'].'» о '.Carbon::parse($first['starts_at'])->setTimezone(self::TZ)->format('H:i')
                : 'Подій сьогодні: '.count($events).' — перша «'.$first['title'].'» о '.Carbon::parse($first['starts_at'])->setTimezone(self::TZ)->format('H:i');
        }

        if ($this->modules->enabled('servers')) {
            $tournament = Tournament::query()
                ->whereIn('id', TournamentEntry::query()->where('user_id', $user->id)->select('tournament_id'))
                ->where(fn ($q) => $q->where('status', Tournament::RUNNING)
                    ->orWhere(fn ($q) => $q->where('status', Tournament::OPEN)->whereBetween('starts_at', [$today->copy()->startOfDay(), $today->copy()->endOfDay()])))
                ->orderBy('starts_at')->first();
            if ($tournament) {
                $lines[] = $tournament->status === Tournament::RUNNING
                    ? 'Турнір «'.$tournament->title.'» триває'
                    : 'Турнір «'.$tournament->title.'» о '.$tournament->starts_at->setTimezone(self::TZ)->format('H:i');
            }
        }

        $birthdays = User::query()->whereIn('id', $this->friendships->friendIds($user))->whereNotNull('birthday')->get(['id', 'first_name', 'last_name', 'birthday'])
            ->filter(fn (User $f) => $f->birthday !== null && $f->birthday->month === $today->month && $f->birthday->day === $today->day)
            ->values();
        if ($birthdays->isNotEmpty()) {
            $lines[] = 'День народження: '.$birthdays->take(3)->map(fn (User $f) => $f->first_name ?: $f->name)->join(', ')
                .($birthdays->count() > 3 ? ' і ще '.($birthdays->count() - 3) : '');
        }

        if ($this->modules->enabled('quests')) {
            $open = count(array_filter(app(DailyQuests::class)->board($user), fn (array $q) => ! $q['claimed']));
            if ($open > 0) {
                $lines[] = 'Завдань дня: '.$open.' — очки до сезонного пропуску';
            }
        }

        $unread = ($this->modules->enabled('messages') ? app(Messenger::class)->unreadConversations($user) : 0);
        $notifications = NotifyPrefs::unreadCount($user);
        if ($unread > 0 || $notifications > 0) {
            $lines[] = 'Непрочитано: '.implode(', ', array_filter([
                $unread > 0 ? 'чатів — '.$unread : null,
                $notifications > 0 ? 'сповіщень — '.$notifications : null,
            ]));
        }

        // Самі завдання дня є щодня — без іншого приводу дайджест не надсилаємо.
        return count($lines) === 1 && str_starts_with($lines[0], 'Завдань дня') ? [] : $lines;
    }
}
