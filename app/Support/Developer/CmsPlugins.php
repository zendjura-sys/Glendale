<?php

namespace App\Support\Developer;

use Illuminate\Support\Facades\File;
use RuntimeException;
use ZipArchive;

/**
 * Плагіни й дополнення «Увійти через GameCon» для CMS і форумів (resources/cms-plugins).
 * Порядок — за популярністю рушіїв. Архів збираємо з вихідників на льоту й кешуємо до зміни файлів;
 * спільний клієнт OAuth (_shared/GameConClient.php) кладемо в потрібну теку кожного пакета.
 */
class CmsPlugins
{
    public const VERSION = '1.0.0';

    /**
     * @return array<string, array<string, mixed>>
     */
    public static function all(): array
    {
        return [
            'wordpress' => [
                'logo' => '/images/cms/wordpress.svg',
                'name' => 'WordPress', 'kind' => 'cms', 'color' => '#21759b', 'mark' => 'W',
                'versions' => 'WordPress 6.0+', 'stack' => 'PHP 7.4+', 'package' => 'Плагін',
                'root' => 'wordpress', 'shared' => 'gamecon-login/lib/GameConClient.php',
                'redirect' => '/?gamecon=callback',
                'steps' => [
                    'Плагіни → Додати новий → Завантажити плагін → оберіть архів → Активувати.',
                    'Налаштування → GameCon: вставте Client ID і Client Secret.',
                    'Кнопка з’явиться на сторінці входу; шорткоди [gamecon_login] і [gamecon_profile].',
                ],
                'features' => ['Кнопка на сторінці входу', 'Шорткод кнопки й картки профілю', 'Аватар із GameCon', 'Зв’язок із наявними акаунтами за підтвердженою поштою'],
            ],
            'joomla' => [
                'logo' => '/images/cms/joomla.svg',
                'name' => 'Joomla', 'kind' => 'cms', 'color' => '#f44321', 'mark' => 'J',
                'versions' => 'Joomla 4.x, 5.x', 'stack' => 'PHP 8.1+', 'package' => 'Системний плагін',
                'root' => 'joomla/plg_system_gamecon', 'shared' => 'lib/GameConClient.php',
                'redirect' => '/index.php?gamecon=callback',
                'steps' => [
                    'Система → Встановлення → Розширення → завантажте архів.',
                    'Система → Плагіни → «Система - Увійти через GameCon»: Client ID і Secret, увімкніть.',
                    'Кнопка з’явиться у формі входу й модулі входу.',
                ],
                'features' => ['Кнопка у формі й модулі входу', 'Реєстрація в групі за замовчуванням', 'Стандартний вхід Joomla (плагіни «Користувач» спрацьовують)'],
            ],
            'drupal' => [
                'logo' => '/images/cms/drupal.svg',
                'name' => 'Drupal', 'kind' => 'cms', 'color' => '#0678be', 'mark' => 'D',
                'versions' => 'Drupal 10, 11', 'stack' => 'PHP 8.1+', 'package' => 'Модуль',
                'root' => 'drupal', 'shared' => 'gamecon_login/lib/GameConClient.php',
                'redirect' => '/gamecon/callback',
                'steps' => [
                    'Розпакуйте архів у modules/custom (тека gamecon_login).',
                    'Розширення → увімкніть «Увійти через GameCon».',
                    'Конфігурація → Люди → Увійти через GameCon: Client ID і Secret.',
                ],
                'features' => ['Кнопка у формі входу', 'Блок «Увійти через GameCon»', 'Сторінка налаштувань у конфігурації'],
            ],
            'discourse' => [
                'logo' => '/images/cms/discourse.svg',
                'name' => 'Discourse', 'kind' => 'forum', 'color' => '#e45735', 'mark' => 'Di',
                'versions' => 'Discourse 3.x', 'stack' => 'Ruby', 'package' => 'Плагін',
                'root' => 'discourse', 'shared' => null,
                'redirect' => '/auth/gamecon/callback',
                'steps' => [
                    'У containers/app.yml додайте в hooks.after_code завантаження архіву (команда — у README архіву).',
                    './launcher rebuild app',
                    'Адмінка → Налаштування → Плагіни: Client ID, Secret, увімкніть gamecon login.',
                ],
                'features' => ['Кнопка у вікні входу й реєстрації', 'Прив’язка до наявного акаунта в профілі', 'PKCE'],
            ],
            'phpbb' => [
                'logo' => '/images/cms/phpbb.svg',
                'name' => 'phpBB', 'kind' => 'forum', 'color' => '#105289', 'mark' => 'pB',
                'versions' => 'phpBB 3.3', 'stack' => 'PHP 7.2+', 'package' => 'Розширення',
                'root' => 'phpbb', 'shared' => 'gamecon/login/lib/GameConClient.php',
                'redirect' => '/app.php/gamecon/callback',
                'steps' => [
                    'Розпакуйте архів у теку ext/ форуму (вийде ext/gamecon/login).',
                    'Адмінка → Персоналізація → Розширення → «Увійти через GameCon» → Увімкнути.',
                    'Адмінка → Розширення → GameCon: Client ID і Secret.',
                ],
                'features' => ['Посилання в шапці й кнопка на сторінці входу', 'Налаштування в адмінці з журналом', 'Таблиця зв’язків акаунтів'],
            ],
            'xenforo' => [
                'name' => 'XenForo', 'kind' => 'forum', 'color' => '#2577b1', 'mark' => 'XF',
                'versions' => 'XenForo 2.2, 2.3', 'stack' => 'PHP 7.2+', 'package' => 'Дополнення',
                'root' => 'xenforo', 'shared' => 'upload/src/addons/GameCon/Login/lib/GameConClient.php',
                'redirect' => '/index.php?gamecon/callback',
                'steps' => [
                    'Адмінка → Дополнення → Встановити/оновити з архіву → оберіть архів.',
                    'Налаштування → Параметри → «Увійти через GameCon»: Client ID і Secret.',
                    'З дружніми URL адреса повернення — /gamecon/callback.',
                ],
                'features' => ['Кнопка на сторінці входу', 'Реєстрація без пароля й підтвердження пошти', 'Стандартний «запам’ятати мене»'],
            ],
            'invision' => [
                'name' => 'Invision Community', 'kind' => 'forum', 'color' => '#3b5998', 'mark' => 'IC',
                'versions' => 'IPS 4.7, 5', 'stack' => 'PHP 8.1+', 'package' => 'Дополнення',
                'root' => 'invision', 'shared' => 'applications/gamecon/lib/GameConClient.php',
                'redirect' => '/index.php?app=gamecon&module=system&controller=login&do=callback',
                'steps' => [
                    'Завантажте applications/gamecon у теку applications форуму.',
                    'ACP → System → Applications → GameCon → Install.',
                    'ACP → GameCon → Settings: Client ID і Secret. Без коду — вбудований «Other OAuth 2.0» (README).',
                ],
                'features' => ['Дополнення під майбутні функції GameCon', 'Налаштування в ACP з журналом', 'Альтернатива: вбудований OAuth 2.0 IPS'],
            ],
            'discuz' => [
                'name' => 'Discuz!', 'kind' => 'forum', 'color' => '#1f6fd1', 'mark' => 'Dz',
                'versions' => 'Discuz! X3.4, X3.5', 'stack' => 'PHP 7+', 'package' => 'Плагін',
                'root' => 'discuz', 'shared' => 'gamecon/lib/GameConClient.php',
                'redirect' => '/plugin.php?id=gamecon:login&mode=callback',
                'steps' => [
                    'Завантажте теку gamecon у source/plugin/.',
                    'Адмінка → Програми → Плагіни → встановіть «Увійти через GameCon».',
                    'Налаштування плагіна: Client ID і Secret.',
                ],
                'features' => ['Кнопка біля форми входу', 'Реєстрація через UCenter'],
            ],
            'modx' => [
                'logo' => '/images/cms/modx.svg',
                'name' => 'MODX', 'kind' => 'cms', 'color' => '#102c53', 'mark' => 'MX',
                'versions' => 'MODX Revolution 2.8, 3.x', 'stack' => 'PHP 7.4+', 'package' => 'Плагін і сніпет',
                'root' => 'modx', 'shared' => 'core/components/gamecon/lib/GameConClient.php',
                'redirect' => '/?gamecon=callback',
                'steps' => [
                    'Розпакуйте архів у корінь сайту.',
                    'Створіть системні налаштування gamecon.client_id, gamecon.client_secret, gamecon.base_url.',
                    'Плагін на подію OnWebPageInit і сніпет [[!GameConLogin]] — статичні файли з архіву (README).',
                ],
                'features' => ['Сніпет кнопки для будь-якого шаблону', 'Група для нових користувачів', 'Зв’язок через remote_key'],
            ],
            'flarum' => [
                'name' => 'Flarum', 'kind' => 'forum', 'color' => '#e7672e', 'mark' => 'F',
                'versions' => 'Flarum 1.8+', 'stack' => 'PHP 8.0+', 'package' => 'Розширення',
                'root' => 'flarum', 'shared' => 'gamecon-flarum-login/lib/GameConClient.php',
                'redirect' => '/auth/gamecon',
                'steps' => [
                    'Розпакуйте в packages/gamecon-flarum-login у корені форуму.',
                    'composer config repositories.gamecon path packages/gamecon-flarum-login && composer require gamecon/flarum-login:*',
                    'Адмінка → Розширення → «Увійти через GameCon»: Client ID і Secret.',
                ],
                'features' => ['Кнопка у вікні входу', 'Стандартна реєстрація Flarum з підставленими ніком і поштою', 'Аватар із GameCon'],
            ],
            'nodebb' => [
                'logo' => '/images/cms/nodebb.svg',
                'name' => 'NodeBB', 'kind' => 'forum', 'color' => '#2f80c3', 'mark' => 'N',
                'versions' => 'NodeBB 3.x, 4.x', 'stack' => 'Node.js', 'package' => 'Плагін',
                'root' => 'nodebb', 'shared' => null,
                'redirect' => '/auth/gamecon/callback',
                'steps' => [
                    'npm install /шлях/до/nodebb-plugin-sso-gamecon у корені NodeBB.',
                    'Адмінка → Плагіни → увімкніть sso-gamecon, перезапустіть.',
                    'Адмінка → Соціальний вхід → GameCon: Client ID і Secret.',
                ],
                'features' => ['Соціальний вхід NodeBB', 'PKCE і state', 'Прив’язка до поточного акаунта'],
            ],
            'smf' => [
                'name' => 'SMF', 'kind' => 'forum', 'color' => '#4a7aa8', 'mark' => 'S',
                'versions' => 'Simple Machines Forum 2.1', 'stack' => 'PHP 7.0+', 'package' => 'Модифікація',
                'root' => 'smf/gamecon_login', 'shared' => 'lib/GameConClient.php',
                'redirect' => '/index.php?action=gamecon;callback',
                'steps' => [
                    'Адмінка → Менеджер пакетів → Завантажити пакет → встановіть.',
                    'Адмінка → Конфігурація → Налаштування модифікацій: Client ID і Secret.',
                    'Для гостей з’явиться пункт меню «Увійти через GameCon».',
                ],
                'features' => ['Пункт меню для гостей', 'Стандартна реєстрація SMF'],
            ],
            'vanilla' => [
                'name' => 'Vanilla Forums', 'kind' => 'forum', 'color' => '#0291db', 'mark' => 'V',
                'versions' => 'Vanilla 3.3+ / 2023+', 'stack' => 'PHP 7.4+', 'package' => 'Дополнення',
                'root' => 'vanilla', 'shared' => 'gamecon/lib/GameConClient.php',
                'redirect' => '/entry/gamecon/callback',
                'steps' => [
                    'Завантажте теку gamecon у plugins/ (або addons/addons/).',
                    'Панель → Дополнення → увімкніть «Увійти через GameCon».',
                    'Налаштування → GameCon: Client ID і Secret.',
                ],
                'features' => ['Кнопка серед способів входу', 'Зв’язок через UserAuthentication'],
            ],
            'instantcms' => [
                'name' => 'InstantCMS', 'kind' => 'cms', 'color' => '#2c3e50', 'mark' => 'iC',
                'versions' => 'InstantCMS 2.14+', 'stack' => 'PHP 7.2+', 'package' => 'Компонент',
                'root' => 'instantcms', 'shared' => 'package/system/controllers/gamecon/lib/GameConClient.php',
                'redirect' => '/gamecon/callback',
                'steps' => [
                    'Панель → Встановлення пакетів → завантажте архів.',
                    'Компоненти → GameCon: Client ID і Secret.',
                    'Кнопку додайте посиланням /gamecon/login у меню чи шаблон.',
                ],
                'features' => ['Компонент із налаштуваннями', 'Таблиця зв’язків акаунтів'],
            ],
        ];
    }

    /** @return array<string, mixed>|null */
    public static function find(string $key): ?array
    {
        return self::all()[$key] ?? null;
    }

    /** Шлях до готового архіву (збирається, якщо вихідники змінились). */
    public static function archive(string $key): string
    {
        $plugin = self::find($key) ?? throw new RuntimeException('Невідомий плагін.');
        $source = resource_path('cms-plugins/'.$plugin['root']);
        $shared = resource_path('cms-plugins/_shared/GameConClient.php');
        $files = collect(File::allFiles($source))->sortBy(fn ($f) => $f->getRelativePathname())->values();
        $hash = substr(sha1($files->map(fn ($f) => $f->getRelativePathname().':'.$f->getMTime().':'.$f->getSize())->implode('|').filemtime($shared).self::VERSION), 0, 12);
        $dir = storage_path('app/cms-plugins');
        $path = $dir.'/gamecon-'.$key.'-'.self::VERSION.'-'.$hash.'.zip';
        if (is_file($path)) {
            return $path;
        }
        File::ensureDirectoryExists($dir);
        foreach (glob($dir.'/gamecon-'.$key.'-*.zip') ?: [] as $old) {
            @unlink($old);
        }
        $zip = new ZipArchive;
        if ($zip->open($path.'.tmp', ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Не вдалося зібрати архів.');
        }
        foreach ($files as $file) {
            $zip->addFile($file->getPathname(), str_replace('\\', '/', $file->getRelativePathname()));
        }
        if ($plugin['shared'] !== null) {
            $zip->addFile($shared, $plugin['shared']);
        }
        $zip->close();
        rename($path.'.tmp', $path);

        return $path;
    }
}
