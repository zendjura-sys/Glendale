<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Geo\GeoIp;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Locale;

/**
 * Адмінка → Країни: заборона відвідувань сайту й застосунку з вибраних країн.
 */
class GeoController extends Controller
{
    /** ISO 3166-1 alpha-2. */
    public const COUNTRIES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW';

    public function __construct(private readonly SiteSettings $settings, private readonly GeoIp $geo) {}

    /**
     * @return list<string>
     */
    public static function codes(): array
    {
        return explode(' ', self::COUNTRIES);
    }

    public function index(Request $request): Response
    {
        $countries = [];
        foreach (self::codes() as $code) {
            $name = Locale::getDisplayRegion('-'.$code, app()->getLocale());
            $countries[] = ['code' => $code, 'name' => is_string($name) && $name !== '' ? $name : $code];
        }
        usort($countries, fn (array $a, array $b) => strcmp($a['name'], $b['name']));
        $blocked = $this->settings->get('geo_blocked');

        return Inertia::render('admin/geo', [
            'countries' => $countries,
            'blocked' => is_array($blocked) ? array_values($blocked) : [],
            'trust_cloudflare' => $this->settings->get('geo_trust_cloudflare') === true,
            'database' => $this->geo->status(),
            'maxmind' => [
                'account_id' => $this->settings->get('maxmind_account_id'),
                'has_key' => $this->settings->secret('maxmind_license_key') !== null,
            ],
            'me' => ['ip' => $request->ip(), 'country' => $this->geo->country((string) $request->ip())],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'blocked' => ['present', 'array', 'max:250'],
            'blocked.*' => ['string', Rule::in(self::codes())],
            'trust_cloudflare' => ['required', 'boolean'],
        ]);
        $blocked = array_values(array_unique(array_map('strval', $data['blocked'])));
        if ($blocked !== [] && ! $this->geo->available() && ! $data['trust_cloudflare']) {
            return back()->withErrors(['blocked' => 'Спершу завантажте базу «IP → країна» (кнопка «Оновити базу»).']);
        }
        $this->settings->put(['geo_blocked' => $blocked, 'geo_trust_cloudflare' => (bool) $data['trust_cloudflare']]);
        Inertia::flash('toast', ['type' => 'success', 'message' => $blocked === [] ? 'Сайт відкритий для всіх країн.' : 'Заблоковано країн: '.count($blocked).'.']);

        return back();
    }

    /** Ключ MaxMind (необов’язково): без нього база — DB-IP Lite. */
    public function maxmind(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'account_id' => ['nullable', 'string', 'regex:/^\d{3,12}$/'],
            'license_key' => ['nullable', 'string', 'regex:/^[A-Za-z0-9_]{16,64}$/'],
            'clear' => ['nullable', 'boolean'],
        ]);
        if ($request->boolean('clear')) {
            $this->settings->put(['maxmind_account_id' => null]);
            $this->settings->putSecret('maxmind_license_key', null);
        } else {
            $this->settings->put(['maxmind_account_id' => $data['account_id'] ?? null]);
            if (filled($data['license_key'] ?? null)) {
                $this->settings->putSecret('maxmind_license_key', (string) $data['license_key']);
            }
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування MaxMind збережено.']);

        return back();
    }

    public function refresh(): RedirectResponse
    {
        $ok = $this->geo->update();
        Inertia::flash('toast', $ok
            ? ['type' => 'success', 'message' => 'Базу «IP → країна» оновлено.']
            : ['type' => 'error', 'message' => 'Не вдалося завантажити базу. Перевірте мережу сервера або ключ MaxMind.']);

        return back();
    }
}
