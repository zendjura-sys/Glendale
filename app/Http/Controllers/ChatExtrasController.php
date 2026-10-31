<?php

namespace App\Http\Controllers;

use App\Events\Messenger\ConversationUpdated;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\MessagePin;
use App\Services\Messenger;
use App\Services\MessengerPresenter;
use App\Services\Moderation\ContentFilter;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/** Гілки в групах, кілька закріплених повідомлень, особиста нотатка до бесіди й фото «на один перегляд». */
class ChatExtrasController extends Controller
{
    /** Скільки відповідей гілки віддається за раз. */
    public const THREAD_PAGE = 200;

    public function __construct(
        private readonly Messenger $messenger,
        private readonly MessengerPresenter $presenter,
    ) {}

    public function thread(Request $request, Conversation $conversation, Message $message): JsonResponse
    {
        app(Plugins::class)->ensure('chat_threads');
        $this->participant($conversation, $request);
        abort_unless($message->conversation_id === $conversation->id && $message->thread_root_id === null, 404);
        $replies = Message::query()->where('thread_root_id', $message->id)
            ->with(['user', 'attachments', 'reactions', 'replyTo.user', 'replyTo.attachments'])
            ->orderBy('id')->limit(self::THREAD_PAGE)->get();

        return response()->json([
            'root' => $this->presenter->message($this->presenter->load($message)),
            'messages' => array_values($replies->map(fn (Message $m) => $this->presenter->message($m))->all()),
        ]);
    }

    public function reply(Request $request, Conversation $conversation, Message $message, ContentFilter $filter): JsonResponse
    {
        app(Plugins::class)->ensure('chat_threads');
        $user = $request->user();
        $this->participant($conversation, $request);
        $this->messenger->assertCanSend($conversation, $user);
        $data = $request->validate(['body' => ['required', 'string', 'max:'.MessageController::MAX_LENGTH]]);
        $body = (string) $filter->guardMessage($user, $conversation, (string) $data['body']);
        $reply = $this->messenger->sendInThread($conversation, $user, $message, $body);

        return response()->json(['message' => $this->presenter->message($this->presenter->load($reply))], 201);
    }

    /** Закріпити / відкріпити (до MessagePin::MAX; у групах — лише адміністрація). */
    public function pin(Request $request, Conversation $conversation, Message $message): JsonResponse
    {
        app(Plugins::class)->ensure('chat_pins');
        $me = $this->participant($conversation, $request);
        abort_unless($message->conversation_id === $conversation->id && ! $message->trashed() && $message->thread_root_id === null, 404);
        abort_if($conversation->isGroup() && ! $me->canManage(), 403, 'Закріплювати можуть адміністратори групи.');

        $existing = MessagePin::query()->where('message_id', $message->id)->first();
        if ($existing !== null) {
            $existing->delete();
        } else {
            abort_if(MessagePin::query()->where('conversation_id', $conversation->id)->count() >= MessagePin::MAX, 422, 'Можна закріпити до '.MessagePin::MAX.' повідомлень — спершу відкріпіть старе.');
            MessagePin::query()->create(['conversation_id' => $conversation->id, 'message_id' => $message->id, 'user_id' => $request->user()->id]);
        }
        rescue(fn () => broadcast(new ConversationUpdated($conversation->id)), report: true);

        return response()->json(['pinned' => $existing === null, 'pins' => $this->presenter->pins($conversation)]);
    }

    /** Особиста нотатка до бесіди — бачить лише автор. */
    public function note(Request $request, Conversation $conversation): JsonResponse
    {
        app(Plugins::class)->ensure('chat_notes');
        $me = $this->participant($conversation, $request);
        $data = $request->validate(['note' => ['nullable', 'string', 'max:2000']]);
        $note = trim((string) ($data['note'] ?? ''));
        $me->forceFill(['note' => $note === '' ? null : $note])->save();

        return response()->json(['ok' => true, 'note' => $me->note, 'message' => 'Нотатку збережено.']);
    }

    /** Фото «на один перегляд»: отримувач відкриває його один раз; автор і повторні відкриття — 410. */
    public function once(Request $request, MessageAttachment $attachment): Response
    {
        app(Plugins::class)->ensure('view_once');
        $user = $request->user();
        $message = $attachment->message;
        abort_if($message === null || $message->trashed() || $message->conversation->participantFor($user) === null, 404);
        abort_unless(($attachment->meta['view_once'] ?? false) === true && $attachment->disk === MessageAttachment::PRIVATE_DISK, 404);
        abort_if($message->user_id === $user->id, 410, 'Фото на один перегляд відкриває лише отримувач.');
        $first = DB::table('message_attachment_views')->insertOrIgnore([
            'message_attachment_id' => $attachment->id,
            'user_id' => $user->id,
            'viewed_at' => now(),
        ]);
        abort_if($first === 0, 410, 'Фото вже переглянуто.');
        $disk = Storage::disk($attachment->disk);
        abort_unless($disk->exists($attachment->path), 410);
        $bytes = (string) $disk->get($attachment->path);
        // Усі отримувачі побачили — файл більше не потрібен.
        $recipients = $message->conversation->activeParticipants()->where('user_id', '!=', $message->user_id)->count();
        if (DB::table('message_attachment_views')->where('message_attachment_id', $attachment->id)->count() >= $recipients) {
            $disk->delete($attachment->path);
        }

        return response($bytes, 200, [
            'Content-Type' => $attachment->mime ?: 'image/jpeg',
            'Cache-Control' => 'no-store, private',
        ]);
    }

    private function participant(Conversation $conversation, Request $request): ConversationParticipant
    {
        $me = $conversation->participantFor($request->user());
        abort_if($me === null, 404);

        return $me;
    }
}
