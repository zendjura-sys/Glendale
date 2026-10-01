<?php

namespace App\Services\Servers;

use App\Models\GtaServer;

/**
 * Базовий список українських GTA RP проєктів. Решту каталог знаходить сам або додають вручну.
 */
class ServerCatalog
{
    public const SERVERS = [
        ['quant-rp', 'Quant RP', 'pc', 'ragemp', 'Найбільший український RAGE:MP сервер — «Ми разом!»', 'https://quant5.com.ua', null, 'quant-s1.com.ua:22005', true],
        ['ukraine-gta-5', 'UKRAINE GTA 5', 'pc', 'ragemp', 'Українська карта, голосовий чат і живі міста', 'https://ugta5.com', 'ukraine-gta-5', '57.128.211.33:22005', true],
        ['stake-rp', 'Stake RP', 'pc', 'ragemp', 'Український RolePlay з власною економікою', 'https://stake-rp.com', 'stakegta5', 's1.stake-rp.com:22005', false],
        ['nexus-rp', 'Nexus RP', 'pc', 'ragemp', 'Український RP-проєкт на RAGE:MP', 'https://nexus-rp.net', null, 'ua1.nexus-rp.net:22006', false],
        ['unreal-rp', 'Unreal RP', 'pc', 'ragemp', 'Голосовий RolePlay українською', 'https://unrealrp.com.ua', null, 'start.unrealrp.com.ua:22005', false],
        ['upload-rp', 'Upload RP', 'pc', 'ragemp', 'Кілька міст і власні системи бізнесів', 'https://uploadrp-gta5.com', null, 'play.uploadrp-gta5.com:22005', false],
        ['liberty-rp', 'Liberty RP', 'pc', 'ragemp', 'Український RolePlay-сервер', 'https://liberty-rp.com.ua', null, 'main.liberty-rp.com.ua:22005', false],
        ['olymp-rp', 'Olymp RP', 'pc', 'own', 'Власний мультиплеєр — мод написаний з нуля', 'https://olymp-rp.com', null, null, false],
        ['gta5urp', 'GTA5URP', 'pc', 'ragemp', 'Український RolePlay-проєкт', 'https://gta5urp.com', null, null, false],
        ['uny-rp', 'UNY RP', 'pc', 'other', 'GTA 5 RP на мапі Liberty City з GTA IV', 'https://unyrp.com', null, null, false],
        ['union-roleplay', 'Union RolePlay', 'pc', 'fivem', 'Український FiveM-сервер', 'https://uninonroleplay.com', null, null, false],
        ['mriya-rp', 'Мрія РП', 'mobile', 'launcher', 'Мобільна GTA з мапою України: Київ, Львів, Одеса, Харків', 'https://mriya-rp.com', null, null, true],
        ['gta-ukraine-mobile', 'GTA Ukraine Mobile', 'mobile', 'launcher', 'Українські міста на Android', 'https://ukraine-mobile.com.ua', null, null, false],
        ['uarp-mobile', 'UARP Mobile', 'mobile', 'launcher', 'Мобільний RolePlay українською', 'https://uarp.mobi', null, null, false],
        ['samp-ukraine', 'SAMP Ukraine', 'mobile', 'samp', 'Класичний SA-MP RolePlay для ПК та Android', 'https://samp-ukraine.com', null, null, false],
        ['ua-online', 'UA Online', 'mobile', 'launcher', 'Мобільний онлайн-RP по-українськи', 'https://ua-online.games', null, null, false],
    ];

    /**
     * Додає відсутні сервери базового списку. Повертає створені.
     *
     * @return list<GtaServer>
     */
    public function import(): array
    {
        $created = [];
        foreach (self::SERVERS as $i => [$slug, $name, $platform, $mp, $tagline, $website, $discord, $connect, $featured]) {
            if (GtaServer::withTrashed()->where('slug', $slug)->exists()) {
                continue;
            }
            $created[] = GtaServer::query()->create([
                'slug' => $slug,
                'name' => $name,
                'platform' => $platform,
                'multiplayer' => $mp,
                'tagline' => $tagline,
                'website' => $website,
                'discord_invite' => $discord,
                'connect' => $connect,
                'status' => GtaServer::STATUS_PUBLISHED,
                'origin' => 'seed',
                'is_featured' => $featured,
                'position' => $i,
            ]);
        }

        return $created;
    }
}
