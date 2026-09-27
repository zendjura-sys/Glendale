<?php

namespace Addons\TelegramBot\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Состояние диалога с одним чатом: какое сообщение сейчас служит меню и
 * на каком шаге анкеты человек находится. Telegram ничего этого не
 * помнит — каждый апдейт приходит «с чистого листа».
 */
class TelegramChat extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'telegram_chats';

    protected $fillable = [
        'chat_id', 'telegram_username', 'first_name', 'menu_message_id', 'step', 'draft',
    ];

    protected function casts(): array
    {
        return ['draft' => 'array', 'menu_message_id' => 'integer'];
    }

    public static function forChat(string $chatId, ?string $username = null, ?string $firstName = null): self
    {
        $chat = self::firstOrCreate(['chat_id' => $chatId]);

        // Человек мог сменить username или имя между заходами — держим
        // свежие, иначе в админке заявка будет подписана старым ником.
        $fresh = array_filter([
            'telegram_username' => $username,
            'first_name' => $firstName,
        ], static fn ($v) => $v !== null && $v !== '');

        if ($fresh && array_diff_assoc($fresh, $chat->only(array_keys($fresh)))) {
            $chat->update($fresh);
        }

        return $chat;
    }

    /** @return array<string,mixed> */
    public function draftData(): array
    {
        return $this->draft ?? [];
    }

    public function putDraft(string $key, mixed $value): void
    {
        $draft = $this->draftData();
        $draft[$key] = $value;
        $this->update(['draft' => $draft]);
    }

    public function clearDraft(): void
    {
        $this->update(['step' => null, 'draft' => null]);
    }
}
