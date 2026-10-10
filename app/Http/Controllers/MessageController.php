<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\MessageFavorite;
use App\Models\MessageReport;
use App\Models\Sticker;
use App\Models\StickerPack;
use App\Models\User;
use App\Services\Messenger;
use App\Services\MessengerPresenter;
use App\Services\Moderation\ContentFilter;
use App\Services\Moderation\MessageReports;
use App\Services\Plus\Plus;
use App\Services\PostCards;
use App\Support\Plugins\Plugins;
use App\Support\Settings\SiteSettings;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MessageController extends Controller
{
    public const MAX_LENGTH = 4096;

    public const MAX_IMAGES = 10;

    public const MAX_FILES = 10;

    public const MAX_VOICE_KB = 10240;

    public const MAX_VOICE_SECONDS = 600;

    public const VOICE_MIMES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'video/webm', 'video/mp4'];

    public function __construct(
        private readonly Messenger $messenger,
        private readonly MessengerPresenter $presenter,
        private readonly ContentFilter $filter,
    ) {}

    public function store(Request $request, Conversation $conversation, SiteSettings $settings): JsonResponse
    {
        $user = $request->user();
        abort_if($conversation->participantFor($user) === null, 404);

        if (! $conversation->isGroup()) {
            $peer = $conversation->activeParticipants()->where('user_id', '!=', $user->id)->with('user')->first()?->user;
            abort_unless($peer && $this->messenger->canMessage($user, $peer), 403, 'Ви не можете написати цьому користувачу.');
        }
        $this->messenger->assertCanSend($conversation, $user);

        $maxKb = (int) $settings->get('max_upload_mb') * 1024;

        $data = $request->validate([
            'body' => ['nullable', 'string', 'max:'.self::MAX_LENGTH],
            'reply_to_id' => ['nullable', 'integer'],
            'images' => ['nullable', 'array', 'max:'.self::MAX_IMAGES],
            'images.*' => ['image', 'mimes:jpg,jpeg,png,webp,gif', 'max:'.$maxKb],
            'files' => ['nullable', 'array', 'max:'.self::MAX_FILES],
            'files.*' => ['file', 'max:'.max((int) $settings->get('max_message_file_mb'), (int) app(Plus::class)->limit($user, 'message_file_mb')) * 1024],
            'sticker_id' => ['nullable', 'integer'],
            'contact_id' => ['nullable', 'integer'],
            'voice' => ['nullable', 'file', 'max:'.self::MAX_VOICE_KB, 'mimetypes:'.implode(',', self::VOICE_MIMES)],
            'voice_duration' => ['required_with:voice', 'integer', 'min:1', 'max:'.self::MAX_VOICE_SECONDS],
            'voice_waveform' => ['nullable', 'string', 'max:1000'],
            'publish_at' => ['nullable', 'date'],
            'disappear' => ['nullable', 'boolean'],
            'card' => ['nullable', 'array'],
            'card.kind' => ['required_with:card', Rule::in(['game', 'movie', 'server'])],
            'card.id' => ['required_with:card', 'integer', 'min:1'],
        ], [
            'voice.mimetypes' => 'Непідтримуваний формат запису.',
            'voice.max' => 'Голосове повідомлення завелике.',
            'files.*.max' => 'Файл завеликий.',
        ]);

        $plugins = app(Plugins::class);
        if ($request->filled('publish_at')) {
            $plugins->ensure('scheduled_messages');
        }
        if ($request->boolean('disappear')) {
            $plugins->ensure('disappearing_messages');
        }
        $replyTo = isset($data['reply_to_id']) ? (int) $data['reply_to_id'] : null;
        $card = $this->card($data);
        $publishAt = $this->publishAt($request);
        $expiresAt = $request->boolean('disappear') ? ($publishAt ?? now())->copy()->addDay() : null;
        // Автомодерація: мут, флуд, повтори, посилання від новачків, мат.
        $data['body'] = $this->filter->guardMessage($user, $conversation, isset($data['body']) ? (string) $data['body'] : null);

        $message = match (true) {
            isset($data['sticker_id']) => $this->messenger->sendSticker(
                $conversation,
                $user,
                Sticker::query()->whereKey($data['sticker_id'])->whereHas('pack', fn ($q) => $q->active()->when(! $user->isPlus(), fn ($q) => $q->where('is_plus', false)))->firstOr(
                    fn () => throw ValidationException::withMessages(['sticker_id' => 'Стікер недоступний.'])
                ),
                $replyTo,
            ),
            $request->hasFile('voice') => $this->messenger->sendVoice(
                $conversation,
                $user,
                $request->file('voice'),
                (int) $data['voice_duration'],
                $this->waveform($data['voice_waveform'] ?? '[]'),
                $replyTo,
            ),
            isset($data['contact_id']) => $this->messenger->sendContact(
                $conversation,
                $user,
                User::query()->whereNull('banned_at')->whereNull('frozen_at')->whereKey($data['contact_id'])->firstOr(
                    fn () => throw ValidationException::withMessages(['contact_id' => 'Користувача не знайдено.'])
                ),
                $replyTo,
            ),
            default => $this->sendText($conversation, $user, $data, $request, $publishAt, $expiresAt, $card),
        };

        return response()->json(['message' => $this->presenter->message($this->presenter->load($message))], 201);
    }

    public function report(Request $request, Conversation $conversation, Message $message, MessageReports $reports): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', Rule::in(array_keys(MessageReport::REASONS))],
            'comment' => ['nullable', 'string', 'max:300'],
        ]);
        $reports->report($conversation, $message, $request->user(), (string) $data['reason'], $data['comment'] ?? null);

        return response()->json(['ok' => true, 'message' => 'Дякуємо! Скаргу надіслано модераторам.']);
    }

    public function cards(Request $request, PostCards $cards): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        abort_if(mb_strlen($q) < 2, 422);

        return response()->json(['cards' => $cards->chatSearch($q)]);
    }

    public function stickers(): JsonResponse
    {
        // Набори GameCon+ видно всім (як рекламу), але надсилати їх можна лише з підпискою.
        $plus = (bool) request()->user()?->isPlus();

        return response()->json(['packs' => array_map(fn (array $pack) => [...$pack, 'locked' => $pack['is_plus'] && ! $plus], StickerPack::catalog())]);
    }

    public function download(Request $request, MessageAttachment $attachment): StreamedResponse
    {
        $message = $attachment->message()->withTrashed()->first();
        abort_if($message === null || $message->trashed() || $message->conversation->participantFor($request->user()) === null, 404);
        abort_unless($attachment->disk === MessageAttachment::PRIVATE_DISK && Storage::disk($attachment->disk)->exists($attachment->path), 404);

        return Storage::disk($attachment->disk)->download($attachment->path, $attachment->name ?? 'file');
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array{kind: string, id: int, title: string, hint: string, href: string, image: string|null}|null  $card
     */
    private function sendText(Conversation $conversation, User $user, array $data, Request $request, ?CarbonInterface $publishAt = null, ?CarbonInterface $expiresAt = null, ?array $card = null): Message
    {
        $images = $this->uploadedList($request->file('images', []));
        $files = $this->uploadedList($request->file('files', []));

        if (count($images) + count($files) > self::MAX_IMAGES) {
            throw ValidationException::withMessages(['files' => 'Не більше '.self::MAX_IMAGES.' вкладень в одному повідомленні.']);
        }

        return $this->messenger->send(
            $conversation,
            $user,
            $data['body'] ?? null,
            $images,
            isset($data['reply_to_id']) ? (int) $data['reply_to_id'] : null,
            $files,
            $publishAt,
            $expiresAt,
            $card,
        );
    }

    /**
     * @return list<UploadedFile>
     */
    private function uploadedList(mixed $files): array
    {
        $list = [];
        foreach (is_array($files) ? $files : [$files] as $file) {
            if ($file instanceof UploadedFile) {
                $list[] = $file;
            }
        }

        return $list;
    }

    /**
     * @return list<int>
     */
    private function waveform(mixed $raw): array
    {
        $decoded = is_string($raw) ? json_decode($raw, true) : $raw;
        if (! is_array($decoded)) {
            return [];
        }

        $peaks = [];
        foreach ($decoded as $peak) {
            if (is_numeric($peak)) {
                $peaks[] = (int) $peak;
            }
        }

        return $peaks;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{kind: string, id: int, title: string, hint: string, href: string, image: string|null}|null
     */
    private function card(array $data): ?array
    {
        if (! isset($data['card']) || ! is_array($data['card'])) {
            return null;
        }

        $card = app(PostCards::class)->resolve((string) $data['card']['kind'], (int) $data['card']['id']);
        if ($card === null) {
            throw ValidationException::withMessages(['card' => 'Картку не знайдено.']);
        }

        return $card;
    }

    private function publishAt(Request $request): ?CarbonInterface
    {
        $raw = $request->input('publish_at');
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }

        $at = Carbon::parse($raw, 'Europe/Kyiv');
        if ($at->lessThanOrEqualTo(now())) {
            throw ValidationException::withMessages(['publish_at' => 'Оберіть час у майбутньому.']);
        }
        if ($at->greaterThan(now()->addDays(30))) {
            throw ValidationException::withMessages(['publish_at' => 'Не далі ніж на 30 днів.']);
        }

        return $at;
    }

    public function update(Request $request, Conversation $conversation, Message $message): JsonResponse
    {
        abort_unless($message->conversation_id === $conversation->id, 404);
        $data = $request->validate(['body' => ['required', 'string', 'max:'.self::MAX_LENGTH]]);

        $this->filter->ensureCanPost($request->user());
        $this->messenger->edit($message, $request->user(), (string) $this->filter->clean($data['body']));

        return response()->json(['message' => $this->presenter->message($this->presenter->load($message->refresh()))]);
    }

    public function destroy(Request $request, Conversation $conversation, Message $message): JsonResponse
    {
        abort_unless($message->conversation_id === $conversation->id, 404);

        $this->messenger->delete($message, $request->user());

        return response()->json(['deleted' => true]);
    }

    public function forward(Request $request, Conversation $conversation, Message $message): JsonResponse
    {
        app(Plugins::class)->ensure('forward_message');
        $user = $request->user();
        abort_if($conversation->participantFor($user) === null, 404);
        abort_unless($message->conversation_id === $conversation->id && ! $message->trashed(), 404);
        abort_if($message->type === Message::TYPE_SYSTEM, 422);

        $data = $request->validate(['conversation_id' => ['required', 'integer']]);
        $target = Conversation::query()->findOrFail((int) $data['conversation_id']);
        abort_if($target->participantFor($user) === null, 404);

        if (! $target->isGroup()) {
            $peer = $target->activeParticipants()->where('user_id', '!=', $user->id)->with('user')->first()?->user;
            abort_unless($peer && $this->messenger->canMessage($user, $peer), 403);
        }

        $copy = $this->messenger->forward($target, $user, $message);

        return response()->json(['message' => $this->presenter->message($this->presenter->load($copy))], 201);
    }

    public function favorite(Request $request, Conversation $conversation, Message $message): JsonResponse
    {
        app(Plugins::class)->ensure('favorite_messages');
        $user = $request->user();
        abort_if($conversation->participantFor($user) === null, 404);
        abort_unless($message->conversation_id === $conversation->id && ! $message->trashed(), 404);

        $existing = MessageFavorite::query()->where('user_id', $user->id)->where('message_id', $message->id)->first();
        if ($existing) {
            $existing->delete();

            return response()->json(['starred' => false]);
        }

        MessageFavorite::query()->create(['user_id' => $user->id, 'message_id' => $message->id]);

        return response()->json(['starred' => true]);
    }
}
