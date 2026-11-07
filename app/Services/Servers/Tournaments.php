<?php

namespace App\Services\Servers;

use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\GtaServer;
use App\Models\Tournament;
use App\Models\TournamentEntry;
use App\Models\TournamentMatch;
use App\Models\TournamentSubmission;
use App\Models\User;
use App\Notifications\TournamentNotice;
use App\Services\ImageStorage;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Турніри й челенджі серверів.
 *
 * Сітка (bracket): реєстрація → організатор запускає → сітка з «вільними проходами» для неповної кількості →
 * організатор вносить переможця кожного матчу → переможець фіналу завершує турнір.
 * Челендж (challenge): учасники надсилають результат зі скриншотом, організатор перевіряє;
 * у таблиці — найкращий підтверджений результат кожного, після ends_at челендж закривається сам.
 */
class Tournaments
{
    /** Скільки результатів «на перевірці» може мати один учасник челенджу. */
    public const PENDING_LIMIT = 3;

    public function __construct(private readonly ImageStorage $images) {}

    /** Хто може проводити турніри на сервері: власник сервера або персонал. */
    public function canHost(GtaServer $server, User $user): bool
    {
        return $server->owner_id === $user->id || $user->isStaff();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(GtaServer $server, User $user, array $data): Tournament
    {
        $active = Tournament::query()->where('gta_server_id', $server->id)->whereIn('status', [Tournament::OPEN, Tournament::RUNNING])->count();
        if ($active >= 10) {
            throw ValidationException::withMessages(['title' => 'На сервері вже 10 активних турнірів — завершіть якийсь, перш ніж створювати новий.']);
        }

        $challenge = $data['kind'] === Tournament::CHALLENGE;

        return Tournament::query()->create([
            'gta_server_id' => $server->id,
            'user_id' => $user->id,
            'title' => trim((string) $data['title']),
            'description' => filled($data['description'] ?? null) ? trim((string) $data['description']) : null,
            'kind' => $data['kind'],
            'entry' => $challenge ? 'solo' : ($data['entry'] ?? 'solo'),
            'size' => $challenge ? 0 : (int) ($data['size'] ?? 16),
            'metric' => $challenge ? trim((string) $data['metric']) : null,
            'lower_is_better' => $challenge && (bool) ($data['lower_is_better'] ?? false),
            'prize' => filled($data['prize'] ?? null) ? trim((string) $data['prize']) : null,
            'starts_at' => $data['starts_at'],
            'ends_at' => $challenge ? $data['ends_at'] : null,
        ]);
    }

    /**
     * Сім’ї сервера, які людина може записати (власник або лідер підтвердженої сім’ї).
     *
     * @return EloquentCollection<int, Family>
     */
    public function hostableFamilies(Tournament $tournament, User $user): EloquentCollection
    {
        if ($tournament->entry !== 'family') {
            return new EloquentCollection;
        }

        return Family::query()
            ->where('server_id', $tournament->gta_server_id)
            ->where('status', Family::STATUS_VERIFIED)
            ->where(fn ($q) => $q->where('owner_id', $user->id)->orWhereHas('members', fn ($m) => $m
                ->where('user_id', $user->id)->where('status', FamilyMember::STATUS_ACTIVE)->where('rank', '>=', Family::LEADER_RANK)))
            ->orderBy('name')
            ->get(['id', 'name', 'slug']);
    }

    public function join(Tournament $tournament, User $user, ?int $familyId = null): TournamentEntry
    {
        $open = $tournament->status === Tournament::OPEN
            || ($tournament->kind === Tournament::CHALLENGE && $tournament->status === Tournament::RUNNING);
        abort_unless($open, 422, 'Реєстрацію закрито.');

        return DB::transaction(function () use ($tournament, $user, $familyId) {
            $locked = Tournament::query()->lockForUpdate()->findOrFail($tournament->id);
            abort_if(TournamentEntry::query()->where('tournament_id', $locked->id)->where('user_id', $user->id)->exists(), 422, 'Ви вже берете участь.');

            if ($locked->kind === Tournament::BRACKET) {
                abort_if($locked->entries()->count() >= $locked->size, 422, 'Усі місця в сітці зайняті.');
            }

            $family = null;
            if ($locked->entry === 'family') {
                $family = $this->hostableFamilies($locked, $user)->firstWhere('id', $familyId);
                abort_unless($family !== null, 422, 'Записати сім’ю може її власник або лідер, і сім’я має бути з цього сервера.');
                abort_if(TournamentEntry::query()->where('tournament_id', $locked->id)->where('family_id', $family->id)->exists(), 422, 'Цю сім’ю вже записано.');
            }

            return TournamentEntry::query()->create(['tournament_id' => $locked->id, 'user_id' => $user->id, 'family_id' => $family?->id]);
        });
    }

    public function leave(Tournament $tournament, User $user): void
    {
        abort_unless($tournament->status === Tournament::OPEN, 422, 'Турнір уже почався — вийти не можна.');
        TournamentEntry::query()->where('tournament_id', $tournament->id)->where('user_id', $user->id)->delete();
    }

    /** Запуск: для сітки — жеребкування й перший раунд; для челенджу — просто відкриває надсилання результатів. */
    public function start(Tournament $tournament): void
    {
        abort_unless($tournament->status === Tournament::OPEN, 422, 'Турнір уже запущено.');

        DB::transaction(function () use ($tournament) {
            if ($tournament->kind === Tournament::BRACKET) {
                $entries = $tournament->entries()->get()->shuffle()->values();
                abort_if($entries->count() < 2, 422, 'Для сітки потрібно щонайменше 2 учасники.');
                $this->buildBracket($tournament, $entries);
            }
            $tournament->update(['status' => Tournament::RUNNING]);
        });

        $this->notifyEntrants($tournament, 'Турнір почався — заходьте подивитися сітку.');
    }

    /**
     * Сітка розміром 2^R: посів за класичним порядком (1–8, 4–5, 2–7, 3–6…), тож «вільні проходи»
     * дістаються найвищим посівам і ніколи не зустрічаються між собою.
     *
     * @param  Collection<int, TournamentEntry>  $entries
     */
    private function buildBracket(Tournament $tournament, Collection $entries): void
    {
        $rounds = Tournament::roundsFor($entries->count());
        $size = 2 ** $rounds;
        $entries->each(fn (TournamentEntry $entry, int $i) => $entry->update(['seed' => $i + 1]));
        $bySeed = $entries->keyBy('seed');

        $order = [1, 2];
        while (count($order) < $size) {
            $next = [];
            $sum = count($order) * 2 + 1;
            foreach ($order as $seed) {
                array_push($next, $seed, $sum - $seed);
            }
            $order = $next;
        }

        for ($round = 1; $round <= $rounds; $round++) {
            for ($slot = 0; $slot < $size / 2 ** $round; $slot++) {
                $tournament->matches()->create([
                    'round' => $round,
                    'slot' => $slot,
                    'a_entry_id' => $round === 1 ? $bySeed->get($order[$slot * 2])?->id : null,
                    'b_entry_id' => $round === 1 ? $bySeed->get($order[$slot * 2 + 1])?->id : null,
                ]);
            }
        }

        // Вільні проходи першого раунду одразу переводять гравця далі.
        $tournament->matches()->where('round', 1)->get()->each(function (TournamentMatch $match) use ($tournament) {
            $only = $match->a_entry_id ?? $match->b_entry_id;
            if ($only !== null && ($match->a_entry_id === null || $match->b_entry_id === null)) {
                $match->update(['winner_entry_id' => $only]);
                $this->advance($tournament, $match);
            }
        });
    }

    /** Внести переможця матчу; змінити можна, доки наступний матч не зіграно. */
    public function report(Tournament $tournament, TournamentMatch $match, int $winnerId, ?string $score): void
    {
        abort_unless($match->tournament_id === $tournament->id, 404);
        abort_unless($tournament->status === Tournament::RUNNING || $tournament->status === Tournament::FINISHED, 422, 'Турнір не триває.');
        abort_unless($match->a_entry_id !== null && $match->b_entry_id !== null, 422, 'У матчі ще немає обох суперників.');
        abort_unless($winnerId === $match->a_entry_id || $winnerId === $match->b_entry_id, 422, 'Переможцем може бути лише учасник цього матчу.');

        $next = $this->nextMatch($tournament, $match);
        abort_if($next?->winner_entry_id !== null, 422, 'Наступний матч уже зіграно — результат не змінити.');

        DB::transaction(function () use ($tournament, $match, $winnerId, $score, $next) {
            $match->update(['winner_entry_id' => $winnerId, 'score' => filled($score) ? trim((string) $score) : null]);
            if ($next) {
                $this->advance($tournament, $match);
            } else {
                $tournament->update(['status' => Tournament::FINISHED]);
            }
        });

        if (! $next) {
            $this->notifyEntrants($tournament, 'Турнір завершено — подивіться, хто переміг.');
        }
    }

    private function nextMatch(Tournament $tournament, TournamentMatch $match): ?TournamentMatch
    {
        return TournamentMatch::query()->where('tournament_id', $tournament->id)
            ->where('round', $match->round + 1)->where('slot', intdiv($match->slot, 2))->first();
    }

    private function advance(Tournament $tournament, TournamentMatch $match): void
    {
        $next = $this->nextMatch($tournament, $match);
        if (! $next) {
            return;
        }
        $next->update([$match->slot % 2 === 0 ? 'a_entry_id' : 'b_entry_id' => $match->winner_entry_id]);
    }

    public function submit(Tournament $tournament, User $user, float $value, ?UploadedFile $proof, ?string $note): TournamentSubmission
    {
        abort_unless($tournament->kind === Tournament::CHALLENGE && $tournament->status === Tournament::RUNNING, 422, 'Челендж зараз не приймає результати.');
        abort_if($tournament->ends_at !== null && $tournament->ends_at->isPast(), 422, 'Челендж уже завершився.');

        $entry = TournamentEntry::query()->where('tournament_id', $tournament->id)->where('user_id', $user->id)->first()
            ?? $this->join($tournament, $user);
        $pending = TournamentSubmission::query()->where('tournament_entry_id', $entry->id)->where('status', TournamentSubmission::PENDING)->count();
        abort_if($pending >= self::PENDING_LIMIT, 422, 'Зачекайте, доки організатор перевірить попередні результати.');

        return TournamentSubmission::query()->create([
            'tournament_id' => $tournament->id,
            'tournament_entry_id' => $entry->id,
            'value' => round($value, 2),
            'proof_path' => $proof ? $this->images->store($proof, 'tournaments', 1920)['path'] : null,
            'note' => filled($note) ? trim((string) $note) : null,
        ]);
    }

    public function review(Tournament $tournament, TournamentSubmission $submission, User $reviewer, bool $approve): void
    {
        abort_unless($submission->tournament_id === $tournament->id, 404);
        abort_unless($submission->status === TournamentSubmission::PENDING, 422, 'Результат уже перевірено.');
        $submission->update(['status' => $approve ? TournamentSubmission::APPROVED : TournamentSubmission::REJECTED, 'reviewed_by' => $reviewer->id]);
        $submission->entry->user->notify(new TournamentNotice($tournament, $approve ? 'зарахував(-ла) ваш результат у челенджі' : 'відхилив(-ла) ваш результат у челенджі'));
    }

    public function finish(Tournament $tournament): void
    {
        abort_unless($tournament->kind === Tournament::CHALLENGE && $tournament->status === Tournament::RUNNING, 422, 'Завершити вручну можна лише челендж, що триває.');
        $tournament->update(['status' => Tournament::FINISHED, 'ends_at' => min(now(), $tournament->ends_at ?? now())]);
        $this->notifyEntrants($tournament, 'Челендж завершено — подивіться таблицю результатів.');
    }

    public function cancel(Tournament $tournament): void
    {
        abort_if($tournament->status === Tournament::FINISHED, 422, 'Завершений турнір не скасувати.');
        $was = $tournament->status;
        $tournament->update(['status' => Tournament::CANCELLED]);
        if ($was !== Tournament::CANCELLED) {
            $this->notifyEntrants($tournament, 'Турнір скасовано організатором.');
        }
    }

    /** Розклад: челенджі стартують у starts_at і закриваються в ends_at. */
    public function tick(): int
    {
        $changed = 0;
        Tournament::query()->where('kind', Tournament::CHALLENGE)->where('status', Tournament::OPEN)->where('starts_at', '<=', now())
            ->each(function (Tournament $t) use (&$changed) {
                $t->update(['status' => Tournament::RUNNING]);
                $changed++;
            });
        Tournament::query()->where('kind', Tournament::CHALLENGE)->where('status', Tournament::RUNNING)->where('ends_at', '<=', now())
            ->each(function (Tournament $t) use (&$changed) {
                $this->finish($t);
                $changed++;
            });

        return $changed;
    }

    private function notifyEntrants(Tournament $tournament, string $text): void
    {
        $users = User::query()->whereIn('id', TournamentEntry::query()->where('tournament_id', $tournament->id)->select('user_id'))->get();
        Notification::send($users, new TournamentNotice($tournament, $text));
    }

    /**
     * Таблиця челенджу: найкращий підтверджений результат кожного учасника.
     *
     * @return list<array{place: int, entry: array<string, mixed>, value: float}>
     */
    public function leaderboard(Tournament $tournament, int $limit = 100): array
    {
        $best = TournamentSubmission::query()
            ->where('tournament_id', $tournament->id)
            ->where('status', TournamentSubmission::APPROVED)
            ->groupBy('tournament_entry_id')
            ->selectRaw('tournament_entry_id, '.($tournament->lower_is_better ? 'MIN' : 'MAX').'(value) as best, MIN(created_at) as first_at')
            ->orderBy('best', $tournament->lower_is_better ? 'asc' : 'desc')
            ->orderBy('first_at')
            ->limit($limit)
            ->get();
        $entries = TournamentEntry::query()->with(['user', 'family'])->whereIn('id', $best->pluck('tournament_entry_id'))->get()->keyBy('id');

        return array_values($best->values()->map(fn (TournamentSubmission $row, int $i) => [
            'place' => $i + 1,
            'entry' => $entries->get($row->tournament_entry_id)?->toCard(),
            'value' => (float) $row->getAttribute('best'),
        ])->filter(fn (array $row) => $row['entry'] !== null)->all());
    }

    /**
     * @return array<string, mixed>
     */
    public function card(Tournament $tournament): array
    {
        $tournament->loadMissing('server');

        return [
            'id' => $tournament->id,
            'title' => $tournament->title,
            'kind' => $tournament->kind,
            'entry' => $tournament->entry,
            'status' => $tournament->status,
            'size' => $tournament->size,
            'metric' => $tournament->metric,
            'prize' => $tournament->prize,
            'starts_at' => $tournament->starts_at->toIso8601String(),
            'ends_at' => $tournament->ends_at?->toIso8601String(),
            'entries_count' => (int) ($tournament->entries_count ?? $tournament->entries()->count()),
            'server' => ['slug' => $tournament->server->slug, 'name' => $tournament->server->name, 'icon' => $tournament->server->icon],
        ];
    }

    /**
     * Повний стан для сторінки турніру.
     *
     * @return array<string, mixed>
     */
    public function present(Tournament $tournament, User $viewer): array
    {
        $tournament->loadMissing(['server', 'user']);
        $entries = $tournament->entries()->with(['user', 'family'])->orderBy('seed')->orderBy('id')->get();
        $mine = $entries->firstWhere('user_id', $viewer->id);
        $manage = $tournament->canManage($viewer);
        $cards = $entries->keyBy('id')->map(fn (TournamentEntry $e) => $e->toCard());

        $rounds = [];
        $winner = null;
        if ($tournament->kind === Tournament::BRACKET) {
            $matches = $tournament->matches()->orderBy('round')->orderBy('slot')->get();
            foreach ($matches->groupBy('round') as $round => $list) {
                $rounds[] = array_values($list->map(fn (TournamentMatch $m) => [
                    'id' => $m->id,
                    'round' => $m->round,
                    'slot' => $m->slot,
                    'a' => $m->a_entry_id ? $cards->get($m->a_entry_id) : null,
                    'b' => $m->b_entry_id ? $cards->get($m->b_entry_id) : null,
                    'winner_id' => $m->winner_entry_id,
                    'score' => $m->score,
                ])->all());
            }
            $final = $matches->sortByDesc('round')->first();
            $winner = $tournament->status === Tournament::FINISHED && $final?->winner_entry_id ? $cards->get($final->winner_entry_id) : null;
        }

        $leaderboard = $tournament->kind === Tournament::CHALLENGE ? $this->leaderboard($tournament) : [];
        if ($tournament->kind === Tournament::CHALLENGE && $tournament->status === Tournament::FINISHED) {
            $winner = $leaderboard[0]['entry'] ?? null;
        }

        $submission = fn (TournamentSubmission $s) => [
            'id' => $s->id,
            'value' => (float) $s->value,
            'note' => $s->note,
            'status' => $s->status,
            'proof_url' => $s->proof_path ? Storage::disk('public')->url($s->proof_path) : null,
            'entry' => $cards->get($s->tournament_entry_id),
            'created_at' => $s->created_at->toIso8601String(),
        ];

        return [
            'tournament' => [
                ...$this->card($tournament),
                'description' => $tournament->description,
                'lower_is_better' => $tournament->lower_is_better,
                'organizer' => $tournament->user?->toCard(),
            ],
            'entries' => array_values($cards->all()),
            'rounds' => $rounds,
            'leaderboard' => $leaderboard,
            'winner' => $winner,
            'me' => [
                'entry_id' => $mine?->id,
                'can_manage' => $manage,
                'families' => array_values($this->hostableFamilies($tournament, $viewer)->map(fn (Family $f) => ['id' => $f->id, 'name' => $f->name])->all()),
                'submissions' => $mine && $tournament->kind === Tournament::CHALLENGE
                    ? array_values(TournamentSubmission::query()->where('tournament_entry_id', $mine->id)->latest('id')->limit(10)->get()->map($submission)->all())
                    : [],
            ],
            'pending' => $manage && $tournament->kind === Tournament::CHALLENGE
                ? array_values(TournamentSubmission::query()->where('tournament_id', $tournament->id)->where('status', TournamentSubmission::PENDING)->oldest('id')->limit(50)->get()->map($submission)->all())
                : [],
        ];
    }
}
