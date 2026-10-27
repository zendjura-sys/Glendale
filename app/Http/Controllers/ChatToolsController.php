<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\MessageAttachment;
use App\Models\User;
use App\Services\Chat\ChatBackgrounds;
use App\Services\Chat\ChatRestrictions;
use App\Services\Chat\ChatShared;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Інструменти бесіди: «Матеріали чату» (медіа, файли, посилання, голосові), перегляд документів
 * без завантаження, тайм-аут і виключення на час, фон чату.
 */
class ChatToolsController extends Controller
{
    /** Скільки байтів текстового файлу показуємо в перегляді. */
    private const TEXT_PREVIEW = 65536;

    public function shared(Request $request, Conversation $conversation, ChatShared $shared): JsonResponse
    {
        app(Plugins::class)->ensure('chat_media_panel');
        abort_if($conversation->participantFor($request->user()) === null, 404);
        $data = $request->validate([
            'kind' => ['required', Rule::in(ChatShared::KINDS)],
            'before' => ['nullable', 'integer'],
        ]);

        return response()->json([
            ...$shared->page($conversation, $data['kind'], isset($data['before']) ? (int) $data['before'] : null),
            'counts' => isset($data['before']) ? null : $shared->counts($conversation),
        ]);
    }

    /** Документ «відкрити тут»: PDF, текст, картинка, аудіо чи відео — inline, лише учасникам бесіди. */
    public function preview(Request $request, MessageAttachment $attachment): StreamedResponse
    {
        app(Plugins::class)->ensure('chat_doc_preview');
        $message = $attachment->message()->withTrashed()->first();
        abort_if($message === null || $message->trashed() || $message->conversation->participantFor($request->user()) === null, 404);
        abort_unless($attachment->disk === MessageAttachment::PRIVATE_DISK && Storage::disk($attachment->disk)->exists($attachment->path), 404);
        $kind = MessageAttachment::previewKind($attachment->mime, $attachment->name);
        abort_if($kind === null, 415, 'Цей файл можна лише завантажити.');

        $headers = [
            'Content-Type' => match ($kind) {
                'pdf' => 'application/pdf',
                'text' => 'text/plain; charset=utf-8',
                default => (string) $attachment->mime,
            },
            // Файл від іншої людини: без виконання скриптів і без підміни типу.
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox",
        ];
        if ($kind === 'text') {
            $stream = Storage::disk($attachment->disk)->readStream($attachment->path);

            return response()->stream(function () use ($stream) {
                echo is_resource($stream) ? (string) fread($stream, self::TEXT_PREVIEW) : '';
            }, 200, $headers);
        }

        return Storage::disk($attachment->disk)->response($attachment->path, $attachment->name ?? 'file', $headers, 'inline');
    }

    public function restrict(Request $request, Conversation $conversation, User $user, ChatRestrictions $restrictions): RedirectResponse
    {
        app(Plugins::class)->ensure('chat_restrictions');
        $data = $request->validate([
            'kind' => ['required', Rule::in([ChatRestrictions::TIMEOUT, ChatRestrictions::KICK])],
            'minutes' => ['required', 'integer', Rule::in(ChatRestrictions::DURATIONS)],
        ]);
        $restrictions->restrict($conversation, $request->user(), $user, $data['kind'], (int) $data['minutes']);

        return back();
    }

    public function lift(Request $request, Conversation $conversation, User $user, ChatRestrictions $restrictions): RedirectResponse
    {
        app(Plugins::class)->ensure('chat_restrictions');
        $restrictions->lift($conversation, $request->user(), $user);

        return back();
    }

    public function background(Request $request, Conversation $conversation, ChatBackgrounds $backgrounds): RedirectResponse
    {
        app(Plugins::class)->ensure('chat_backgrounds');
        $data = $request->validate([
            'preset' => ['nullable', Rule::in(ChatBackgrounds::PRESETS)],
            'for_all' => ['boolean'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
        ]);
        $forAll = $request->boolean('for_all');
        $file = $request->file('image');
        if ($file !== null) {
            $backgrounds->upload($conversation, $request->user(), $file, $forAll);
        } else {
            $backgrounds->set($conversation, $request->user(), $data['preset'] ?? null, $forAll);
        }

        return back();
    }
}
