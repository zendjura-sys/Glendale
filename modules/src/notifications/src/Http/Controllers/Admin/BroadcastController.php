<?php

namespace Addons\Notifications\Http\Controllers\Admin;

use Addons\AiAssistant\Services\BroadcastTextAssistant;
use Addons\Notifications\Jobs\SendBroadcastTelegramMessage;
use Addons\Notifications\Models\Broadcast;
use Addons\Notifications\Models\BroadcastDelivery;
use Addons\TelegramBot\Models\TelegramLink;
use App\Models\Setting;
use App\Models\User;
use App\Support\FamilyContent;
use App\Support\MobilePushSender;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class BroadcastController
{
    public function index(): Response
    {
        $broadcasts = Broadcast::query()
            ->with('creator:id,name')
            ->orderByDesc('pinned')
            ->latest()
            ->paginate(15)
            ->through(fn (Broadcast $b) => [
                'id' => $b->id,
                'title' => $b->title,
                'body' => $b->body,
                'pinned' => $b->pinned,
                'audience_type' => $b->audience_type,
                'audience_value' => $b->audience_value,
                'recipients_count' => $b->recipients_count,
                'created_at' => $b->created_at,
                'creator' => $b->creator,
                'telegram' => $b->deliveryStats(),
            ]);

        return Inertia::render('Admin/Broadcasts/Index', [
            'broadcasts' => $broadcasts,
            'roles' => Role::query()->pluck('name'),
            'positions' => collect(FamilyContent::positions())->map(fn ($p) => ['key' => $p['key'], 'title' => $p['title']])->values(),
            'aiBroadcastAssistEnabled' => class_exists(BroadcastTextAssistant::class) && Setting::get('ai_broadcast_assist_enabled') === '1',
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->publish($this->validated($request), $request->user());

        return back()->with('success', 'Розсилку опубліковано.');
    }

    /** @return array<string, mixed> */
    protected function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'body' => ['required', 'string', 'max:4000'],
            'pinned' => ['boolean'],
            'audience_type' => ['required', Rule::in(['all', 'role', 'position'])],
            'audience_value' => ['required_unless:audience_type,all', 'nullable', 'string', 'max:100'],
        ]);
    }

    /**
     * Спільне для веб-форми й мобільного API: рахує аудиторію, заводить
     * Broadcast, bulk-insert веб-копій у notifications і диспатчить
     * Telegram-доставку тим, хто прив'язаний.
     */
    protected function publish(array $data, User $author): Broadcast
    {
        $recipients = User::query()->inActiveFamily()
            ->select('id')
            ->when($data['audience_type'] === 'role', fn ($q) => $q->role($data['audience_value']))
            // Посада — своя в кожній родині (family_members.position_key).
            ->when($data['audience_type'] === 'position', fn ($q) => $q->whereIn('id', \Illuminate\Support\Facades\DB::table('family_members')
                ->where('family_id', \App\Families\FamilyContext::id())->where('position_key', $data['audience_value'])->select('user_id')))
            ->get();

        $broadcast = Broadcast::create([
            'title' => $data['title'],
            'body' => $data['body'],
            'pinned' => $data['pinned'] ?? false,
            'audience_type' => $data['audience_type'],
            'audience_value' => $data['audience_type'] === 'all' ? null : $data['audience_value'],
            'recipients_count' => $recipients->count(),
            'created_by' => $author->id,
        ]);

        $now = now();
        $recipients->chunk(200)->each(function ($chunk) use ($broadcast, $now) {
            DB::table('notifications')->insert($chunk->map(fn (User $user) => [
                'user_id' => $user->id,
                'type' => 'broadcast',
                'title' => $broadcast->title,
                'body' => $broadcast->body,
                'read_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all());
        });

        $this->dispatchTelegramDeliveries($broadcast, $recipients);
        (new MobilePushSender())->sendToUserIds($recipients->pluck('id'), $broadcast->title, $broadcast->body);

        return $broadcast;
    }

    /**
     * Чернетка — не публікація: адмін бачить покращений варіант і сам
     * вирішує, вставляти його чи ні. Нічого не зберігається й не шлеться.
     */
    public function polish(Request $request): JsonResponse
    {
        if (! class_exists(BroadcastTextAssistant::class)) {
            return response()->json([
                'ok' => false,
                'message' => 'Модуль AI Assistant не встановлено.',
                'data' => null,
                'errors' => null,
                'redirect' => null,
            ], 422);
        }

        $data = $request->validate(['body' => ['required', 'string', 'max:4000']]);

        $text = app(BroadcastTextAssistant::class)->polish($data['body']);

        return response()->json([
            'ok' => $text !== null,
            'message' => $text !== null ? null : 'Не вдалося покращити текст — перевірте налаштування AI.',
            'data' => ['text' => $text],
            'errors' => null,
            'redirect' => null,
        ], $text !== null ? 200 : 422);
    }

    /**
     * Delivery-рядок і job заводимо тільки тим, хто реально прив'язав
     * Telegram, — інакше довелось би тримати "skipped"-статус лише заради
     * того, кому й так нема куди слати.
     */
    protected function dispatchTelegramDeliveries(Broadcast $broadcast, $recipients): void
    {
        if (! class_exists(TelegramLink::class) || $recipients->isEmpty()) {
            return;
        }

        $linkedUserIds = TelegramLink::query()
            ->whereIn('user_id', $recipients->pluck('id'))
            ->whereNotNull('linked_at')
            ->pluck('user_id');

        foreach ($linkedUserIds as $userId) {
            $delivery = BroadcastDelivery::create([
                'broadcast_id' => $broadcast->id,
                'user_id' => $userId,
                'status' => 'pending',
            ]);

            SendBroadcastTelegramMessage::dispatch($delivery->id);
        }
    }
}
