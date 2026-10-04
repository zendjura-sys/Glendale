<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\I18n\Locales;
use App\Support\I18n\Translations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * Вибір мови й словники для сайту та застосунку.
 */
class LocaleController extends Controller
{
    public function __construct(private readonly Locales $locales, private readonly Translations $translations) {}

    /** Ручний вибір мови: у профілі (для входу з інших пристроїв) і в cookie. */
    public function update(Request $request): RedirectResponse|JsonResponse
    {
        $data = $request->validate(['locale' => ['required', 'string', Rule::in($this->locales->enabled())]]);
        $locale = (string) $data['locale'];
        $user = $request->user();
        if ($user instanceof User) {
            $user->forceFill(['locale' => $locale])->save();
        }
        $cookie = cookie(Locales::COOKIE, $locale, 60 * 24 * 365, httpOnly: false);

        return $request->expectsJson() && ! $request->header('X-Inertia')
            ? response()->json(['locale' => $locale])->withCookie($cookie)
            : back()->withCookie($cookie);
    }

    /**
     * Словник сайту як скрипт: підключається до модулів, тож tr() працює вже в константах.
     * Адреса містить версію — кешується браузером надовго.
     */
    public function script(string $locale): Response
    {
        abort_unless($this->locales->isEnabled($locale), 404);
        $payload = json_encode(['locale' => $locale, 'dict' => (object) $this->translations->scoped($locale, 'web')], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG);

        return response('window.__I18N__='.$payload.';', 200, [
            'Content-Type' => 'application/javascript; charset=utf-8',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }

    /** Словник застосунку: мови, вибрана мова й переклади його рядків. */
    public function app(Request $request): JsonResponse
    {
        $locale = app()->getLocale();

        return response()->json([
            'locale' => $locale,
            'locales' => $this->locales->options(),
            'version' => $this->translations->version($locale),
            'dict' => (object) $this->translations->scoped($locale, 'app'),
        ]);
    }
}
