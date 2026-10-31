<?php

namespace App\Http\Controllers;

use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Services\Support\SupportDesk;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Підтримка для людини: мої звернення, нове звернення, листування, закриття й оцінка. */
class SupportController extends Controller
{
    public function __construct(private readonly SupportDesk $desk) {}

    public function index(Request $request): Response|JsonResponse
    {
        app(Plugins::class)->ensure('support_tickets');
        $tickets = SupportTicket::query()->where('user_id', $request->user()->id)->with('assignee')->latest('updated_at')->limit(100)->get();
        $data = [
            'tickets' => $tickets->map(fn (SupportTicket $t) => $this->desk->card($t, false))->values()->all(),
            'categories' => SupportTicket::CATEGORIES,
            'prefill' => ['category' => $request->query('category'), 'subject' => $request->query('subject'), 'url' => $request->query('from')],
        ];

        return $request->wantsJson() ? response()->json($data) : Inertia::render('support/index', $data);
    }

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        app(Plugins::class)->ensure('support_tickets');
        $data = $request->validate([
            'category' => ['required', Rule::in(array_keys(SupportTicket::CATEGORIES))],
            'subject' => ['required', 'string', 'min:4', 'max:120'],
            'body' => ['required', 'string', 'min:10', 'max:5000'],
            'url' => ['nullable', 'string', 'max:255'],
            'files' => ['nullable', 'array', 'max:'.SupportDesk::MAX_FILES],
            'files.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ], ['body.min' => 'Опишіть проблему трохи детальніше — хоча б кілька слів.']);
        $ticket = $this->desk->open($request->user(), $data, array_values($request->file('files', [])));

        return $request->wantsJson() ? response()->json(['id' => $ticket->id], 201) : to_route('support.show', $ticket);
    }

    public function show(Request $request, SupportTicket $ticket): Response|JsonResponse
    {
        $this->authorizeOwner($request, $ticket);
        if ($ticket->unread_user) {
            $ticket->forceFill(['unread_user' => false])->save();
        }
        $data = ['ticket' => $this->desk->card($ticket->load('assignee'), false), 'messages' => $this->desk->thread($ticket, false)];

        return $request->wantsJson() ? response()->json($data) : Inertia::render('support/show', $data);
    }

    public function reply(Request $request, SupportTicket $ticket): RedirectResponse|JsonResponse
    {
        $this->authorizeOwner($request, $ticket);
        $data = $request->validate([
            'body' => ['required', 'string', 'min:2', 'max:5000'],
            'files' => ['nullable', 'array', 'max:'.SupportDesk::MAX_FILES],
            'files.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);
        $this->desk->reply($ticket, $request->user(), $data['body'], array_values($request->file('files', [])));

        return $request->wantsJson() ? response()->json(['messages' => $this->desk->thread($ticket->fresh() ?? $ticket, false)]) : back();
    }

    public function close(Request $request, SupportTicket $ticket): RedirectResponse|JsonResponse
    {
        $this->authorizeOwner($request, $ticket);
        $this->desk->close($ticket, $request->user());

        return $request->wantsJson() ? response()->json(['ok' => true]) : back();
    }

    public function rate(Request $request, SupportTicket $ticket): RedirectResponse|JsonResponse
    {
        $this->authorizeOwner($request, $ticket);
        $data = $request->validate(['rating' => ['required', 'integer', 'min:1', 'max:5'], 'comment' => ['nullable', 'string', 'max:500']]);
        $this->desk->rate($ticket, (int) $data['rating'], $data['comment'] ?? null);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Дякуємо за оцінку!']);

        return $request->wantsJson() ? response()->json(['ok' => true]) : back();
    }

    /** Знімок екрана зі звернення — лише автору звернення й персоналу (нотатки — лише персоналу). */
    public function file(Request $request, SupportTicket $ticket, SupportMessage $message, int $index): StreamedResponse
    {
        $user = $request->user();
        abort_unless($message->ticket_id === $ticket->id && ($user->isStaff() || ($ticket->user_id === $user->id && ! $message->internal)), 404);
        $path = $message->attachments[$index] ?? null;
        abort_if($path === null || ! Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path, null, ['Cache-Control' => 'private, max-age=3600']);
    }

    private function authorizeOwner(Request $request, SupportTicket $ticket): void
    {
        abort_unless($ticket->user_id === $request->user()->id, 404);
    }
}
