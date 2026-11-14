<?php

namespace App\Http\Controllers\Developer;

use App\Http\Controllers\Controller;
use App\Support\I18n\Locales;
use App\Support\I18n\Translations;
use chillerlan\QRCode\Output\QROutputInterface;
use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;

/**
 * GameCon Overlay SDK для Web/CEF: сам скрипт (зі словником мови), прозора сторінка /embed/overlay
 * для рушіїв, що вміють лише URL (CEF у GTA RP, Overwolf, WebView), і QR для входу за кодом.
 */
class SdkAssetsController extends Controller
{
    public function __construct(private readonly Locales $locales, private readonly Translations $translations) {}

    /** /sdk/v1/gamecon-sdk.js?lang=en — бандл + лише ті переклади, що потрібні SDK. */
    public function script(Request $request): Response
    {
        $path = resource_path('sdk/gamecon-sdk.js');
        $lang = (string) $request->query('lang', 'uk');
        // Будь-яка додана мова (й вимкнена на сайті) — мову SDK обирає розробник гри.
        $lang = in_array($lang, $this->locales->all(), true) ? $lang : 'uk';
        $js = Cache::remember('sdk_js:'.$lang.':'.filemtime($path), 3600, function () use ($path, $lang) {
            $source = (string) file_get_contents($path);
            $dict = [];
            if ($lang !== 'uk') {
                $all = $this->translations->scoped($lang, 'web');
                foreach ($this->keys() as $key) {
                    if (isset($all[$key])) {
                        $dict[$key] = $all[$key];
                    }
                }
            }

            return 'globalThis.__GC_SDK_I18N__='.json_encode((object) $dict, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG).";\n"
                .str_replace('https://gamecon.online', rtrim(url('/'), '/'), $source);
        });

        return response($js, 200, [
            'Content-Type' => 'application/javascript; charset=utf-8',
            'Cache-Control' => 'public, max-age=3600',
            'Access-Control-Allow-Origin' => '*',
        ]);
    }

    /** Рядки tr('…') із вихідника SDK. @return list<string> */
    private function keys(): array
    {
        preg_match_all("/\\btr\\(\\s*'((?:[^'\\\\]|\\\\.)*)'/u", (string) file_get_contents(resource_path('js/sdk/gamecon-sdk.ts')), $m);
        preg_match_all("/^\\s*\\w+: '([^']+)',$/mu", (string) file_get_contents(resource_path('js/sdk/gamecon-sdk.ts')), $labels);

        return array_values(array_unique([...array_map('stripslashes', $m[1]), ...$labels[1]]));
    }

    /**
     * /embed/overlay?client_id=…&modules=hud,party&side=left — прозора сторінка лише з віджетами.
     * Керування з гри: window.postMessage({ target: 'gamecon-sdk', cmd: 'toggle' }, '*').
     */
    public function overlay(Request $request): Response
    {
        $opts = [
            'clientId' => (string) $request->query('client_id', ''),
            'demo' => $request->boolean('demo'),
        ];
        foreach (['side', 'theme', 'toasts', 'redirect_uri' => 'redirectUri', 'token'] as $from => $to) {
            $from = is_int($from) ? $to : $from;
            if (is_string($request->query($from)) && $request->query($from) !== '') {
                $opts[$to] = mb_substr((string) $request->query($from), 0, 500);
            }
        }
        if (is_string($request->query('modules'))) {
            $opts['modules'] = array_values(array_intersect(['hud', 'party', 'chat', 'family', 'drop'], explode(',', (string) $request->query('modules'))));
        }
        if ($request->query('blur') === '0') {
            $opts['blur'] = false;
        }

        return response()->view('sdk.overlay', ['opts' => $opts, 'lang' => app()->getLocale()])
            // Сторінку вбудовують в ігри й лаунчери — дозволяємо фрейм будь-де.
            ->header('Content-Security-Policy', 'frame-ancestors *');
    }

    /** QR для коду входу з гри: веде на /link?code=… (телефон із застосунком GameCon чи браузером). */
    public function qr(Request $request): Response
    {
        $code = strtoupper((string) $request->query('code', ''));
        abort_unless(preg_match('/^[A-Z]{4}-?[A-Z]{4}$/', $code) === 1, 404);
        $svg = (new QRCode(new QROptions([
            'outputType' => QROutputInterface::MARKUP_SVG,
            'outputBase64' => false,
            'quietzoneSize' => 1,
            'scale' => 6,
        ])))->render(url('/link?code='.$code));

        return response($svg, 200, ['Content-Type' => 'image/svg+xml', 'Cache-Control' => 'public, max-age=600', 'Access-Control-Allow-Origin' => '*']);
    }
}
