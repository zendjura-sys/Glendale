<?php

namespace App\Services\Bots;

use Illuminate\Support\Str;

/** Перетворює картку бота на повідомлення Telegram (HTML + inline-кнопки) чи Discord (embed + кнопки). */
class BotRender
{
    /**
     * @param  array<string, mixed>  $card
     * @return array<string, mixed> параметри sendMessage / editMessageText
     */
    public static function telegram(array $card): array
    {
        $text = '<b>'.e((string) $card['title']).'</b>';
        $body = [];
        foreach ($card['lines'] ?? [] as $line) {
            $body[] = self::tgMarkup((string) $line);
        }
        foreach ($card['fields'] ?? [] as [$name, $value]) {
            $body[] = '<b>'.e((string) $name).':</b> '.e((string) $value);
        }
        if ($body !== []) {
            $text .= "\n\n".implode("\n", $body);
        }
        if (isset($card['footer'])) {
            $text .= "\n\n<i>".e((string) $card['footer']).'</i>';
        }

        $keyboard = [];
        foreach ($card['buttons'] ?? [] as $row) {
            $keyboard[] = array_map(fn (array $b) => isset($b['url'])
                ? ['text' => (string) $b['label'], 'url' => (string) $b['url']]
                : ['text' => (string) $b['label'], 'callback_data' => substr((string) $b['action'], 0, 64)], $row);
        }

        return [
            'text' => Str::limit($text, 4000),
            'parse_mode' => 'HTML',
            'link_preview_options' => ['is_disabled' => true],
            'reply_markup' => ['inline_keyboard' => $keyboard],
        ];
    }

    /**
     * @param  array<string, mixed>  $card
     * @return array<string, mixed> тіло повідомлення Discord
     */
    public static function discord(array $card): array
    {
        $embed = array_filter([
            'title' => Str::limit((string) $card['title'], 250, ''),
            'description' => ($card['lines'] ?? []) === [] ? null : Str::limit(implode("\n", array_map('strval', $card['lines'])), 4000),
            'color' => BotCards::COLOR,
            'fields' => array_map(fn (array $f) => ['name' => (string) $f[0], 'value' => Str::limit((string) $f[1], 1000) ?: '—', 'inline' => true], $card['fields'] ?? []) ?: null,
            'thumbnail' => isset($card['thumb']) ? ['url' => $card['thumb']] : null,
            'footer' => ['text' => (string) ($card['footer'] ?? 'GameCon')],
            'timestamp' => ($card['timestamp'] ?? null) instanceof \DateTimeInterface ? $card['timestamp']->format(DATE_ATOM) : null,
        ]);

        $styles = ['primary' => 1, 'secondary' => 2, 'success' => 3, 'danger' => 4];
        $rows = [];
        foreach (array_slice($card['buttons'] ?? [], 0, 5) as $row) {
            $rows[] = ['type' => 1, 'components' => array_map(fn (array $b) => isset($b['url'])
                ? ['type' => 2, 'style' => 5, 'label' => Str::limit((string) $b['label'], 80, ''), 'url' => (string) $b['url']]
                : ['type' => 2, 'style' => $styles[$b['style'] ?? 'secondary'] ?? 2, 'label' => Str::limit((string) $b['label'], 80, ''), 'custom_id' => substr((string) $b['action'], 0, 100)], array_slice($row, 0, 5))];
        }

        return ['embeds' => [$embed], 'components' => $rows, 'allowed_mentions' => ['parse' => []]];
    }

    /** **жирний** у рядку картки → <b> для Telegram, решта екранується. */
    private static function tgMarkup(string $line): string
    {
        return (string) preg_replace('/\*\*(.+?)\*\*/u', '<b>$1</b>', e($line));
    }
}
