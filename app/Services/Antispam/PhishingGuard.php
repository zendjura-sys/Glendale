<?php

namespace App\Services\Antispam;

use App\Support\Plugins\Plugins;

/**
 * Перевірка посилань на фішинг: підробки Steam, Discord, Epic Games та інших сервісів
 * (схожі написання, літери з іншої абетки, «подарункові» домени) і посилання прямо на IP-адресу.
 * Справжні домени й піддомени сервісів пропускаємо, свій сайт — теж.
 */
class PhishingGuard
{
    /** Справжні домени, які найчастіше підробляють. */
    public const BRANDS = [
        'steamcommunity.com' => 'Steam', 'steampowered.com' => 'Steam', 'steam.com' => 'Steam',
        'discord.com' => 'Discord', 'discord.gg' => 'Discord', 'discordapp.com' => 'Discord', 'discord.gift' => 'Discord',
        'epicgames.com' => 'Epic Games', 'battle.net' => 'Battle.net', 'blizzard.com' => 'Blizzard',
        'riotgames.com' => 'Riot Games', 'roblox.com' => 'Roblox', 'faceit.com' => 'FACEIT',
        'rockstargames.com' => 'Rockstar Games', 'twitch.tv' => 'Twitch', 'telegram.org' => 'Telegram',
        'paypal.com' => 'PayPal', 'google.com' => 'Google', 'gamecon.online' => 'GameCon',
    ];

    /** Слова-приманки в доменах підробок («безкоштовне Nitro», «обмін скінами»). */
    private const LURES = ['gift', 'gifts', 'nitro', 'free', 'promo', 'drop', 'drops', 'giveaway', 'trade', 'trades', 'skin', 'skins', 'airdrop', 'login', 'verify', 'auth', 'secure', 'bonus', 'reward'];

    /** Літери інших абеток, схожі на латинські (кирилиця, грецька). */
    private const CONFUSABLES = [
        'а' => 'a', 'е' => 'e', 'о' => 'o', 'р' => 'p', 'с' => 'c', 'у' => 'y', 'х' => 'x', 'і' => 'i', 'ї' => 'i',
        'ј' => 'j', 'ԁ' => 'd', 'ѕ' => 's', 'һ' => 'h', 'ӏ' => 'l', 'к' => 'k', 'м' => 'm', 'т' => 't', 'в' => 'b', 'н' => 'h',
        'α' => 'a', 'ο' => 'o', 'ρ' => 'p', 'ε' => 'e', 'ι' => 'i', 'κ' => 'k', 'ν' => 'v', 'τ' => 't', 'υ' => 'u',
    ];

    /**
     * Перше підозріле посилання в тексті: ['host' => …, 'brand' => назва сервісу чи null] або null.
     *
     * @return array{host: string, brand: string|null}|null
     */
    public function suspicious(string $text): ?array
    {
        if (! app(Plugins::class)->on('phishing_guard')) {
            return null;
        }
        if (preg_match('~https?://((?:\d{1,3}\.){3}\d{1,3})(?=[/:?#\s]|$)~i', $text, $ip) === 1) {
            return ['host' => $ip[1], 'brand' => null];
        }
        foreach (LinkFilter::hosts($text) as $host) {
            if (($brand = $this->imitates($host)) !== null) {
                return ['host' => $host, 'brand' => $brand];
            }
        }

        return null;
    }

    /** Назва сервісу, який підробляє домен, або null (справжній домен чи звичайний сайт). */
    public function imitates(string $host): ?string
    {
        $host = mb_strtolower($host);
        if (str_contains($host, 'xn--') && function_exists('idn_to_utf8')) {
            $host = (string) (idn_to_utf8($host, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46) ?: $host);
        }
        foreach (array_keys(self::BRANDS) as $real) {
            if ($host === $real || str_ends_with($host, '.'.$real)) {
                return null;
            }
        }
        $ascii = strtr($host, self::CONFUSABLES);
        $mixed = $ascii !== $host;
        $label = self::label($ascii);
        $plain = self::normalize($label);
        foreach (self::BRANDS as $real => $name) {
            $brand = self::label($real);
            // Літери іншої абетки, що дають справжній домен: «stеamcommunity.com» з кириличною «е».
            if ($mixed && ($ascii === $real || str_ends_with($ascii, '.'.$real))) {
                return $name;
            }
            $target = self::normalize($brand);
            if (strlen($target) >= 5 && ($plain === $target || (strlen($target) >= 6 && levenshtein($plain, $target) === 1))) {
                return $name;
            }
            // Назва сервісу разом із приманкою: steam-trade-offer.com, discord-nitro.xyz.
            if (strlen($brand) >= 5 && str_contains($plain, $target)) {
                foreach (self::LURES as $lure) {
                    if (str_contains($label, $lure)) {
                        return $name;
                    }
                }
            }
        }

        return null;
    }

    /** Головна частина домену без зони: steamcommunity.com → steamcommunity, a.b.discord.gg → discord. */
    private static function label(string $host): string
    {
        $parts = explode('.', $host);

        return count($parts) >= 2 ? $parts[count($parts) - 2] : $host;
    }

    /** Звести схожі написання до одного вигляду: 0→o, 1/l/i→l, rn→m, cl→d, vv→w, без дефісів. */
    private static function normalize(string $label): string
    {
        $label = strtr($label, ['0' => 'o', '1' => 'l', 'i' => 'l', '3' => 'e', '5' => 's', '-' => '', '_' => '']);

        return str_replace(['rn', 'cl', 'vv'], ['m', 'd', 'w'], $label);
    }
}
