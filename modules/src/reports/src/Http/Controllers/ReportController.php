<?php

namespace Addons\Reports\Http\Controllers;

use Addons\Reports\Events\ReportCreated;
use Addons\Reports\Models\Report;
use Addons\Reports\Models\ReportAttachment;
use App\Models\User;
use App\Support\ReportGuides;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Публичная (для авторизованных участников) сторона модуля: подать отчёт,
 * посмотреть свою историю. Никакой модерации здесь — только Admin-контроллер.
 */
class ReportController
{
    public function index(Request $request): Response
    {
        // Свої звіти (де я суб'єкт) + ті, що я подав за друзів (де я
        // submitted_by, а суб'єкт — хтось інший) — інакше подання "за
        // друга" одразу зникало б з очей того, хто його реально відправив.
        $reports = Report::query()
            ->with(['user:id,name,gender', 'submitter:id,name,gender', 'attachments'])
            ->where(fn ($q) => $q
                ->where('user_id', $request->user()->id)
                ->orWhere('submitted_by', $request->user()->id))
            ->latest()
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Reports/Index', [
            'reports' => $reports,
            'myId' => $request->user()->id,
            'reportGuides' => ReportGuides::all(),
        ]);
    }

    /**
     * Розклад капта: хто в який час був присутній і який результат за
     * фактом. Один звіт бізвару покриває ОДРАЗУ набір годин (людина могла
     * вибрати кілька) з ОДНИМ підсумковим W/L на весь цей набір — тому
     * кілька людей, які звітують за той самий бій, групуються за
     * однаковим набором годин на ту саму дату, а не рахуються поодинці.
     *
     * Без цього групування підсумок бою, де взяли участь 10 людей із
     * рахунком 2/1 кожен, виглядав би як 20 перемог і 10 поразок — хоча
     * бій був один. Показуємо результат, який назвала більшість учасників
     * сесії, і позначаємо явно, якщо хтось назвав інший рахунок.
     */
    public function schedule(Request $request): Response
    {
        $view = $request->query('view') === 'week' ? 'week' : 'day';

        $anchor = $request->query('date');
        $anchor = $anchor ? Carbon::parse($anchor)->startOfDay() : Carbon::today();

        if ($view === 'week') {
            return $this->weekSchedule($anchor);
        }

        $reports = Report::query()
            ->where('type', 'bizwar')
            ->whereDate('report_date', $anchor)
            ->with('user:id,name')
            ->oldest('created_at')
            ->get();

        return Inertia::render('Reports/Schedule', [
            'view' => 'day',
            'date' => $anchor->toDateString(),
            'sessions' => $this->buildSessions($reports),
        ]);
    }

    /**
     * Тижневий перегляд: один запит на весь тиждень (а не сім по одному на
     * день), далі розкладається по конкретних датах у пам'яті — тиждень
     * завжди Пн–Нд, незалежно від тижня для нарахування премій (той рахує
     * від неділі 20:00, це геть інша межа й не має тут значення).
     */
    private function weekSchedule(Carbon $anchor): Response
    {
        $weekStart = $anchor->copy()->startOfWeek(Carbon::MONDAY);
        $weekEnd = $weekStart->copy()->addDays(6);

        // Не whereBetween(): report_date у SQLite зберігається як рядок
        // "YYYY-MM-DD 00:00:00", і верхня межа-дата без часу лексикографічно
        // менша за нього — крайній день тижня мовчки відрізало б. Явний "<
        // наступний день" безпечний незалежно від формату зберігання.
        $reports = Report::query()
            ->where('type', 'bizwar')
            ->where('report_date', '>=', $weekStart->toDateString())
            ->where('report_date', '<', $weekEnd->copy()->addDay()->toDateString())
            ->with('user:id,name')
            ->oldest('created_at')
            ->get();

        $days = [];
        for ($i = 0; $i < 7; $i++) {
            $day = $weekStart->copy()->addDays($i);
            $days[] = [
                'date' => $day->toDateString(),
                'sessions' => $this->buildSessions(
                    $reports->filter(fn (Report $r) => $r->report_date?->isSameDay($day))
                ),
            ];
        }

        return Inertia::render('Reports/Schedule', [
            'view' => 'week',
            'date' => $anchor->toDateString(),
            'weekStart' => $weekStart->toDateString(),
            'weekEnd' => $weekEnd->toDateString(),
            'days' => $days,
        ]);
    }

    /**
     * Групування звітів у "сесії бою": один звіт бізвару покриває ОДРАЗУ
     * набір годин (людина могла вибрати кілька) з ОДНИМ підсумковим W/L на
     * весь цей набір — тому кілька людей, які звітують за той самий бій,
     * групуються за однаковим набором годин, а не рахуються поодинці.
     *
     * Без цього групування підсумок бою, де взяли участь 10 людей із
     * рахунком 2/1 кожен, виглядав би як 20 перемог і 10 поразок — хоча
     * бій був один. Показуємо результат, який назвала більшість учасників
     * сесії, і позначаємо явно, якщо хтось назвав інший рахунок.
     *
     * @param  \Illuminate\Support\Collection<int,Report>  $reports
     * @return array<int,array<string,mixed>>
     */
    private function buildSessions($reports): array
    {
        return $reports
            ->groupBy(fn (Report $r) => collect($r->kapt_times ?? [])->sort()->implode(','))
            ->map(function ($group, string $key) {
                $resultCounts = $group
                    ->groupBy(fn (Report $r) => ($r->wins_count ?? 0).':'.($r->losses_count ?? 0))
                    ->map->count()
                    ->sortDesc();

                [$wins, $losses] = array_map('intval', explode(':', $resultCounts->keys()->first()));

                return [
                    'times' => $key === '' ? [] : explode(',', $key),
                    'result' => ['wins' => $wins, 'losses' => $losses],
                    'agreement' => $resultCounts->count() === 1,
                    'result_breakdown' => $resultCounts->map(function (int $count, string $pair) {
                        [$w, $l] = array_map('intval', explode(':', $pair));

                        return ['wins' => $w, 'losses' => $l, 'count' => $count];
                    })->values(),
                    'participants' => $group->map(fn (Report $r) => [
                        'report_id' => $r->id,
                        'user_id' => $r->user_id,
                        'name' => $r->user?->name,
                        'wins' => $r->wins_count,
                        'losses' => $r->losses_count,
                        'status' => $r->status,
                    ])->values(),
                ];
            })
            ->sortBy(fn (array $s) => $s['times'][0] ?? '')
            ->values()
            ->all();
    }

    /**
     * Пошук для перемикача "за друга" — шукає серед РЕАЛЬНИХ (не тіньових)
     * акаунтів за іменем/прізвищем, і серед уже заведених тіньових теж:
     * якщо хтось уже подавав за цього ж друга раніше, другий раз створювати
     * дубль тіньового акаунту не треба, треба знайти вже наявний.
     */
    public function searchMembers(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));
        if (mb_strlen($query) < 2) {
            return response()->json(['ok' => true, 'message' => null, 'data' => ['members' => []], 'errors' => null, 'redirect' => null]);
        }

        $members = User::query()->inActiveFamily()
            ->where('id', '!=', $request->user()->id)
            ->where('name', 'like', '%'.$query.'%')
            ->orderBy('name')
            ->limit(10)
            ->get(['id', 'name', 'is_shadow']);

        return response()->json([
            'ok' => true,
            'message' => null,
            'data' => ['members' => $members],
            'errors' => null,
            'redirect' => null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(Report::SUBMITTABLE_TYPES)],
            // Дата події, а не подачі — бізвар і контракти звітують пакетом
            // "скільки набралось за дату", а не по одному на подію.
            'report_date' => ['required_if:type,bizwar,contract', 'nullable', 'date'],
            'wins_count' => ['required_if:type,bizwar', 'nullable', 'integer', 'min:0'],
            'losses_count' => ['required_if:type,bizwar', 'nullable', 'integer', 'min:0'],
            // Фіксується поіменно (не просто кількість), щоб майбутній
            // модуль автопідрахунку премій міг рахувати по конкретних годинах.
            //
            // "min:1" тут НЕ вішаємо: форма завжди шле kapt_times як масив
            // (хай навіть порожній) незалежно від обраного типу — nullable
            // звільняє лише null, а не порожній масив, тож при поданні
            // контракту чи інвестиції порожній [] ламав би валідацію.
            // "Хоча б один час" для bizwar перевіряється нижче окремо.
            'kapt_times' => ['nullable', 'array'],
            'kapt_times.*' => ['string', Rule::in(Report::KAPT_TIMES)],
            'light_count' => ['required_if:type,contract', 'nullable', 'integer', 'min:0'],
            'medium_count' => ['required_if:type,contract', 'nullable', 'integer', 'min:0'],
            'heavy_count' => ['required_if:type,contract', 'nullable', 'integer', 'min:0'],
            'amount' => ['required_if:type,investment', 'nullable', 'integer', 'min:0'],
            'description' => ['nullable', 'string', 'max:2000'],
            'subject_type' => ['required', Rule::in(['self', 'friend'])],
            'subject_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'subject_first_name' => ['required_if:subject_type,friend', 'nullable', 'string', 'max:120'],
            'subject_last_name' => ['nullable', 'string', 'max:120'],
            // Оригінал зберігається без стиснення — max:20480 (20 МБ) під
            // фото з телефону в повній якості, а не стиснутий скрін.
            'photos' => ['nullable', 'array', 'max:30'],
            'photos.*' => ['file', 'mimes:jpeg,jpg,png,webp', 'max:20480'],
        ], [], ['subject_first_name' => "ім'я друга"]);

        if ($data['type'] === 'bizwar') {
            if ((int) ($data['wins_count'] ?? 0) + (int) ($data['losses_count'] ?? 0) === 0) {
                throw ValidationException::withMessages(['wins_count' => 'Вкажіть хоча б одну перемогу або поразку.']);
            }
            if (empty($data['kapt_times'])) {
                throw ValidationException::withMessages(['kapt_times' => 'Виберіть хоча б один час капта.']);
            }
        }

        if ($data['type'] === 'contract') {
            $total = (int) ($data['light_count'] ?? 0) + (int) ($data['medium_count'] ?? 0) + (int) ($data['heavy_count'] ?? 0);
            if ($total === 0) {
                throw ValidationException::withMessages(['light_count' => 'Вкажіть хоча б один контракт.']);
            }
        }

        // Поле, не относящееся к выбранному типу, всегда обнуляем —
        // иначе в БД могло бы осесть, например, amount у type=contract.
        if (! in_array($data['type'], ['bizwar', 'contract'], true)) {
            $data['report_date'] = null;
        }
        if ($data['type'] !== 'bizwar') {
            $data['wins_count'] = null;
            $data['losses_count'] = null;
            $data['kapt_times'] = null;
        }
        if ($data['type'] !== 'contract') {
            $data['light_count'] = null;
            $data['medium_count'] = null;
            $data['heavy_count'] = null;
        }
        if ($data['type'] !== 'investment') {
            $data['amount'] = null;
        }

        $subject = $this->resolveSubject($request, $data);

        $photos = $data['photos'] ?? [];
        unset($data['subject_type'], $data['subject_user_id'], $data['subject_first_name'], $data['subject_last_name'], $data['photos']);

        $report = Report::create([
            ...$data,
            'user_id' => $subject->id,
            'submitted_by' => $request->user()->id,
            'status' => 'pending',
        ]);

        $this->storeAttachments($report, $photos);

        ReportCreated::dispatch($report);

        return back()->with('success', 'Звіт подано, очікує на модерацію.');
    }

    /**
     * Оригінали кладемо на диск як є — без ресайзу чи перестиснення: це
     * найчастіше скріншот гри чи чат, де кожен піксель має значення для
     * розгляду. Порядок фіксується позицією — так альбом на перегляді
     * завжди йде в тому ж порядку, у якому людина їх додала.
     *
     * @param  array<int,\Illuminate\Http\UploadedFile>  $photos
     */
    private function storeAttachments(Report $report, array $photos): void
    {
        foreach (array_values($photos) as $i => $photo) {
            $path = $photo->store('reports/attachments', 'public');

            ReportAttachment::create([
                'report_id' => $report->id,
                'disk_path' => $path,
                'original_name' => $photo->getClientOriginalName(),
                'size' => $photo->getSize(),
                'position' => $i,
            ]);
        }
    }

    /**
     * "За себе" — завжди поточний юзер. "За друга" — або вже обраний
     * (subject_user_id, реальний чи вже раніше заведений тіньовий), або
     * нове ім'я: спершу шукаємо точний збіг (щоб не плодити дублі
     * тіньових акаунтів на одного й того ж друга), і тільки якщо нема —
     * заводимо новий тіньовий акаунт.
     */
    private function resolveSubject(Request $request, array $data): User
    {
        if ($data['subject_type'] === 'self') {
            return $request->user();
        }

        if (! empty($data['subject_user_id'])) {
            return User::findOrFail($data['subject_user_id']);
        }

        $fullName = trim($data['subject_first_name'].' '.($data['subject_last_name'] ?? ''));

        return User::where('name', $fullName)->first()
            ?? User::createShadow($data['subject_first_name'], $data['subject_last_name'] ?? null);
    }
}
