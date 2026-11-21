<?php

namespace App\Jobs;

use App\Models\ChatAutomation;
use App\Models\Message;
use App\Services\Ai\AiAssistant;
use App\Services\Ai\AiException;
use App\Services\Messenger;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Cache;

/** ШІ-бот відповідає в бесіді на повідомлення, де його згадали. */
class AiBotReply implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;

    public function __construct(public readonly int $botId, public readonly int $messageId) {}

    public function handle(AiAssistant $assistant, Messenger $messenger): void
    {
        $bot = ChatAutomation::query()->with('conversation')->find($this->botId);
        $message = Message::query()->with('user')->find($this->messageId);
        // Один раз на повідомлення, навіть якщо задачу запустять повторно.
        if ($bot === null || ! $bot->enabled || $bot->conversation === null || $message === null
            || ! Cache::add('ai-bot-reply:'.$message->id, true, now()->addDay())) {
            return;
        }
        try {
            $reply = $assistant->botReply($bot->conversation, $bot, $message);
        } catch (AiException $e) {
            $reply = '⚠️ '.$e->getMessage();
        }
        if ($reply !== '') {
            $messenger->sendAsBot($bot->conversation, $bot->bot_name, $reply);
        }
    }
}
