<?php

namespace App\Services\Cinema;

use App\Support\Settings\SiteSettings;

/**
 * Керування плеєрами з адмінки: порядок вкладок, увімкнення, власні назви й фільтри озвучок.
 * Застосовується під час показу, тож зміни діють одразу для всіх фільмів без повторного імпорту.
 */
class CinemaPlayers
{
    /** Усі відомі провайдери плеєрів. */
    public const PROVIDERS = ['kodik', 'videoseed', 'flixcdn', 'custom'];

    public const DEFAULTS = [
        'order' => self::PROVIDERS,
        'disabled' => [],
        'labels' => [],
        // Озвучки, що містять ці слова, ідуть першими (у вказаному порядку).
        'voice_prefer' => [],
        // Озвучки, що містять ці слова, не показуються.
        'voice_block' => [],
        // Посерійний режим: під плеєром — сезони й серії, кожна відкривається окремо.
        'episodes' => false,
    ];

    public function __construct(private readonly SiteSettings $settings) {}

    /**
     * @return array{order: list<string>, disabled: list<string>, labels: array<string, string>, voice_prefer: list<string>, voice_block: list<string>, episodes: bool}
     */
    public function config(): array
    {
        $saved = $this->settings->get('cinema_players');
        $config = array_replace(self::DEFAULTS, is_array($saved) ? array_intersect_key($saved, self::DEFAULTS) : []);

        // Нові провайдери (оновлення сайту) додаються в кінець збереженого порядку.
        $order = array_values(array_intersect(self::strings($config['order']), self::PROVIDERS));
        foreach (self::PROVIDERS as $provider) {
            if (! in_array($provider, $order, true)) {
                $order[] = $provider;
            }
        }
        $labels = [];
        foreach ((array) $config['labels'] as $key => $label) {
            if (in_array($key, self::PROVIDERS, true) && is_string($label) && trim($label) !== '') {
                $labels[(string) $key] = trim($label);
            }
        }

        return [
            'order' => $order,
            'disabled' => array_values(array_intersect(self::strings($config['disabled']), self::PROVIDERS)),
            'labels' => $labels,
            'voice_prefer' => self::strings($config['voice_prefer']),
            'voice_block' => self::strings($config['voice_block']),
            'episodes' => (bool) $config['episodes'],
        ];
    }

    /**
     * @param  array<string, mixed>  $values
     */
    public function save(array $values): void
    {
        $this->settings->put(['cinema_players' => array_intersect_key(array_replace($this->config(), $values), self::DEFAULTS)]);
    }

    public function enabled(string $provider): bool
    {
        return ! in_array($provider, $this->config()['disabled'], true);
    }

    /**
     * Фільтрує й сортує плеєри фільму. $userRank — уподобання глядача (менше — вище).
     *
     * @param  list<array<string, mixed>>  $players
     * @param  callable(array<string, mixed>): int  $userRank
     * @return list<array<string, mixed>>
     */
    public function apply(array $players, callable $userRank): array
    {
        $config = $this->config();
        $order = array_flip($config['order']);

        $visible = [];
        foreach ($players as $player) {
            $provider = (string) ($player['provider'] ?? '');
            if (in_array($provider, $config['disabled'], true) || $this->blocked((string) ($player['translation'] ?? ''), $config['voice_block'])) {
                continue;
            }
            if (isset($config['labels'][$provider])) {
                $player['provider_label'] = $config['labels'][$provider];
            }
            $visible[] = $player;
        }

        usort($visible, fn (array $a, array $b) => [
            $userRank($a),
            $order[$a['provider']] ?? 99,
            $this->voiceRank((string) ($a['translation'] ?? ''), $config['voice_prefer']),
        ] <=> [
            $userRank($b),
            $order[$b['provider']] ?? 99,
            $this->voiceRank((string) ($b['translation'] ?? ''), $config['voice_prefer']),
        ]);

        return $visible;
    }

    /**
     * @param  list<string>  $words
     */
    private function blocked(string $translation, array $words): bool
    {
        $text = mb_strtolower($translation);
        foreach ($words as $word) {
            if ($text !== '' && str_contains($text, mb_strtolower($word))) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<string>  $words
     */
    private function voiceRank(string $translation, array $words): int
    {
        $text = mb_strtolower($translation);
        foreach ($words as $i => $word) {
            if ($text !== '' && str_contains($text, mb_strtolower($word))) {
                return $i;
            }
        }

        return count($words);
    }

    /**
     * @return list<string>
     */
    private static function strings(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }
        $out = [];
        foreach ($value as $item) {
            if (is_string($item) && trim($item) !== '') {
                $out[] = trim($item);
            }
        }

        return array_values(array_unique($out));
    }
}
