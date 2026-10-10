<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Appeal;
use App\Models\Message;
use App\Models\MessageReport;
use App\Models\User;
use App\Models\UserReport;
use App\Services\Moderation\ContentFilter;
use App\Services\Moderation\MessageReports;
use App\Services\Moderation\PeopleModeration;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Адмінка → Модерація: скарги на повідомлення, заглушені користувачі, налаштування автомодерації.
 */
class ModerationController extends Controller
{
    public const MUTE_HOURS = [1, 3, 6, 12, 24, 72, 168, 720];

    public function __construct(
        private readonly MessageReports $reports,
        private readonly ContentFilter $filter,
        private readonly SiteSettings $settings,
    ) {}

    public function index(): Response
    {
        $pending = MessageReport::query()->where('status', MessageReport::PENDING)
            ->with(['reporter', 'message' => fn ($q) => $q->withTrashed()->with(['user', 'conversation'])])
            ->latest('id')->limit(200)->get()
            ->groupBy('message_id')
            ->map(function ($group) {
                /** @var MessageReport $first */
                $first = $group->first();
                $message = $first->message;

                return [
                    'id' => $first->id,
                    'count' => $group->count(),
                    'reasons' => $group->pluck('reason')->unique()->map(fn (string $r) => MessageReport::REASONS[$r] ?? $r)->values(),
                    'comments' => $group->pluck('comment')->filter()->values(),
                    'reporters' => $group->map(fn (MessageReport $r) => $r->reporter?->name)->filter()->values(),
                    'created_at' => $first->created_at->toIso8601String(),
                    'message' => $message instanceof Message ? [
                        'id' => $message->id,
                        'body' => $message->body,
                        'type' => $message->type,
                        'deleted' => $message->trashed(),
                        'created_at' => $message->created_at->toIso8601String(),
                        'author' => $message->user?->toCard(),
                        'chat' => $message->conversation->title ?? ($message->conversation->family_id ? 'Чат сім’ї' : 'Особисте листування'),
                    ] : null,
                ];
            })->values();

        $people = UserReport::query()->where('status', UserReport::PENDING)
            ->with(['user', 'reporter'])
            ->latest('id')->limit(200)->get()
            ->groupBy('user_id')
            ->map(function ($group) {
                /** @var UserReport $first */
                $first = $group->first();

                return [
                    'user_id' => $first->user_id,
                    'user' => $first->user?->toCard(),
                    'count' => $group->count(),
                    'reasons' => $group->pluck('reason')->unique()->map(fn (string $r) => UserReport::REASONS[$r] ?? $r)->values(),
                    'comments' => $group->pluck('comment')->filter()->values(),
                    'reporters' => $group->map(fn (UserReport $r) => $r->reporter?->name)->filter()->values(),
                    'created_at' => $first->created_at->toIso8601String(),
                ];
            })->filter(fn (array $row) => $row['user'] !== null)->values();

        $appeals = Appeal::query()->where('status', Appeal::PENDING)->with('user')->oldest('id')->limit(100)->get()
            ->map(fn (Appeal $a) => [
                'id' => $a->id,
                'kind' => Appeal::KINDS[$a->kind] ?? $a->kind,
                'body' => $a->body,
                'user' => $a->user?->toCard(),
                'banned' => (bool) $a->user?->isBanned(),
                'ban_reason' => $a->user?->ban_reason,
                'muted_until' => $a->user?->muted_until?->toIso8601String(),
                'created_at' => $a->created_at->toIso8601String(),
            ])->values();

        return Inertia::render('admin/moderation', [
            'reports' => $pending,
            'people' => $people,
            'appeals' => $appeals,
            'muted' => User::query()->where('muted_until', '>', now())->orderBy('muted_until')->limit(100)->get()
                ->map(fn (User $u) => [...$u->toCard(), 'muted_until' => $u->muted_until?->toIso8601String(), 'mute_reason' => $u->mute_reason])->values(),
            'settings' => $this->filter->config(),
            'mute_hours' => self::MUTE_HOURS,
            'stats' => [
                'pending' => MessageReport::query()->where('status', MessageReport::PENDING)->distinct('message_id')->count('message_id'),
                'people' => $people->count(),
                'appeals' => $appeals->count(),
                'resolved_week' => MessageReport::query()->where('status', '!=', MessageReport::PENDING)->where('updated_at', '>=', now()->subWeek())->count(),
            ],
        ]);
    }

    public function resolve(Request $request, MessageReport $report): RedirectResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['delete', 'mute', 'dismiss'])],
            'hours' => ['nullable', 'required_if:action,mute', 'integer', Rule::in(self::MUTE_HOURS)],
            'reason' => ['nullable', 'string', 'max:200'],
        ]);
        $user = $request->user();
        abort_unless($user instanceof User, 401);
        $this->reports->resolve($report, $user, (string) $data['action'], isset($data['hours']) ? (int) $data['hours'] : null, $data['reason'] ?? null);
        Inertia::flash('toast', ['type' => 'success', 'message' => match ($data['action']) {
            'delete' => 'Повідомлення видалено.',
            'mute' => 'Повідомлення видалено, автора заглушено.',
            default => 'Скаргу відхилено.',
        }]);

        return back();
    }

    public function resolvePerson(Request $request, User $user, PeopleModeration $moderation): RedirectResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['ban', 'mute', 'dismiss'])],
            'hours' => ['nullable', 'required_if:action,mute', 'integer', Rule::in(self::MUTE_HOURS)],
            'reason' => ['nullable', 'string', 'max:200'],
        ]);
        $moderator = $request->user();
        abort_unless($moderator instanceof User, 401);
        $moderation->resolve($user, $moderator, (string) $data['action'], isset($data['hours']) ? (int) $data['hours'] : null, $data['reason'] ?? null);
        Inertia::flash('toast', ['type' => 'success', 'message' => match ($data['action']) {
            'ban' => "{$user->name} заблоковано.",
            'mute' => "{$user->name} не зможе писати до кінця терміну.",
            default => 'Скарги відхилено.',
        }]);

        return back();
    }

    public function answerAppeal(Request $request, Appeal $appeal, PeopleModeration $moderation): RedirectResponse
    {
        $data = $request->validate([
            'accept' => ['required', 'boolean'],
            'reply' => ['nullable', 'string', 'max:1000'],
        ]);
        $moderator = $request->user();
        abort_unless($moderator instanceof User, 401);
        abort_if($appeal->status !== Appeal::PENDING, 422, 'Оскарження вже розглянуто.');
        $moderation->answer($appeal, $moderator, (bool) $data['accept'], $data['reply'] ?? null);
        Inertia::flash('toast', ['type' => 'success', 'message' => $data['accept'] ? 'Оскарження прийнято.' : 'Оскарження відхилено.']);

        return back();
    }

    public function unmute(User $user): RedirectResponse
    {
        $this->reports->unmute($user);
        Inertia::flash('toast', ['type' => 'success', 'message' => "{$user->name} знову може писати."]);

        return back();
    }

    public function settings(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'profanity' => ['required', Rule::in(['mask', 'block', 'off'])],
            'extra_words' => ['nullable', 'string', 'max:2000'],
            'flood_limit' => ['required', 'integer', 'min:0', 'max:200'],
            'repeat_limit' => ['required', 'integer', 'min:0', 'max:50'],
            'new_account_link_hours' => ['required', 'integer', 'min:0', 'max:720'],
        ]);
        $words = array_values(array_unique(array_filter(array_map(fn ($w) => mb_strtolower(trim($w)), preg_split('/[\n,]+/', (string) ($data['extra_words'] ?? '')) ?: []))));
        $this->settings->put(['moderation' => [
            'profanity' => $data['profanity'],
            'extra_words' => array_slice($words, 0, 200),
            'flood_limit' => (int) $data['flood_limit'],
            'repeat_limit' => (int) $data['repeat_limit'],
            'new_account_link_hours' => (int) $data['new_account_link_hours'],
        ]]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування автомодерації збережено.']);

        return back();
    }
}
