<?php

namespace App\Http\Controllers;

use App\Models\GtaServer;
use App\Models\Tournament;
use App\Models\TournamentMatch;
use App\Models\TournamentSubmission;
use App\Services\Servers\Tournaments;
use App\Support\Plugins\Plugins;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Турніри й челенджі серверів (сайт і міст застосунку — ті самі дії). */
class TournamentController extends Controller implements HasMiddleware
{
    public function __construct(private readonly Tournaments $tournaments) {}

    public static function middleware(): array
    {
        return [function (Request $request, Closure $next) {
            app(Plugins::class)->ensure('server_tournaments');

            return $next($request);
        }];
    }

    public function index(Request $request): Response
    {
        $status = $request->query('status') === 'finished' ? 'finished' : 'active';
        $list = Tournament::query()
            ->with('server')
            ->withCount('entries')
            ->whereHas('server', fn ($q) => $q->where('status', GtaServer::STATUS_PUBLISHED))
            ->when($status === 'active', fn ($q) => $q->whereIn('status', [Tournament::OPEN, Tournament::RUNNING])->orderBy('starts_at'))
            ->when($status === 'finished', fn ($q) => $q->where('status', Tournament::FINISHED)->latest('updated_at'))
            ->limit(60)
            ->get();

        return Inertia::render('tournaments/index', [
            'status' => $status,
            'tournaments' => array_values($list->map(fn (Tournament $t) => $this->tournaments->card($t))->all()),
        ]);
    }

    public function show(Request $request, Tournament $tournament): Response
    {
        abort_unless($tournament->server->status === GtaServer::STATUS_PUBLISHED || $request->user()->isStaff(), 404);

        return Inertia::render('tournaments/show', $this->tournaments->present($tournament, $request->user()));
    }

    public function store(Request $request, GtaServer $server): RedirectResponse
    {
        abort_unless($this->tournaments->canHost($server, $request->user()), 403, 'Турніри проводить власник сервера.');
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:80'],
            'description' => ['nullable', 'string', 'max:2000'],
            'kind' => ['required', Rule::in([Tournament::BRACKET, Tournament::CHALLENGE])],
            'entry' => ['nullable', Rule::in(['solo', 'family'])],
            'size' => ['required_if:kind,bracket', 'nullable', 'integer', Rule::in(Tournament::SIZES)],
            'metric' => ['required_if:kind,challenge', 'nullable', 'string', 'max:40'],
            'lower_is_better' => ['boolean'],
            'prize' => ['nullable', 'string', 'max:120'],
            'starts_at' => ['required', 'date', 'after:-1 hour'],
            'ends_at' => ['required_if:kind,challenge', 'nullable', 'date', 'after:starts_at'],
        ], [
            'metric.required_if' => 'Вкажіть, що рахуємо (наприклад, «Очки» чи «Час, с»).',
            'ends_at.required_if' => 'Вкажіть, коли челендж завершиться.',
            'ends_at.after' => 'Завершення має бути пізніше за старт.',
            'starts_at.after' => 'Старт не може бути в минулому.',
        ]);
        $tournament = $this->tournaments->create($server, $request->user(), $data);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Турнір створено.']);

        return redirect('/tournaments/'.$tournament->id);
    }

    public function join(Request $request, Tournament $tournament): RedirectResponse
    {
        $data = $request->validate(['family_id' => ['nullable', 'integer']]);
        $this->tournaments->join($tournament, $request->user(), isset($data['family_id']) ? (int) $data['family_id'] : null);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Ви в турнірі.']);

        return back();
    }

    public function leave(Request $request, Tournament $tournament): RedirectResponse
    {
        $this->tournaments->leave($tournament, $request->user());

        return back();
    }

    public function start(Request $request, Tournament $tournament): RedirectResponse
    {
        abort_unless($tournament->canManage($request->user()), 403);
        $this->tournaments->start($tournament);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Турнір запущено.']);

        return back();
    }

    public function report(Request $request, Tournament $tournament, TournamentMatch $match): RedirectResponse
    {
        abort_unless($tournament->canManage($request->user()), 403);
        $data = $request->validate([
            'winner_id' => ['required', 'integer'],
            'score' => ['nullable', 'string', 'max:20'],
        ]);
        $this->tournaments->report($tournament, $match, (int) $data['winner_id'], $data['score'] ?? null);

        return back();
    }

    public function submit(Request $request, Tournament $tournament): RedirectResponse
    {
        $data = $request->validate([
            'value' => ['required', 'numeric', 'min:0', 'max:9999999999'],
            'proof' => ['nullable', 'image', 'mimes:jpeg,png,webp', 'max:8192'],
            'note' => ['nullable', 'string', 'max:200'],
        ]);
        $this->tournaments->submit($tournament, $request->user(), (float) $data['value'], $request->file('proof'), $data['note'] ?? null);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Результат надіслано на перевірку.']);

        return back();
    }

    public function review(Request $request, Tournament $tournament, TournamentSubmission $submission): RedirectResponse
    {
        abort_unless($tournament->canManage($request->user()), 403);
        $data = $request->validate(['approve' => ['required', 'boolean']]);
        $this->tournaments->review($tournament, $submission, $request->user(), (bool) $data['approve']);

        return back();
    }

    public function finish(Request $request, Tournament $tournament): RedirectResponse
    {
        abort_unless($tournament->canManage($request->user()), 403);
        $this->tournaments->finish($tournament);

        return back();
    }

    public function destroy(Request $request, Tournament $tournament): RedirectResponse
    {
        abort_unless($tournament->canManage($request->user()), 403);
        $this->tournaments->cancel($tournament);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Турнір скасовано.']);

        return back();
    }
}
