<?php

namespace App\Jobs;

use App\Models\BotLink;
use App\Models\ClanEvent;
use App\Models\Community;
use App\Models\FamilyEvent;
use App\Models\Post;
use App\Services\Bots\BotHub;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/** Картка події, нагадування чи поста — у чати Telegram і Discord, куди групу підключено. */
class RelayToBots implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 2;

    public function __construct(public readonly string $kind, public readonly int $subjectId) {}

    /** Ставить у чергу, лише якщо в групи є підключений бот. */
    public static function maybe(string $ownerType, int $ownerId, string $kind, int $subjectId): void
    {
        if (BotLink::query()->where('owner_type', $ownerType)->where('owner_id', $ownerId)->whereNotNull('chat_id')->exists()) {
            self::dispatch($kind, $subjectId);
        }
    }

    public function handle(BotHub $hub): void
    {
        match ($this->kind) {
            'family_event' => ($e = FamilyEvent::query()->find($this->subjectId)) ? $hub->eventCreated($e) : null,
            'clan_event' => ($e = ClanEvent::query()->find($this->subjectId)) ? $hub->eventCreated($e) : null,
            'family_reminder' => ($e = FamilyEvent::query()->find($this->subjectId)) ? $hub->eventReminder($e) : null,
            'clan_reminder' => ($e = ClanEvent::query()->find($this->subjectId)) ? $hub->eventReminder($e) : null,
            'post' => $this->post($hub),
            default => null,
        };
    }

    private function post(BotHub $hub): void
    {
        $post = Post::query()->find($this->subjectId);
        $wall = $post?->wall;
        if ($post !== null && $wall instanceof Community) {
            $hub->postPublished($wall, $post);
        }
    }
}
