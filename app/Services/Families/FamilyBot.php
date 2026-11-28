<?php

namespace App\Services\Families;

use App\Models\Family;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * Надсилання повідомлень сім’ї в Discord (webhook) і Telegram (бот).
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

    /**
     * Картинка з підписом (підсумки сезону тощо): Discord — файл у вебхук, Telegram — sendPhoto.
     *
     * @return array<string, bool>
     */
    public function sendImage(Family $family, string $png, string $filename, string $text, ?string $title = null): array
    {
        $result = [];
        if ($url = $family->webhook('discord')) {
            try {
                $result['discord'] = Http::timeout(20)->attach('files[0]', $png, $filename, ['Content-Type' => 'image/png'])
                    ->post($url, ['payload_json' => json_encode([
                        'username' => Str::limit("[{$family->tag}] {$family->name}", 80, ''),
                        'embeds' => [[
                            'title' => $title ? Str::limit($title, 250, '') : null,
                            'description' => Str::limit($text, 4000),
                            'color' => 0xFBBF24,
                            'image' => ['url' => 'attachment://'.$filename],
                            'footer' => ['text' => 'GameCon · сім’ї GTA RP'],
                        ]],
                        'attachments' => [['id' => 0, 'filename' => $filename]],
                    ], JSON_UNESCAPED_UNICODE)])->successful();
            } catch (Throwable) {
                $result['discord'] = false;
            }
        }
        if (($token = $family->webhook('telegram_token')) && ($chat = $family->webhook('telegram_chat'))) {
            try {
                $result['telegram'] = Http::timeout(20)->attach('photo', $png, $filename)
                    ->post("https://api.telegram.org/bot{$token}/sendPhoto", [
                        'chat_id' => $chat,
                        'caption' => Str::limit(($title ? $title."\n\n" : '').$text, 1000),
                    ])->successful();
            } catch (Throwable) {
                $result['telegram'] = false;
            }
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
