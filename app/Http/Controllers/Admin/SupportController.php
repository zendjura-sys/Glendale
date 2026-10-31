<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SupportTicket;
use App\Models\User;
use App\Services\Support\SupportDesk;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Робоче місце підтримки (адміністратори й модератори): черга з фільтрами, листування,
 * внутрішні нотатки, призначення, статус і пріоритет, шаблони відповідей. Кожна дія — у журнал.
 */
class SupportController extends Controller
{
    /** Готові відповіді: вставляються в поле, далі агент править під людину. */
    public const TEMPLATES = [
        'Вітаємо! Дякуємо, що написали. Уже розбираємося й повернемося з відповіддю найближчим часом.',
        'Щоб допомогти швидше, надішліть, будь ласка, знімок екрана й опишіть кроки, після яких з’являється проблема.',
        'Перевірили — тепер усе має працювати. Оновіть сторінку чи застосунок і напишіть, якщо проблема лишилася.',
        'Оплату знайшли, доступ відновили. Вибачте за незручності!',
        'Скаргу розглянули й ужили заходів згідно з правилами спільноти. Дякуємо, що повідомили.',
    ];

    public function __construct(private readonly SupportDesk $desk) {}

    public function index(Request $request): Response
    {
        $this->staff($request);
        $filters = $request->validate([
            'status' => ['nullable', Rule::in([...SupportTicket::STATUSES, 'active'])],
            'category' => ['nullable', Rule::in(array_keys(SupportTicket::CATEGORIES))],
            'mine' => ['nullable', 'boolean'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $status = $filters['status'] ?? 'active';
        $me = $request->user();
        $tickets = SupportTicket::query()->with(['user', 'assignee'])
            ->when($status === 'active', fn (Builder $q) => $q->where('status', '!=', 'closed'))
            ->when($status !== 'active', fn (Builder $q) => $q->where('status', $status))
            ->when($filters['category'] ?? null, fn (Builder $q, string $c) => $q->where('category', $c))
            ->when((bool) ($filters['mine'] ?? false), fn (Builder $q) => $q->where('assignee_id', $me->id))
            ->when($filters['q'] ?? null, fn (Builder $q, string $term) => $q->where(fn (Builder $w) => $w
                ->where('subject', 'like', "%{$term}%")->orWhere('id', ctype_digit($term) ? (int) $term : 0)
                ->orWhereHas('user', fn (Builder $u) => $u->where('username', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%"))))
            // Спершу ті, що чекають на нас: терміновіші й давніші.
            ->orderByRaw("CASE status WHEN 'open' THEN 0 WHEN 'answered' THEN 1 ELSE 2 END")
            ->orderByRaw("CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END")
            ->orderBy('last_reply_at')
            ->paginate(30)->withQueryString()
            ->through(fn (SupportTicket $t) => $this->desk->card($t, true));

        $avg = SupportTicket::query()->whereNotNull('first_response_at')->where('created_at', '>=', now()->subDays(30))->get(['created_at', 'first_response_at'])
            ->avg(fn (SupportTicket $t) => $t->created_at->diffInMinutes($t->first_response_at));

        return Inertia::render('admin/support/index', [
            'tickets' => $tickets,
            'filters' => ['status' => $status, 'category' => $filters['category'] ?? '', 'mine' => (bool) ($filters['mine'] ?? false), 'q' => $filters['q'] ?? ''],
            'categories' => SupportTicket::CATEGORIES,
            'stats' => [
                'open' => SupportTicket::query()->where('status', 'open')->count(),
                'unassigned' => SupportTicket::query()->where('status', 'open')->whereNull('assignee_id')->count(),
                'answered' => SupportTicket::query()->where('status', 'answered')->count(),
                'first_response_minutes' => $avg !== null ? (int) round((float) $avg) : null,
                'rating' => round((float) SupportTicket::query()->whereNotNull('rating')->where('created_at', '>=', now()->subDays(90))->avg('rating'), 1),
            ],
        ]);
    }

    public function show(Request $request, SupportTicket $ticket): Response
    {
        $this->staff($request);
        if ($ticket->unread_staff) {
            $ticket->forceFill(['unread_staff' => false])->save();
        }
        $ticket->load(['user', 'assignee']);

        return Inertia::render('admin/support/show', [
            'ticket' => [...$this->desk->card($ticket, true), 'url' => $ticket->url, 'rating_comment' => $ticket->rating_comment],
            'messages' => $this->desk->thread($ticket, true),
            'requester' => [
                ...$ticket->user->toCard(),
                'email' => $ticket->user->email,
                'created_at' => $ticket->user->created_at?->toIso8601String(),
                'banned' => $ticket->user->banned_at !== null,
                'is_plus' => $ticket->user->isPlus(),
                'tickets' => SupportTicket::query()->where('user_id', $ticket->user_id)->count(),
            ],
            'staff' => User::query()->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MODERATOR])->orderBy('name')->limit(50)->get()->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name])->values()->all(),
            'templates' => self::TEMPLATES,
            'categories' => SupportTicket::CATEGORIES,
        ]);
    }

    public function reply(Request $request, SupportTicket $ticket): RedirectResponse
    {
        $this->staff($request);
        $data = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:5000'],
            'internal' => ['nullable', 'boolean'],
            'close' => ['nullable', 'boolean'],
            'files' => ['nullable', 'array', 'max:'.SupportDesk::MAX_FILES],
            'files.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);
        $this->desk->reply($ticket, $request->user(), $data['body'], array_values($request->file('files', [])), (bool) ($data['internal'] ?? false));
        if (! empty($data['close']) && empty($data['internal'])) {
            $ticket->forceFill(['status' => 'closed', 'closed_at' => now()])->save();
        }
        Log::info('admin: support reply', ['ticket' => $ticket->id, 'internal' => (bool) ($data['internal'] ?? false), 'closed' => (bool) ($data['close'] ?? false), 'by' => $request->user()->id]);

        return back();
    }

    public function update(Request $request, SupportTicket $ticket): RedirectResponse
    {
        $this->staff($request);
        $data = $request->validate([
            'status' => ['sometimes', Rule::in(SupportTicket::STATUSES)],
            'priority' => ['sometimes', Rule::in(SupportTicket::PRIORITIES)],
            'category' => ['sometimes', Rule::in(array_keys(SupportTicket::CATEGORIES))],
            'assignee_id' => ['sometimes', 'nullable', 'integer'],
        ]);
        if (array_key_exists('assignee_id', $data) && $data['assignee_id'] !== null) {
            abort_unless(User::query()->whereKey($data['assignee_id'])->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MODERATOR])->exists(), 422);
        }
        DB::transaction(function () use ($ticket, $data, $request) {
            if (($data['status'] ?? null) === 'closed' && $ticket->status !== 'closed') {
                $this->desk->close($ticket, $request->user());
                unset($data['status']);
            }
            $ticket->forceFill($data)->save();
        });
        Log::info('admin: support ticket updated', ['ticket' => $ticket->id, 'changes' => $data, 'by' => $request->user()->id]);

        return back();
    }

    private function staff(Request $request): void
    {
        abort_unless($request->user()?->isStaff(), 403);
    }
}
