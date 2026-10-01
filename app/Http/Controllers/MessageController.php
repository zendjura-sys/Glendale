<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\Sticker;
use App\Models\StickerPack;
use App\Models\User;
use App\Services\Messenger;
use App\Services\MessengerPresenter;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
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
    ) {}

    public function store(Request $request, Conversation $conversation, SiteSettings $settings): JsonResponse
    {
        $user = $request->user();
        abort_if($conversation->participantFor($user) === null, 404);

        if (! $conversation->isGroup()) {
            $peer = $conversation->activeParticipants()->where('user_id', '!=', $user->id)->with('user')->first()?->user;
            abort_unless($peer && $this->messenger->canMessage($user, $peer), 403, 'Ви не можете написати цьому користувачу.');
        }

        $maxKb = (int) $settings->get('max_upload_mb') * 1024;

        $data = $request->validate([
            'body' => ['nullable', 'string', 'max:'.self::MAX_LENGTH],
            'reply_to_id' => ['nullable', 'integer'],
            'images' => ['nullable', 'array', 'max:'.self::MAX_IMAGES],
            'images.*' => ['image', 'mimes:jpg,jpeg,png,webp,gif', 'max:'.$maxKb],
            'files' => ['nullable', 'array', 'max:'.self::MAX_FILES],
            'files.*' => ['file', 'max:'.(int) $settings->get('max_message_file_mb') * 1024],
            'sticker_id' => ['nullable', 'integer'],
            'contact_id' => ['nullable', 'integer'],
            'voice' => ['nullable', 'file', 'max:'.self::MAX_VOICE_KB, 'mimetypes:'.implode(',', self::VOICE_MIMES)],
            'voice_duration' => ['required_with:voice', 'integer', 'min:1', 'max:'.self::MAX_VOICE_SECONDS],
            'voice_waveform' => ['nullable', 'string', 'max:1000'],
        ], [
            'voice.mimetypes' => 'Непідтримуваний формат запису.',
            'voice.max' => 'Голосове повідомлення завелике.',
            'files.*.max' => 'Файл завеликий.',
        ]);

        $replyTo = isset($data['reply_to_id']) ? (int) $data['reply_to_id'] : null;

        $message = match (true) {
            isset($data['sticker_id']) => $this->messenger->sendSticker(
                $conversation,
                $user,
                Sticker::query()->whereKey($data['sticker_id'])->whereHas('pack', fn ($q) => $q->active())->firstOr(
                    fn () => throw ValidationException::withMessages(['sticker_id' => 'Стікер недоступний.'])
                ),
                $replyTo,
            ),
            $request->hasFile('voice') => $this->messenger->sendVoice(
                $conversation,
                $user,
                $request->file('voice'),
                (int) $data['voice_duration'],
                array_filter((array) json_decode($data['voice_waveform'] ?? '[]', true), 'is_numeric'),
                $replyTo,
            ),
            isset($data['contact_id']) => $this->messenger->sendContact(
                $conversation,
                $user,
                User::query()->whereNull('banned_at')->whereKey($data['contact_id'])->firstOr(
                    fn () => throw ValidationException::withMessages(['contact_id' => 'Користувача не знайдено.'])
                ),
                $replyTo,
            ),
            default => $this->sendText($conversation, $user, $data, $request),
        };

        return response()->json(['message' => $this->presenter->message($this->presenter->load($message))], 201);
    }

    public function stickers(): JsonResponse
    {
        return response()->json(['packs' => StickerPack::catalog()]);
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
     */
    private function sendText(Conversation $conversation, User $user, array $data, Request $request): Message
    {
        $images = $request->file('images', []);
        $files = $request->file('files', []);

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
        );
    }

    public function update(Request $request, Conversation $conversation, Message $message): JsonResponse
    {
        abort_unless($message->conversation_id === $conversation->id, 404);
        $data = $request->validate(['body' => ['required', 'string', 'max:'.self::MAX_LENGTH]]);

        $this->messenger->edit($message, $request->user(), $data['body']);

        return response()->json(['message' => $this->presenter->message($this->presenter->load($message->refresh()))]);
    }

    public function destroy(Request $request, Conversation $conversation, Message $message): JsonResponse
    {
        abort_unless($message->conversation_id === $conversation->id, 404);

        $this->messenger->delete($message, $request->user());

        return response()->json(['deleted' => true]);
    }
}
