<?php

namespace App\Services\Alerts;

/**
 * Каталог відкритих Telegram-каналів моніторингу (публічні сторінки t.me/s/…).
 * Група задає вагу довіри: зведення з офіційних підтверджує ціль найсильніше,
 * агрегатори лише додають упевненості збігом з іншими.
 */
final class AlertSources
{
    /** Вага довіри групи (сума ваг різних джерел → упевненість мітки). */
    public const WEIGHTS = ['official' => 3, 'intel' => 2, 'regional' => 2, 'aggregators' => 1, 'custom' => 1];

    public const GROUPS = [
        'official' => [
            'title' => 'Офіційні',
            'about' => 'Повітряні Сили ЗСУ та офіційна стрічка сигналів тривоги. Найвища вага довіри.',
        ],
        'intel' => [
            'title' => 'Розвідувальні',
            'about' => 'Канали зі зведеною картиною повітряної обстановки по всій країні.',
        ],
        'regional' => [
            'title' => 'Регіональні спостерігачі',
            'about' => 'Один регіон, люди на місці: дають конкретику «звідки і куди».',
        ],
        'aggregators' => [
            'title' => 'Загальнонаціональні агрегатори',
            'about' => 'Зводять повідомлення з усієї країни. Швидкі, але це переказ — додають упевненості лише збігом з іншими.',
        ],
        'custom' => [
            'title' => 'Додані адміністратором',
            'about' => 'Канали з налаштувань інтеграції.',
        ],
    ];

    /**
     * Канал → [група, області (slug) або null — уся Україна].
     *
     * @var array<string, array{0: string, 1: list<string>|null}>
     */
    public const CHANNELS = [
        'kpszsu' => ['official', null],
        'UkraineAlarmSignal' => ['official', null],
        'rozvidkaneba' => ['intel', null],
        'Ukrainian_Intelligence' => ['intel', null],
        // Регіональні.
        'zahidnimonitoring' => ['regional', ['volyn', 'lviv', 'rivne']],
        'vin_info_ppo' => ['regional', ['vinnytsia']],
        'dnepr_nagladach' => ['regional', ['dnipropetrovsk']],
        'dnipro_alerts' => ['regional', ['dnipropetrovsk']],
        'nikalert' => ['regional', ['dnipropetrovsk']],
        'Radar_Dnipra' => ['regional', ['dnipropetrovsk']],
        'shovnebi' => ['regional', ['dnipropetrovsk']],
        'kramatorsk_radar' => ['regional', ['donetsk']],
        'operatyvnyi_donbas' => ['regional', ['donetsk']],
        'korostentoday' => ['regional', ['zhytomyr']],
        'eyes_everywhere_ua' => ['regional', ['zaporizhzhia']],
        'gnilayachereha' => ['regional', ['zaporizhzhia']],
        'info_zp' => ['regional', ['zaporizhzhia']],
        'operatyvnohlep' => ['regional', ['zaporizhzhia']],
        'kievinform_ua1' => ['regional', ['kyiv-oblast']],
        'kyiv_nebo' => ['regional', ['kyiv-oblast']],
        'kyiv_airdef' => ['regional', ['kyiv', 'kyiv-oblast']],
        'monitoring_kyiv' => ['regional', ['kyiv', 'kyiv-oblast']],
        'shahedradar' => ['regional', ['kyiv', 'kyiv-oblast']],
        'krop_vanek' => ['regional', ['kirovohrad']],
        'raketnanebespeka' => ['regional', ['lviv']],
        'pivden_FPV' => ['regional', ['mykolaiv', 'kherson']],
        'korabely_media' => ['regional', ['mykolaiv']],
        'Shturval_media' => ['regional', ['odesa', 'mykolaiv']],
        'delta_odesa' => ['regional', ['odesa']],
        'odessa_inform' => ['regional', ['odesa']],
        'odessa_knight' => ['regional', ['odesa']],
        'odessaveter' => ['regional', ['odesa']],
        'ReniHub' => ['regional', ['odesa']],
        'temporis_odesa' => ['regional', ['odesa']],
        'kremen_sv' => ['regional', ['poltava']],
        'PoltavaRadar' => ['regional', ['poltava']],
        'PoltavaRanger' => ['regional', ['poltava']],
        'ppopoltavanightfighters' => ['regional', ['poltava']],
        'pivden_varta' => ['regional', ['odesa', 'mykolaiv', 'kherson', 'zaporizhzhia']],
        'inforomen' => ['regional', ['sumy']],
        'krolevetsnews' => ['regional', ['sumy']],
        'monitoring_shostka' => ['regional', ['sumy']],
        'rdsprostir' => ['regional', ['sumy']],
        'sigshostka' => ['regional', ['sumy']],
        'sumygo' => ['regional', ['sumy']],
        'svessainfo' => ['regional', ['sumy']],
        'fainemisto_tv' => ['regional', ['ternopil']],
        'cxidua' => ['regional', ['kharkiv']],
        'Karkivw' => ['regional', ['kharkiv']],
        'kharkivlife' => ['regional', ['kharkiv']],
        'kharkov_media' => ['regional', ['kharkiv']],
        'kuptg' => ['regional', ['kharkiv']],
        'monitor1654' => ['regional', ['kharkiv']],
        'place_kharkiv' => ['regional', ['kharkiv']],
        'tlknewsua' => ['regional', ['kharkiv']],
        'kherson_monitoring' => ['regional', ['kherson']],
        'kherson_non_drone' => ['regional', ['kherson']],
        'cherkasy_nebbo' => ['regional', ['cherkasy']],
        'horizon_of_war_Official' => ['regional', ['chernihiv']],
        'my_safety_Chernigiv' => ['regional', ['chernihiv']],
        'PhantomChe' => ['regional', ['chernihiv']],
        'RadarChernihiv' => ['regional', ['chernihiv']],
        'ShahedChernihiv' => ['regional', ['chernihiv']],
        'taktychna_rukavuchkaa' => ['regional', ['chernihiv']],
        'monitoring_zaxid' => ['regional', ['volyn', 'lviv', 'rivne', 'ternopil', 'ivano-frankivsk', 'zakarpattia', 'chernivtsi', 'khmelnytskyi']],
        'rocket_danger_lviv' => ['regional', ['lviv']],
        // Загальнонаціональні агрегатори.
        'eRadarrua' => ['aggregators', null],
        'kudy_letyt' => ['aggregators', null],
        'monikppy' => ['aggregators', null],
        'monitor_ukr' => ['aggregators', null],
        'newspn' => ['aggregators', null],
        'povitryanatrivogaaa' => ['aggregators', null],
        'radar_raketaa' => ['aggregators', null],
        'radar_top_ua' => ['aggregators', null],
        'raketa_trevoga' => ['aggregators', null],
        'rlsukr' => ['aggregators', null],
        'sectorv666' => ['aggregators', null],
        'totallzrada' => ['aggregators', null],
        'tryvoga_chomu' => ['aggregators', null],
        'ua_radar_raket' => ['aggregators', null],
        'UkraineRadar_24_7' => ['aggregators', null],
        'vanek_nikolaev' => ['aggregators', null],
        'veselyy_pivden' => ['aggregators', null],
        'vibuxaviasia' => ['aggregators', null],
        'war_monitor' => ['aggregators', null],
    ];

    /** Група каналу (без урахування регістру); невідомий — «custom». */
    public static function group(string $channel): string
    {
        foreach (self::CHANNELS as $name => [$group]) {
            if (strcasecmp($name, $channel) === 0) {
                return $group;
            }
        }

        return 'custom';
    }

    public static function weight(string $channel): int
    {
        return self::WEIGHTS[self::group($channel)];
    }

    /**
     * Упевненість мітки 0–100 за різними джерелами: офіційне саме по собі — 75,
     * регіональне — 50, агрегатор — 25; збіг кількох — більше.
     *
     * @param  list<string>  $channels
     */
    public static function confidence(array $channels): int
    {
        $sum = 0;
        foreach (array_unique(array_map('mb_strtolower', $channels)) as $channel) {
            $sum += self::weight($channel);
        }

        return min(100, $sum * 25);
    }
}
