<?php

namespace App\Services\Support;

use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\User;
use App\Notifications\AccountNotice;
use App\Services\ImageStorage;
use App\Services\Moderation\ContentFilter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Підтримка: звернення людини, листування з персоналом, внутрішні нотатки, призначення,
 * пріоритет, автозакриття, оцінка. Знімки екрана — на приватному диску, віддаються лише учасникам.
 */
class SupportDesk
{
    public const MAX_FILES = 3;

    /** Звернень, відкритих одночасно, — щоб не засипали чергу. */
    public const MAX_OPEN = 5;

    /**
     * @param  array{category: string, subject: string, body: string, url?: string|null}  $data
     * @param  list<UploadedFile>  $files
     */
    public function open(User $user, array $data, array $files = []): SupportTicket
    {
        abort_if(SupportTicket::query()->where('user_id', $user->id)->where('status', '!=', 'closed')->count() >= self::MAX_OPEN, 422, 'У вас уже 5 відкритих звернень — дочекайтеся відповіді на них.');
        $ticket = DB::transaction(function () use ($user, $data, $files) {
            $ticket = SupportTicket::query()->create([
                'user_id' => $user->id,
                'category' => $data['category'],
                'subject' => Str::limit(trim($data['subject']), 120, ''),
                'url' => isset($data['url']) && str_starts_with((string) $data['url'], '/') ? Str::limit((string) $data['url'], 250, '') : null,
                // Оплата й безпека акаунта — вище в черзі.
                'priority' => in_array($data['category'], ['payment', 'account'], true) ? 'high' : 'normal',
                'last_reply_at' => now(),
            ]);
            $this->message($ticket, $user, $data['body'], $files, false, false);

            return $ticket;
        });
        $admins = User::query()->where('role', User::ROLE_ADMIN)->whereKeyNot($user->id)->limit(20)->get();
        Notification::send($admins, new AccountNotice('support_staff', $user, 'Нове звернення #'.$ticket->id.': '.$ticket->subject, Str::limit($data['body'], 120), '/admin/support/'.$ticket->id));

        return $ticket;
    }

    /**
     * @param  list<UploadedFile>  $files
     */
    public function reply(SupportTicket $ticket, User $author, string $body, array $files = [], bool $internal = false): SupportMessage
    {
        $staff = $author->id !== $ticket->user_id && $author->isStaff();
        abort_if(! $staff && $ticket->user_id !== $author->id, 403);
        abort_if(! $staff && $ticket->status === 'closed' && $ticket->closed_at?->lt(now()->subDays(30)), 422, 'Звернення закрите давно — створіть нове.');
        $message = $this->message($ticket, $author, $body, $files, $staff, $staff && $internal);
        if ($message->internal) {
            return $message;
        }
        if ($staff) {
            $ticket->forceFill([
                'status' => 'answered',
                'unread_user' => true,
                'unread_staff' => false,
                'assignee_id' => $ticket->assignee_id ?? $author->id,
                'first_response_at' => $ticket->first_response_at ?? now(),
                'last_reply_at' => now(),
                'closed_at' => null,
            ])->save();
            $ticket->user->notify(new AccountNotice('support', $author, 'Відповідь у зверненні #'.$ticket->id, Str::limit($body, 120), '/support/'.$ticket->id));
        } else {
            // Людина дописала — звернення знову чекає на персонал (і відкривається, якщо було закрите).
            $ticket->forceFill(['status' => 'open', 'unread_staff' => true, 'last_reply_at' => now(), 'closed_at' => null])->save();
            $ticket->assignee?->notify(new AccountNotice('support_staff', $author, 'Нове повідомлення у зверненні #'.$ticket->id, Str::limit($body, 120), '/admin/support/'.$ticket->id));
        }

        return $message;
    }

    public function close(SupportTicket $ticket, User $by): void
    {
        $ticket->forceFill(['status' => 'closed', 'closed_at' => now()])->save();
        if ($by->id !== $ticket->user_id) {
            $this->message($ticket, null, 'Звернення закрито. Якщо питання лишилося — просто напишіть сюди, і ми продовжимо.', [], true, false);
            $ticket->forceFill(['unread_user' => true])->save();
        }
    }

    public function rate(SupportTicket $ticket, int $rating, ?string $comment): void
    {
        abort_unless($ticket->status === 'closed', 422, 'Оцінити можна закрите звернення.');
        $ticket->forceFill(['rating' => max(1, min(5, $rating)), 'rating_comment' => $comment ? Str::limit(trim($comment), 500, '') : null])->save();
    }

    /** Щодня: відповіли тиждень тому, а людина мовчить — закрити. */
    public function autoClose(): int
    {
        $count = 0;
        SupportTicket::query()->where('status', 'answered')->where('last_reply_at', '<', now()->subDays(SupportTicket::AUTO_CLOSE_DAYS))->each(function (SupportTicket $ticket) use (&$count) {
            $ticket->forceFill(['status' => 'closed', 'closed_at' => now()])->save();
            $this->message($ticket, null, 'Закрили автоматично: тиждень без відповіді. Напишіть сюди, якщо питання лишилося.', [], true, false);
            $count++;
        });

        return $count;
    }

    /**
     * @return array<string, mixed>
     */
    public function card(SupportTicket $ticket, bool $forStaff): array
    {
        return [
            'id' => $ticket->id,
            'subject' => $ticket->subject,
            'category' => $ticket->category,
            'category_label' => SupportTicket::CATEGORIES[$ticket->category] ?? $ticket->category,
            'status' => $ticket->status,
            'priority' => $ticket->priority,
            'unread' => $forStaff ? $ticket->unread_staff : $ticket->unread_user,
            'rating' => $ticket->rating,
            'created_at' => $ticket->created_at->toIso8601String(),
            'updated_at' => ($ticket->last_reply_at ?? $ticket->updated_at)->toIso8601String(),
            'user' => $forStaff ? $ticket->user->toCard() : null,
            'assignee' => $ticket->assignee?->toCard(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function thread(SupportTicket $ticket, bool $forStaff): array
    {
        return array_values($ticket->messages()->with('user')->get()
            ->filter(fn (SupportMessage $m) => $forStaff || ! $m->internal)
            ->map(fn (SupportMessage $m) => [
                'id' => $m->id,
                'body' => $m->body,
                'from_staff' => $m->from_staff,
                'internal' => $m->internal,
                // Людина бачить «Підтримка GameCon» і ім’я агента; персонал — повну картку.
                'author' => $m->user ? $m->user->toCard() : null,
                'files' => array_map(fn (int $i) => '/support/'.$ticket->id.'/files/'.$m->id.'/'.$i, array_keys($m->attachments ?? [])),
                'created_at' => $m->created_at->toIso8601String(),
            ])->all());
    }

    /**
     * @param  list<UploadedFile>  $files
     */
    private function message(SupportTicket $ticket, ?User $author, string $body, array $files, bool $fromStaff, bool $internal): SupportMessage
    {
        $paths = [];
        foreach (array_slice($files, 0, self::MAX_FILES) as $file) {
            // Знімки екрана можуть містити особисте — тільки приватний диск.
            $stored = app(ImageStorage::class)->store($file, 'support-tmp');
            $public = Storage::disk('public');
            $target = 'support/'.$ticket->id.'/'.basename($stored['path']);
            Storage::disk('local')->put($target, (string) $public->get($stored['path']));
            $public->delete($stored['path']);
            $paths[] = $target;
        }

        return $ticket->messages()->create([
            'user_id' => $author?->id,
            'body' => (string) app(ContentFilter::class)->clean(trim($body)),
            'from_staff' => $fromStaff,
            'internal' => $internal,
            'attachments' => $paths ?: null,
            'created_at' => now(),
        ]);
    }
}
