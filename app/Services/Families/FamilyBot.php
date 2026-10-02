<?php

namespace App\Services\Families;

use App\Models\Family;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * Відправка повідомлень сім’ї в Discord (webhook) і Telegram (бот).
 */
class FamilyBot
{
    public const DISCORD_PATTERN = '#^https://(?:ptb\.|canary\.)?discord(?:app)?\.com/api/webhooks/\d+/[\w-]+$#';

    public const TELEGRAM_TOKEN_PATTERN = '/^\d{6,12}:[A-Za-z0-9_-]{30,50}$/';

    /**
     * @return array<string, bool> результат по каналах
     */
    public function send(Family $family, string $text, ?string $title = null): array
    {
        $result = [];

        if ($url = $family->webhook('discord')) {
            $result['discord'] = $this->discord($url, $family, $text, $title);
        }

        if (($token = $family->webhook('telegram_token')) && ($chat = $family->webhook('telegram_chat'))) {
            $result['telegram'] = $this->telegram($token, $chat, $text, $title);
        }

        return $result;
    }

    private function discord(string $url, Family $family, string $text, ?string $title): bool
    {
        try {
            return Http::timeout(10)->post($url, [
                'username' => Str::limit("[{$family->tag}] {$family->name}", 80, ''),
                'avatar_url' => $family->logo_url && str_starts_with($family->logo_url, 'http') ? $family->logo_url : null,
                'embeds' => [[
                    'title' => $title ? Str::limit($title, 250, '') : null,
                    'description' => Str::limit($text, 4000),
                    'color' => 0x6D5DFC,
                    'footer' => ['text' => 'GameCon · сім’ї GTA RP'],
                    'timestamp' => now()->toIso8601String(),
                ]],
            ])->successful();
        } catch (Throwable) {
            return false;
        }
    }

    private function telegram(string $token, string $chat, string $text, ?string $title): bool
    {
        $body = ($title ? '<b>'.e($title)."</b>\n\n" : '').e(Str::limit($text, 3800));

        try {
            return Http::timeout(10)->post("https://api.telegram.org/bot{$token}/sendMessage", [
                'chat_id' => $chat,
                'text' => $body,
                'parse_mode' => 'HTML',
                'disable_web_page_preview' => true,
            ])->successful();
        } catch (Throwable) {
            return false;
        }
    }
}
