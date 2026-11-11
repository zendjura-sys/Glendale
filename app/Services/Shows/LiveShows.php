<?php

namespace App\Services\Shows;

use App\Jobs\EndShowQuestion;
use App\Models\LiveShow;
use App\Models\LiveShowMember;
use App\Models\User;
use App\Services\Feed\Topics;
use App\Services\Moderation\ContentFilter;
use App\Services\Voice\LiveKit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

/**
 * Шоу наживо (як аудіошоу в Stereo, але своє): ведучі говорять на сцені, слухачі піднімають руку,
 * ведучий дає гостю слово на `question_seconds` — потім сервер сам забирає мікрофон.
 * Присутність — за опитуванням стану: хто не озивався SEEN_SECONDS, той уже не слухає.
 */
class LiveShows
{
    public const SEEN_SECONDS = 45;

    private const TRENDS_KEY = 'shows:trends';

    /** Тема в трендах, якщо за тиждень її слухали щонайменше стільки людей (разом з ефіром зараз) або про неї кілька кімнат. */
    public const TREND_LISTENERS = 5;

    public const TREND_SHOWS = 2;

    public function __construct(private readonly LiveKit $livekit) {}

    /**
     * @param  array{title: string, topic?: string|null, topics?: list<string>|null, format: string, stage_seats?: int|null, guest_seats?: int|null, question_seconds?: int|null, scheduled_at?: string|null}  $data
     */
    public function create(User $host, array $data): LiveShow
    {
        $format = $data['format'];
        $preset = LiveShow::FORMATS[$format];
        $custom = $format === 'custom';
        $at = isset($data['scheduled_at']) ? Carbon::parse($data['scheduled_at']) : null;
        $later = $at !== null && $at->isAfter(now()->addMinutes(2));
        $title = trim($data['title']);
        // Теми: список або один рядок «#a #b» (стара форма й застосунок). До 5 різних.
        $raw = $data['topics'] ?? preg_split('/[\s,]+/u', (string) ($data['topic'] ?? ''), -1, PREG_SPLIT_NO_EMPTY);
        $topics = array_values(array_unique(array_filter(array_map(fn ($t) => Topics::normalize((string) $t), is_array($raw) ? $raw : []))));
        if (count($topics) > LiveShow::MAX_TOPICS) {
            throw ValidationException::withMessages(['topics' => 'Можна додати щонайбільше '.LiveShow::MAX_TOPICS.' тем.']);
        }
        foreach ($topics as $t) {
            if (! Topics::valid($t) || mb_strlen($t) > 30) {
                throw ValidationException::withMessages(['topics' => 'Тема — одне слово без пробілів, як хештег.']);
            }
        }
        foreach (['title' => $title, 'topics' => implode(' ', $topics)] as $field => $text) {
            if ($text !== '' && app(ContentFilter::class)->hasProfanity($text)) {
                throw ValidationException::withMessages([$field => 'Так назвати шоу не можна.']);
            }
        }

        $show = LiveShow::query()->create([
            'host_id' => $host->id,
            'title' => $title,
            'topic' => $topics[0] ?? null,
            'topics' => $topics ?: null,
            'format' => $format,
            'stage_seats' => $custom ? (int) ($data['stage_seats'] ?? $preset['stage']) : $preset['stage'],
            'guest_seats' => $custom ? (int) ($data['guest_seats'] ?? $preset['guests']) : $preset['guests'],
            'question_seconds' => $custom ? (int) ($data['question_seconds'] ?? 60) : 60,
            'status' => $later ? LiveShow::SCHEDULED : LiveShow::LIVE,
            'scheduled_at' => $later ? $at : null,
            'started_at' => $later ? null : now(),
        ]);
        LiveShowMember::query()->create(['live_show_id' => $show->id, 'user_id' => $host->id, 'role' => 'host']);
        Cache::forget(self::TRENDS_KEY);

        return $show;
    }

    public function start(LiveShow $show): void
    {
        abort_unless($show->status === LiveShow::SCHEDULED, 422, 'Шоу вже в ефірі або завершене.');
        $show->update(['status' => LiveShow::LIVE, 'started_at' => now()]);
    }

    public function end(LiveShow $show): void
    {
        if ($show->status === LiveShow::ENDED) {
            return;
        }
        $show->update(['status' => LiveShow::ENDED, 'ended_at' => now()]);
        LiveShowMember::query()->where('live_show_id', $show->id)->update(['hand_at' => null, 'mic_until' => null]);
        $this->livekit->deleteRoom($show->livekitName());
    }

    public function member(LiveShow $show, User $user): ?LiveShowMember
    {
        return LiveShowMember::query()->where('live_show_id', $show->id)->where('user_id', $user->id)->first();
    }

    public function isHost(LiveShow $show, User $user): bool
    {
        return $show->host_id === $user->id;
    }

    /** Ведучий або співведучий — бачить черту рук і дає слово. */
    public function isStage(LiveShow $show, User $user): bool
    {
        return in_array($this->member($show, $user)?->role, ['host', 'speaker'], true);
    }

    /**
     * Вхід у звук: токен LiveKit. Говорити можуть лише ті, кому дозволено зараз.
     *
     * @return array{url: string, token: string, identity: string}
     */
    public function join(LiveShow $show, User $user): array
    {
        abort_unless($show->status === LiveShow::LIVE, 422, 'Шоу зараз не в ефірі.');
        abort_unless($this->livekit->configured(), 503, 'Голосовий сервер не налаштовано.');
        $member = LiveShowMember::query()->firstOrCreate(
            ['live_show_id' => $show->id, 'user_id' => $user->id],
            ['role' => 'listener'],
        );
        $member->update(['seen_at' => now()]);
        $this->countListeners($show);
        $identity = 'u'.$user->id;

        return [
            'url' => (string) $this->livekit->url(),
            'token' => $this->livekit->token(
                $identity,
                $user->name,
                $show->livekitName(),
                $member->canSpeak() ? [] : ['canPublish' => false, 'canPublishSources' => []],
                (string) json_encode(['user_id' => $user->id]),
            ),
            'identity' => $identity,
        ];
    }

    /** Слухач (і будь-хто без сцени) піднімає чи опускає руку. */
    public function hand(LiveShow $show, User $user, bool $raised): void
    {
        abort_unless($show->status === LiveShow::LIVE, 422, 'Шоу зараз не в ефірі.');
        $member = $this->member($show, $user);
        abort_if($member === null, 422, 'Спершу зайдіть у шоу.');
        abort_if(in_array($member->role, ['host', 'speaker'], true), 422, 'Ви вже на сцені.');
        $member->update(['hand_at' => $raised ? now() : null]);
    }

    /** Ведучий дає слово гостю на `question_seconds`; місць для гостей — `guest_seats`. */
    public function giveFloor(LiveShow $show, User $target): LiveShowMember
    {
        abort_unless($show->status === LiveShow::LIVE, 422, 'Шоу зараз не в ефірі.');
        $this->expire($show);
        $member = $this->member($show, $target);
        abort_if($member === null, 422, 'Цієї людини немає в шоу.');
        abort_if(in_array($member->role, ['host', 'speaker'], true), 422, 'Ця людина вже на сцені.');
        $busy = LiveShowMember::query()->where('live_show_id', $show->id)->where('role', 'guest')->where('mic_until', '>', now())->count();
        abort_if($show->guest_seats < 1, 422, 'У цьому шоу гостей не запрошують.');
        abort_if($busy >= $show->guest_seats, 422, 'Усі місця для питань зайняті — зачекайте, поки гість договорить.');

        $until = now()->addSeconds($show->question_seconds);
        $member->update(['role' => 'guest', 'mic_until' => $until, 'hand_at' => null]);
        $this->livekit->setCanPublish($show->livekitName(), 'u'.$target->id, true);
        EndShowQuestion::dispatch($show->id, $target->id, $until->toIso8601String())->delay($until);

        return $member;
    }

    /** Забрати слово: гість повертається в слухачі. */
    public function takeFloor(LiveShow $show, User $target): void
    {
        $member = $this->member($show, $target);
        if ($member === null || $member->role !== 'guest') {
            return;
        }
        $member->update(['role' => 'listener', 'mic_until' => null]);
        $this->livekit->setCanPublish($show->livekitName(), 'u'.$target->id, false);
    }

    /** Гостям, чий час вийшов, — мікрофон геть (і задачею, і ліниво при кожному показі стану). */
    public function expire(LiveShow $show): void
    {
        $done = LiveShowMember::query()->with('user')->where('live_show_id', $show->id)->where('role', 'guest')
            ->where(fn ($q) => $q->whereNull('mic_until')->orWhere('mic_until', '<=', now()))->get();
        foreach ($done as $member) {
            if ($member->user) {
                $this->takeFloor($show, $member->user);
            }
        }
    }

    /** Співведучий на сцені (запрошення від ведучого за ніком). */
    public function addSpeaker(LiveShow $show, User $target): void
    {
        $onStage = LiveShowMember::query()->where('live_show_id', $show->id)->whereIn('role', ['host', 'speaker'])->count();
        $member = $this->member($show, $target);
        if ($member !== null && in_array($member->role, ['host', 'speaker'], true)) {
            return;
        }
        abort_if($onStage >= $show->stage_seats, 422, 'На сцені вже немає вільних місць.');
        LiveShowMember::query()->updateOrCreate(
            ['live_show_id' => $show->id, 'user_id' => $target->id],
            ['role' => 'speaker', 'hand_at' => null, 'mic_until' => null],
        );
        $this->livekit->setCanPublish($show->livekitName(), 'u'.$target->id, true);
    }

    public function removeSpeaker(LiveShow $show, User $target): void
    {
        abort_if($target->id === $show->host_id, 422, 'Ведучого зі сцени не прибрати.');
        LiveShowMember::query()->where('live_show_id', $show->id)->where('user_id', $target->id)->where('role', 'speaker')
            ->update(['role' => 'listener']);
        $this->livekit->setCanPublish($show->livekitName(), 'u'.$target->id, false);
    }

    public function leave(LiveShow $show, User $user): void
    {
        $member = $this->member($show, $user);
        if ($member === null) {
            return;
        }
        if ($member->role === 'guest') {
            $this->takeFloor($show, $user);
        }
        $member->update(['seen_at' => null, 'hand_at' => null]);
    }

    /** Відмітка «я тут» (опитування стану кожні кілька секунд). */
    public function touch(LiveShow $show, User $user): void
    {
        LiveShowMember::query()->where('live_show_id', $show->id)->where('user_id', $user->id)->update(['seen_at' => now()]);
    }

    private function countListeners(LiveShow $show): void
    {
        $now = $this->present($show)->count();
        if ($now > $show->peak_listeners) {
            $show->update(['peak_listeners' => $now]);
        }
    }

    /** @return Builder<LiveShowMember> */
    private function present(LiveShow $show): Builder
    {
        return LiveShowMember::query()->where('live_show_id', $show->id)->where('seen_at', '>=', now()->subSeconds(self::SEEN_SECONDS));
    }

    /**
     * Пульс ефіру для кнопки GameCast.
     *
     * @return array{live: int, listeners: int}
     */
    public function pulse(): array
    {
        return Cache::remember('shows:pulse', 20, function () {
            $shows = LiveShow::query()->where('status', LiveShow::LIVE)->limit(200)->get();

            return ['live' => $shows->count(), 'listeners' => (int) $shows->sum(fn (LiveShow $s) => $this->present($s)->count())];
        });
    }

    /**
     * Тренди тем: кімнати в ефірі й за останній тиждень. Вага теми — слухачі зараз і пік завершених.
     *
     * @return list<array{tag: string, shows: int, live: int, listeners: int}>
     */
    public function trends(int $limit = 10): array
    {
        /** @var list<array{tag: string, shows: int, live: int, listeners: int}> $all */
        $all = Cache::remember(self::TRENDS_KEY, 60, function () {
            $rows = [];
            $shows = LiveShow::query()
                ->where(fn (Builder $q) => $q->where('status', LiveShow::LIVE)
                    ->orWhere(fn (Builder $e) => $e->where('status', LiveShow::ENDED)->where('ended_at', '>=', now()->subWeek())))
                ->latest('id')->limit(500)->get();
            foreach ($shows as $show) {
                $live = $show->status === LiveShow::LIVE;
                $now = $live ? $this->present($show)->count() : 0;
                $heard = max($now, (int) $show->peak_listeners);
                foreach ($show->topicList() as $tag) {
                    $rows[$tag] ??= ['tag' => $tag, 'shows' => 0, 'live' => 0, 'listeners' => 0, 'score' => 0];
                    $rows[$tag]['shows']++;
                    $rows[$tag]['live'] += $live ? 1 : 0;
                    $rows[$tag]['listeners'] += $heard;
                    $rows[$tag]['score'] += $heard + ($live ? $now * 2 + 1 : 0);
                }
            }
            $popular = array_filter($rows, fn (array $r) => $r['listeners'] >= self::TREND_LISTENERS || $r['shows'] >= self::TREND_SHOWS);
            usort($popular, fn (array $a, array $b) => [$b['score'], $a['tag']] <=> [$a['score'], $b['tag']]);

            return array_map(fn (array $r) => ['tag' => $r['tag'], 'shows' => $r['shows'], 'live' => $r['live'], 'listeners' => $r['listeners']], array_slice($popular, 0, 20));
        });

        return array_slice($all, 0, $limit);
    }

    /**
     * Картка шоу для стрічки «Зараз в ефірі» й розкладу.
     *
     * @return array<string, mixed>
     */
    public function card(LiveShow $show): array
    {
        $show->loadMissing('host');
        $stage = LiveShowMember::query()->with('user')->where('live_show_id', $show->id)->whereIn('role', ['host', 'speaker'])
            ->orderByRaw("role = 'host' desc")->orderBy('id')->get();

        return [
            'id' => $show->id,
            'title' => $show->title,
            'topic' => $show->topic,
            'topics' => $show->topicList(),
            'format' => $show->format,
            'status' => $show->status,
            'scheduled_at' => $show->scheduled_at?->toIso8601String(),
            'started_at' => $show->started_at?->toIso8601String(),
            'listeners' => $show->status === LiveShow::LIVE ? $this->present($show)->count() : 0,
            'host' => $show->host?->toCard(),
            'stage' => $stage->map(fn (LiveShowMember $m) => $m->user?->toCard())->filter()->values(),
        ];
    }

    /**
     * Повний стан для сторінки шоу (опитується кожні кілька секунд).
     *
     * @return array<string, mixed>
     */
    public function state(LiveShow $show, ?User $viewer): array
    {
        if ($show->status === LiveShow::LIVE) {
            $this->expire($show);
        }
        if ($viewer !== null && $show->status === LiveShow::LIVE) {
            $this->touch($show, $viewer);
        }
        /** @var Collection<int, LiveShowMember> $members */
        $members = LiveShowMember::query()->with('user')->where('live_show_id', $show->id)->get();
        $fresh = now()->subSeconds(self::SEEN_SECONDS);
        $here = $members->filter(fn (LiveShowMember $m) => $m->seen_at !== null && $m->seen_at->gte($fresh));
        $me = $viewer ? $members->firstWhere('user_id', $viewer->id) : null;
        $stageView = $me !== null && in_array($me->role, ['host', 'speaker'], true);
        $person = fn (LiveShowMember $m) => [...($m->user?->toCard() ?? []), 'role' => $m->role];

        return [
            'show' => [...$this->card($show), 'stage_seats' => $show->stage_seats, 'guest_seats' => $show->guest_seats, 'question_seconds' => $show->question_seconds, 'peak_listeners' => $show->peak_listeners],
            'stage' => $members->whereIn('role', ['host', 'speaker'])->sortBy(fn (LiveShowMember $m) => [$m->role === 'host' ? 0 : 1, $m->id])->map($person)->values(),
            'guests' => $members->where('role', 'guest')->filter(fn (LiveShowMember $m) => $m->mic_until?->isFuture())
                ->map(fn (LiveShowMember $m) => [...$person($m), 'seconds_left' => max(0, (int) now()->diffInSeconds($m->mic_until, true))])->values(),
            // Черга рук — лише сцені; слухачі бачать тільки свою.
            'hands' => $stageView ? $here->whereNotNull('hand_at')->sortBy('hand_at')->map($person)->values() : [],
            'listeners' => $here->whereIn('role', ['listener', 'guest'])->take(40)->map($person)->values(),
            'listeners_count' => $here->count(),
            'me' => $me ? ['role' => $me->role, 'hand' => $me->hand_at !== null, 'can_speak' => $me->canSpeak()] : null,
            'can_manage' => $viewer !== null && ($show->host_id === $viewer->id || $viewer->isStaff()),
        ];
    }
}
