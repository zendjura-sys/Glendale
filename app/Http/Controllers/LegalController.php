<?php

namespace App\Http\Controllers;

use App\Services\Billing\Shop;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\View;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Юридичні документи: Terms of Service, Privacy Policy, Refund & Cancellation Policy, контакти, а також публічна сторінка цін.
 *
 * Мова документа: ?lang= → мова сесії / інтерфейсу (App::getLocale()) → українська (майстер-версія).
 * Шаблон: resources/views/legal/{document}/{locale}.blade.php, якщо перекладу немає — майстер (uk).
 * Документи складено за законодавством України: публічна оферта (ЦК ст. 633, 641, 642), ЗУ «Про електронну
 * комерцію», «Про захист прав споживачів», «Про цифровий контент та цифрові послуги», «Про захист персональних даних».
 * Сторінки відкриті без входу: їх читають гості й платіжні сервіси під час перевірки сайту.
 */
class LegalController extends Controller
{
    public function terms(Request $request): Response
    {
        return $this->document($request, 'terms');
    }

    public function privacy(Request $request): Response
    {
        return $this->document($request, 'privacy');
    }

    public function refund(Request $request): Response
    {
        return $this->document($request, 'refund');
    }

    /** Контакти для зв’язку з клієнтами (окремий розділ — вимога еквайрингу monobank). */
    public function contacts(Request $request): Response
    {
        return $this->document($request, 'contacts');
    }

    /** Публічні тарифи GameCon+ (для гостей і перевірки платіжними сервісами). */
    public function pricing(Request $request): Response
    {
        $locale = $this->locale($request, null);

        return Inertia::render('legal/pricing', [
            ...$this->chrome($locale),
            // Динамічно: лише товари в продажу (каталог config/plus.php мінус зняті в Адмінка → Білінг).
            'products' => collect(Shop::catalog())->filter(fn (array $p) => $p['available'])
                ->map(fn (array $p, string $key) => ['key' => $key, ...$p])->values(),
            'reactions' => count((array) config('plus.reactions')),
            'limits' => config('plus.limits'),
        ]);
    }

    private function document(Request $request, string $document): Response
    {
        $master = (string) config('legal.master');
        $locale = $this->locale($request, $document);
        $view = View::exists("legal.{$document}.{$locale}") ? "legal.{$document}.{$locale}" : "legal.{$document}.{$master}";
        $actual = $view === "legal.{$document}.{$master}" ? $master : $locale;
        $legal = $this->details();

        return Inertia::render('legal/show', [
            ...$this->chrome($actual),
            'document' => $document,
            'title' => __('ui.'.$document, [], $actual),
            'html' => View::file(View::getFinder()->find($view), ['legal' => $legal])->render(),
            'is_master' => $actual === $master,
            'master' => $master,
            'translations' => $this->translations($document),
            'updated' => $legal['updated'],
        ]);
    }

    /**
     * ?lang= має пріоритет; далі — мова інтерфейсу (сесія / cookie / профіль через SetLocale); інакше — українська.
     */
    private function locale(Request $request, ?string $document): string
    {
        $wanted = strtolower((string) $request->query('lang', ''));
        $candidates = array_filter([$wanted, strtolower(substr((string) session('locale', App::getLocale()), 0, 2)), (string) config('legal.master')]);
        foreach ($candidates as $locale) {
            if (! preg_match('/^[a-z]{2,3}$/', $locale)) {
                continue;
            }
            if ($document === null || View::exists("legal.{$document}.{$locale}")) {
                return $locale;
            }
        }

        return (string) config('legal.master');
    }

    /**
     * Мови, для яких є переклад документа (з файлів, не з конфігу — відкрита архітектура).
     *
     * @return list<array{code: string, name: string}>
     */
    private function translations(string $document): array
    {
        $files = glob(resource_path("views/legal/{$document}/*.blade.php")) ?: [];
        $codes = array_map(fn (string $file) => basename($file, '.blade.php'), $files);
        $order = array_flip((array) config('legal.languages'));
        usort($codes, fn (string $a, string $b) => [$order[$a] ?? 99, $a] <=> [$order[$b] ?? 99, $b]);
        $names = (array) config('legal.names');

        return array_map(fn (string $code) => ['code' => $code, 'name' => (string) ($names[$code] ?? strtoupper($code))], $codes);
    }

    /**
     * Перекладені підписи шапки й футера для мови документа.
     *
     * @return array<string, mixed>
     */
    private function chrome(string $locale): array
    {
        $t = fn (string $key) => __('ui.'.$key, [], $locale);

        return [
            'locale' => $locale,
            'labels' => [
                'terms' => $t('terms'),
                'privacy' => $t('privacy'),
                'refund' => $t('refund'),
                'pricing' => $t('pricing'),
                'contacts' => $t('contacts'),
                'view_original' => $t('view_original'),
                'prevail' => $t('prevail'),
                // Застереження мовою майстер-версії (українською) — показується завжди.
                'prevail_en' => __('ui.prevail', [], (string) config('legal.master')),
                'last_updated' => $t('last_updated'),
                'language' => $t('language'),
                'rights' => $t('all_rights_reserved'),
            ],
        ];
    }

    /**
     * @return array{operator: string, email: string, address: string|null, tax_id: string|null, registry: string|null, phone: string|null, tax_status: string|null, country: string, updated: string, site: string, name: string}
     */
    private function details(): array
    {
        $optional = fn (string $key) => ($value = $this->value($key)) !== '' ? $value : null;

        return [
            'operator' => $this->value('operator'),
            'email' => $this->value('email'),
            'address' => $optional('address'),
            'tax_id' => $optional('tax_id'),
            'registry' => $optional('registry'),
            'phone' => $optional('phone'),
            'tax_status' => $optional('tax_status'),
            'country' => $this->value('country'),
            'updated' => $this->value('updated'),
            'site' => rtrim((string) config('app.url'), '/'),
            'name' => (string) config('app.name'),
        ];
    }

    /** Реквізит з адмінки (Налаштування → Юридичні дані), інакше — з config/legal.php (.env LEGAL_*). */
    private function value(string $key): string
    {
        $value = app(SiteSettings::class)->get('legal_'.$key);

        return is_string($value) && trim($value) !== '' ? trim($value) : (string) config('legal.'.$key);
    }
}
