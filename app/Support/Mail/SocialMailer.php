<?php

namespace App\Support\Mail;

use App\Mail\SocialActivityMail;
use App\Models\Community;
use App\Models\Family;
use App\Models\User;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Кожне сповіщення дзвіночка додатково йде листом із адреси social@.
 * Текст той самий, що в дзвіночку.
 */
class SocialMailer
{
    public function notification(object $notifiable, DatabaseNotification $notification): void
    {
        if (! $notifiable instanceof User || $notifiable->banned_at !== null) {
            return;
        }

        $email = trim((string) $notifiable->email);
        if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return;
        }

        $data = $notification->data;
        $text = $this->plain((string) ($data['text'] ?? ''));
        if ($text === '') {
            return;
        }

        $actorId = $this->id($data['actor_id'] ?? null);
        if ($actorId !== null && $actorId === $notifiable->id) {
            return;
        }

        $sender = $this->sender($data);
        $excerpt = $this->plain((string) ($data['excerpt'] ?? ''));
        $intro = $actorId !== null ? trim($sender.' '.$text) : $text;
        if ($excerpt !== '') {
            $intro .= ': «'.$excerpt.'»';
        }

        $rawUrl = (string) ($data['url'] ?? '/notifications');
        $actionUrl = str_starts_with($rawUrl, '/') ? url($rawUrl) : url('/notifications');

        Mail::to($email)->queue(new SocialActivityMail(
            subjectLine: Str::limit($intro, 140),
            intro: Str::limit($intro, 500),
            actionUrl: $actionUrl,
            fromName: Str::limit($sender, 80),
        ));
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function sender(array $data): string
    {
        $actorId = $this->id($data['actor_id'] ?? null);
        if ($actorId !== null) {
            $actor = User::query()->find($actorId);
            if ($actor instanceof User && $actor->name !== '') {
                return $actor->name;
            }
        }

        $familyId = $this->id($data['family_id'] ?? null);
        if ($familyId !== null) {
            $family = Family::query()->find($familyId);
            if ($family instanceof Family) {
                return '['.$family->tag.'] '.$family->name;
            }
        }

        $communityId = $this->id($data['community_id'] ?? null);
        if ($communityId !== null) {
            $community = Community::query()->find($communityId);
            if ($community instanceof Community && $community->name !== '') {
                return $community->name;
            }
        }

        return (string) config('app.name');
    }

    private function plain(string $value): string
    {
        $value = str_replace(["\r", "\n", "\0"], ' ', $value);

        return trim((string) preg_replace('/\s+/u', ' ', $value));
    }

    private function id(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_string($value) && ctype_digit($value)) {
            return (int) $value;
        }

        return null;
    }
}
