<?php

namespace App\Services\Moderation;

use App\Jobs\AssessMessageReport;
use App\Models\Conversation;
use App\Models\Family;
use App\Models\Message;
use App\Models\MessageReport;
use App\Models\User;
use App\Services\Families\FamilyNotifier;
use App\Services\Messenger;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Скарги на повідомлення: учасник чату скаржиться, модерація вирішує — видалити повідомлення,
 * заглушити автора на сайті або відхилити скаргу. Про скарги в чаті сім’ї дізнається й керівництво сім’ї.
 */
class MessageReports
{
    public function __construct(
        private readonly FamilyNotifier $notifier,
        private readonly Messenger $messenger,
    ) {}

    public function report(Conversation $conversation, Message $message, User $reporter, string $reason, ?string $comment): MessageReport
    {
        abort_unless($message->conversation_id === $conversation->id, 404);
        abort_unless($conversation->participantFor($reporter) !== null, 403, 'Скаржитися можна лише на повідомлення у своїх чатах.');
        if ($message->user_id === $reporter->id) {
            throw ValidationException::withMessages(['reason' => 'На власне повідомлення скаржитися не можна.']);
        }

        $report = MessageReport::query()->updateOrCreate(
            ['message_id' => $message->id, 'reporter_id' => $reporter->id],
            ['reason' => $reason, 'comment' => $comment, 'status' => MessageReport::PENDING],
        );

        // ШІ оцінить терміновість для черги модерації — після відповіді, скарга не чекає.
        if (app(Plugins::class)->on('ai_moderation')) {
            AssessMessageReport::dispatch($report->id)->afterResponse();
        }

        $family = $conversation->family_id !== null ? Family::query()->find($conversation->family_id) : null;
        if ($family instanceof Family) {
            $author = $message->user->name ?? 'учасника';
            $this->notifier->holders($family, 'sanctions.issue', 'report', "Скарга на повідомлення {$author} у чаті сім’ї: «".Str::limit((string) $message->body, 80).'»', route('families.discipline', $family, absolute: false));
        }

        return $report;
    }

    /**
     * Рішення модератора: delete — видалити повідомлення, mute — ще й заглушити автора, dismiss — відхилити.
     */
    public function resolve(MessageReport $report, User $moderator, string $action, ?int $hours = null, ?string $reason = null): void
    {
        $message = Message::withTrashed()->find($report->message_id);
        $author = $message?->user;

        if (in_array($action, ['delete', 'mute'], true) && $message !== null) {
            $this->messenger->moderatorDelete($message);
        }
        if ($action === 'mute' && $author instanceof User && ! $author->isStaff()) {
            $author->forceFill([
                'muted_until' => now()->addHours(max(1, (int) $hours)),
                'mute_reason' => $reason !== null && trim($reason) !== '' ? Str::limit(trim($reason), 200, '') : MessageReport::REASONS[$report->reason] ?? null,
            ])->save();
        }

        if (in_array($action, ['delete', 'mute'], true) && $author instanceof User) {
            app(Strikes::class)->add($author, $moderator, $reason ?? (MessageReport::REASONS[$report->reason] ?? null), 'message_report');
        }

        MessageReport::query()->where('message_id', $report->message_id)->where('status', MessageReport::PENDING)->update([
            'status' => $action === 'dismiss' ? MessageReport::DISMISSED : MessageReport::RESOLVED,
            'resolved_by' => $moderator->id,
            'resolution' => $action,
        ]);
    }

    public function unmute(User $user): void
    {
        $user->forceFill(['muted_until' => null, 'mute_reason' => null])->save();
    }
}
