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
    public const VERSION = '1.1.0';

    /**
     * @return array<string, array<string, mixed>>
     */
    public static function all(): array
    {
        return [
            'wordpress' => [
                'site' => 'https://wordpress.org/',
                'logo' => '/images/cms/wordpress.svg',
                'name' => 'WordPress', 'kind' => 'cms', 'color' => '#21759b', 'mark' => 'W',
                'versions' => 'WordPress 6.0+', 'stack' => 'PHP 7.4+', 'package' => 'Плагін',
                'root' => 'wordpress', 'shared' => 'gamecon-login/lib/GameConClient.php',
                'redirect' => '/?gamecon=callback',
                'steps' => [
                    'Плагіни → Додати новий → Завантажити плагін → оберіть архів → Активувати.',
                ],
                'settings' => 'Налаштування → GameCon',
                'features' => ['Кнопка на сторінці входу й шорткоди', 'Картка профілю й віджет сервера', '«Поділитися в GameCon» під записами', 'Значок GameCon біля авторів коментарів', 'Дзвіночок сповіщень GameCon', 'Ім’я й аватар оновлюються при кожному вході'],
            ],
            'joomla' => [
                'site' => 'https://www.joomla.org/',
                'logo' => '/images/cms/joomla.svg',
                'name' => 'Joomla', 'kind' => 'cms', 'color' => '#f44321', 'mark' => 'J',
                'versions' => 'Joomla 4.x, 5.x', 'stack' => 'PHP 8.1+', 'package' => 'Системний плагін',
                'root' => 'joomla/plg_system_gamecon', 'shared' => 'lib/GameConClient.php',
                'redirect' => '/index.php?gamecon=callback',
                'steps' => [
                    'Система → Встановлення → Розширення → завантажте архів.',
                ],
                'settings' => 'Система → Плагіни → «Система - Увійти через GameCon»',
                'features' => ['Кнопка у формі й модулі входу', 'Реєстрація в групі за замовчуванням', 'Стандартний вхід Joomla (плагіни «Користувач» спрацьовують)'],
            ],
            'drupal' => [
                'site' => 'https://www.drupal.org/',
                'logo' => '/images/cms/drupal.svg',
                'name' => 'Drupal', 'kind' => 'cms', 'color' => '#0678be', 'mark' => 'D',
                'versions' => 'Drupal 10, 11', 'stack' => 'PHP 8.1+', 'package' => 'Модуль',
                'root' => 'drupal', 'shared' => 'gamecon_login/lib/GameConClient.php',
                'redirect' => '/gamecon/callback',
                'steps' => [
                    'Розпакуйте архів у modules/custom (тека gamecon_login).',
                    'Розширення → увімкніть «Увійти через GameCon».',
                ],
                'settings' => 'Конфігурація → Люди → Увійти через GameCon',
                'features' => ['Кнопка у формі входу', 'Блок «Увійти через GameCon»', 'Сторінка налаштувань у конфігурації'],
            ],
            'discourse' => [
                'site' => 'https://www.discourse.org/',
                'logo' => '/images/cms/discourse.svg',
                'name' => 'Discourse', 'kind' => 'forum', 'color' => '#e45735', 'mark' => 'Di',
                'versions' => 'Discourse 3.x', 'stack' => 'Ruby', 'package' => 'Плагін',
                'root' => 'discourse', 'shared' => null,
                'redirect' => '/auth/gamecon/callback',
                'steps' => [
                    'У containers/app.yml додайте в hooks.after_code завантаження архіву (команда — у README архіву).',
                    './launcher rebuild app',
                ],
                'settings' => 'Адмінка → Налаштування → Плагіни → gamecon',
                'features' => ['Кнопка у вікні входу й реєстрації', 'Прив’язка до наявного акаунта в профілі', 'PKCE'],
            ],
            'phpbb' => [
                'site' => 'https://www.phpbb.com/',
                'logo' => '/images/cms/phpbb.svg',
                'name' => 'phpBB', 'kind' => 'forum', 'color' => '#105289', 'mark' => 'pB',
                'versions' => 'phpBB 3.3', 'stack' => 'PHP 7.2+', 'package' => 'Розширення',
                'root' => 'phpbb', 'shared' => 'gamecon/login/lib/GameConClient.php',
                'redirect' => '/app.php/gamecon/callback',
                'steps' => [
                    'Розпакуйте архів у теку ext/ форуму (вийде ext/gamecon/login).',
                    'Адмінка → Персоналізація → Розширення → «Увійти через GameCon» → Увімкнути.',
                ],
                'settings' => 'Адмінка → Розширення → GameCon',
                'features' => ['Посилання в шапці й кнопка на сторінці входу', 'Налаштування в адмінці з журналом', 'Таблиця зв’язків акаунтів'],
            ],
            'xenforo' => [
                'site' => 'https://xenforo.com/',
                'name' => 'XenForo', 'kind' => 'forum', 'color' => '#2577b1', 'mark' => 'XF',
                'versions' => 'XenForo 2.2, 2.3', 'stack' => 'PHP 7.2+', 'package' => 'Дополнення',
                'root' => 'xenforo', 'shared' => 'upload/src/addons/GameCon/Login/lib/GameConClient.php',
                'redirect' => '/index.php?gamecon/callback',
                'steps' => [
                    'Адмінка → Дополнення → Встановити/оновити з архіву → оберіть архів.',
                ],
                'settings' => 'Налаштування → Параметри → «Увійти через GameCon»',
                'features' => ['Кнопка на сторінці входу', 'Реєстрація без пароля й підтвердження пошти', 'Стандартний «запам’ятати мене»'],
            ],
            'invision' => [
                'site' => 'https://invisioncommunity.com/',
                'name' => 'Invision Community', 'kind' => 'forum', 'color' => '#3b5998', 'mark' => 'IC',
                'versions' => 'IPS 4.7, 5', 'stack' => 'PHP 8.1+', 'package' => 'Дополнення',
                'root' => 'invision', 'shared' => 'applications/gamecon/lib/GameConClient.php',
                'redirect' => '/index.php?app=gamecon&module=system&controller=login&do=callback',
                'steps' => [
                    'Завантажте applications/gamecon у теку applications форуму.',
                    'ACP → System → Applications → GameCon → Install.',
                ],
                'settings' => 'ACP → GameCon → Settings',
                'features' => ['Дополнення під майбутні функції GameCon', 'Налаштування в ACP з журналом', 'Альтернатива: вбудований OAuth 2.0 IPS'],
            ],
            'discuz' => [
                'site' => 'https://www.discuz.vip/',
                'name' => 'Discuz!', 'kind' => 'forum', 'color' => '#1f6fd1', 'mark' => 'Dz',
                'versions' => 'Discuz! X3.4, X3.5', 'stack' => 'PHP 7+', 'package' => 'Плагін',
                'root' => 'discuz', 'shared' => 'gamecon/lib/GameConClient.php',
                'redirect' => '/plugin.php?id=gamecon:login&mode=callback',
                'steps' => [
                    'Завантажте теку gamecon у source/plugin/.',
                    'Адмінка → Програми → Плагіни → встановіть «Увійти через GameCon».',
                ],
                'settings' => 'Плагіни → «Увійти через GameCon» → Налаштування',
                'features' => ['Кнопка біля форми входу', 'Реєстрація через UCenter'],
            ],
            'modx' => [
                'site' => 'https://modx.com/',
                'logo' => '/images/cms/modx.svg',
                'name' => 'MODX', 'kind' => 'cms', 'color' => '#102c53', 'mark' => 'MX',
                'versions' => 'MODX Revolution 2.8, 3.x', 'stack' => 'PHP 7.4+', 'package' => 'Плагін і сніпет',
                'root' => 'modx', 'shared' => 'core/components/gamecon/lib/GameConClient.php',
                'redirect' => '/?gamecon=callback',
                'steps' => [
                    'Розпакуйте архів у корінь сайту.',
                    'Створіть плагін (подія OnWebPageInit) і сніпет [[!GameConLogin]] зі статичних файлів архіву (README).',
                ],
                'settings' => 'Системні налаштування → gamecon.*',
                'features' => ['Сніпет кнопки для будь-якого шаблону', 'Група для нових користувачів', 'Зв’язок через remote_key'],
            ],
            'flarum' => [
                'site' => 'https://flarum.org/',
                'name' => 'Flarum', 'kind' => 'forum', 'color' => '#e7672e', 'mark' => 'F',
                'versions' => 'Flarum 1.8+', 'stack' => 'PHP 8.0+', 'package' => 'Розширення',
                'root' => 'flarum', 'shared' => 'gamecon-flarum-login/lib/GameConClient.php',
                'redirect' => '/auth/gamecon',
                'steps' => [
                    'Розпакуйте в packages/gamecon-flarum-login у корені форуму.',
                    'composer config repositories.gamecon path packages/gamecon-flarum-login && composer require gamecon/flarum-login:*',
                    'Адмінка → Розширення → увімкніть «Увійти через GameCon».',
                ],
                'settings' => 'Адмінка → Розширення → «Увійти через GameCon»',
                'features' => ['Кнопка у вікні входу', 'Стандартна реєстрація Flarum з підставленими ніком і поштою', 'Аватар із GameCon'],
            ],
            'nodebb' => [
                'site' => 'https://nodebb.org/',
                'logo' => '/images/cms/nodebb.svg',
                'name' => 'NodeBB', 'kind' => 'forum', 'color' => '#2f80c3', 'mark' => 'N',
                'versions' => 'NodeBB 3.x, 4.x', 'stack' => 'Node.js', 'package' => 'Плагін',
                'root' => 'nodebb', 'shared' => null,
                'redirect' => '/auth/gamecon/callback',
                'steps' => [
                    'npm install /шлях/до/nodebb-plugin-sso-gamecon у корені NodeBB.',
                    'Адмінка → Плагіни → увімкніть sso-gamecon, перезапустіть.',
                ],
                'settings' => 'Адмінка → Соціальний вхід → GameCon',
                'features' => ['Соціальний вхід NodeBB', 'PKCE і state', 'Прив’язка до поточного акаунта'],
            ],
            'smf' => [
                'site' => 'https://www.simplemachines.org/',
                'name' => 'SMF', 'kind' => 'forum', 'color' => '#4a7aa8', 'mark' => 'S',
                'versions' => 'Simple Machines Forum 2.1', 'stack' => 'PHP 7.0+', 'package' => 'Модифікація',
                'root' => 'smf/gamecon_login', 'shared' => 'lib/GameConClient.php',
                'redirect' => '/index.php?action=gamecon;callback',
                'steps' => [
                    'Адмінка → Менеджер пакетів → Завантажити пакет → встановіть.',
                ],
                'settings' => 'Адмінка → Конфігурація → Налаштування модифікацій',
                'features' => ['Пункт меню для гостей', 'Стандартна реєстрація SMF'],
            ],
            'vanilla' => [
                'site' => 'https://vanillaforums.com/',
                'name' => 'Vanilla Forums', 'kind' => 'forum', 'color' => '#0291db', 'mark' => 'V',
                'versions' => 'Vanilla 3.3+ / 2023+', 'stack' => 'PHP 7.4+', 'package' => 'Дополнення',
                'root' => 'vanilla', 'shared' => 'gamecon/lib/GameConClient.php',
                'redirect' => '/entry/gamecon/callback',
                'steps' => [
                    'Завантажте теку gamecon у plugins/ (або addons/addons/).',
                    'Панель → Дополнення → увімкніть «Увійти через GameCon».',
                ],
                'settings' => 'Налаштування → GameCon',
                'features' => ['Кнопка серед способів входу', 'Зв’язок через UserAuthentication'],
            ],
            'instantcms' => [
                'site' => 'https://instantcms.ru/',
                'name' => 'InstantCMS', 'kind' => 'cms', 'color' => '#2c3e50', 'mark' => 'iC',
                'versions' => 'InstantCMS 2.14+', 'stack' => 'PHP 7.2+', 'package' => 'Компонент',
                'root' => 'instantcms', 'shared' => 'package/system/controllers/gamecon/lib/GameConClient.php',
                'redirect' => '/gamecon/callback',
                'steps' => [
                    'Панель → Встановлення пакетів → завантажте архів.',
                ],
                'settings' => 'Компоненти → GameCon',
                'features' => ['Компонент із налаштуваннями', 'Таблиця зв’язків акаунтів'],
            ],

            // ── Свій код: фреймворки ──
            'laravel' => [
                'logo' => '/images/cms/laravel.svg',
                'site' => 'https://laravel.com/',
                'name' => 'Laravel', 'kind' => 'framework', 'color' => '#ff2d20', 'mark' => 'L',
                'versions' => 'Laravel 10–12', 'stack' => 'PHP 8.1+, Socialite', 'package' => 'Провайдер Socialite',
                'root' => 'laravel', 'shared' => null,
                'redirect' => '/auth/gamecon/callback',
                'steps' => [
                    'Розробникам → Новий застосунок «з секретом», адреса повернення — нижче.',
                    'Розпакуйте в packages/gamecon-socialite і: composer config repositories.gamecon path packages/gamecon-socialite && composer require gamecon/socialite:*',
                    'Додайте gamecon у config/services.php і два маршрути — приклад у README архіву.',
                ],
                'settings' => '',
                'features' => ['Драйвер Socialite «gamecon» з PKCE', 'Профіль: id, нік, ім’я, пошта, аватар', 'Готові маршрути входу'],
            ],
            'node' => [
                'logo' => '/images/cms/nodedotjs.svg',
                'site' => 'https://nodejs.org/',
                'name' => 'Node.js (Express)', 'kind' => 'framework', 'color' => '#3c873a', 'mark' => 'N',
                'versions' => 'Node 18+', 'stack' => 'Express, Passport', 'package' => 'Приклад',
                'root' => 'node', 'shared' => null,
                'redirect' => '/auth/gamecon/callback',
                'steps' => [
                    'Розробникам → Новий застосунок «з секретом», адреса повернення — нижче.',
                    'npm install, задайте GAMECON_CLIENT_ID, GAMECON_CLIENT_SECRET, SESSION_SECRET, APP_URL.',
                    'Перенесіть стратегію gamecon із server.js у свій застосунок.',
                ],
                'settings' => '',
                'features' => ['Passport-стратегія з PKCE і state', 'Сесії й вихід', 'Працює з будь-яким Express-проєктом'],
            ],
            'nextjs' => [
                'logo' => '/images/cms/nextdotjs.svg',
                'site' => 'https://nextjs.org/',
                'name' => 'Next.js (Auth.js)', 'kind' => 'framework', 'color' => '#111111', 'mark' => 'Nx',
                'versions' => 'Next.js 14+, Auth.js v5', 'stack' => 'TypeScript', 'package' => 'Провайдер Auth.js',
                'root' => 'nextjs', 'shared' => null,
                'redirect' => '/api/auth/callback/gamecon',
                'steps' => [
                    'Розробникам → Новий застосунок «з секретом», адреса повернення — нижче.',
                    'npm install next-auth@beta, скопіюйте gamecon-provider.ts і auth.ts.',
                    'Задайте GAMECON_CLIENT_ID, GAMECON_CLIENT_SECRET, AUTH_SECRET і додайте кнопку signIn(\'gamecon\').',
                ],
                'settings' => '',
                'features' => ['Провайдер Auth.js з PKCE', 'Типізований профіль', 'Server Actions'],
            ],
            'python' => [
                'logo' => '/images/cms/python.svg',
                'site' => 'https://www.python.org/',
                'name' => 'Python (Flask, FastAPI, Django)', 'kind' => 'framework', 'color' => '#3776ab', 'mark' => 'Py',
                'versions' => 'Python 3.9+', 'stack' => 'Authlib', 'package' => 'Приклади',
                'root' => 'python', 'shared' => null,
                'redirect' => '/auth/gamecon/callback',
                'steps' => [
                    'Розробникам → Новий застосунок «з секретом», адреса повернення — нижче.',
                    'pip install -r requirements.txt, задайте GAMECON_CLIENT_ID, GAMECON_CLIENT_SECRET, SECRET_KEY.',
                    'flask_app.py чи fastapi_app.py — готовий вхід; для Django — ті самі налаштування Authlib.',
                ],
                'settings' => '',
                'features' => ['Flask і FastAPI з PKCE', 'Підказка для Django', 'userinfo одним викликом'],
            ],
            'php' => [
                'logo' => '/images/cms/php.svg',
                'site' => 'https://www.php.net/',
                'name' => 'PHP без фреймворку', 'kind' => 'framework', 'color' => '#777bb4', 'mark' => 'P',
                'versions' => 'PHP 7.4+', 'stack' => 'без залежностей / League OAuth2', 'package' => 'Клієнт і приклади',
                'root' => 'php', 'shared' => 'gamecon-php/GameConClient.php',
                'redirect' => '/callback.php',
                'steps' => [
                    'Розробникам → Новий застосунок «з секретом», адреса повернення — нижче.',
                    'Покладіть login.php, callback.php, config.php і GameConClient.php на сайт, у config.php вкажіть адресу повернення.',
                    'Symfony, Yii, CodeIgniter, Slim — league-oauth2-example.php.',
                ],
                'settings' => '',
                'features' => ['Без залежностей: PKCE, state, userinfo', 'Приклад League OAuth2 для фреймворків'],
            ],
            // ── Свій код: застосунки ──
            'android' => [
                'logo' => '/images/cms/android.svg',
                'site' => 'https://developer.android.com/',
                'name' => 'Android', 'kind' => 'app', 'color' => '#3ddc84', 'mark' => 'A',
                'versions' => 'Android 7+', 'stack' => 'Kotlin, AppAuth', 'package' => 'Клас Kotlin',
                'root' => 'android', 'shared' => null,
                'redirect' => 'com.example.game://oauth',
                'steps' => [
                    'Розробникам → Новий застосунок без секрету (публічний), адреса повернення — ваша схема, як нижче.',
                    'Додайте net.openid:appauth і manifestPlaceholders appAuthRedirectScheme.',
                    'Скопіюйте GameConAuth.kt: gamecon.start() і gamecon.finish(data).',
                ],
                'settings' => '',
                'features' => ['Custom Tabs, PKCE автоматично', 'Без секрету в застосунку', 'Профіль одним викликом'],
            ],
            'apple' => [
                'logo' => '/images/cms/apple.svg',
                'site' => 'https://developer.apple.com/',
                'name' => 'iOS і macOS', 'kind' => 'app', 'color' => '#1d1d1f', 'mark' => 'iOS',
                'versions' => 'iOS 15+, macOS 12+', 'stack' => 'Swift, без залежностей', 'package' => 'Клас Swift',
                'root' => 'apple', 'shared' => null,
                'redirect' => 'com.example.game://oauth',
                'steps' => [
                    'Розробникам → Новий застосунок без секрету (публічний), адреса повернення — ваша схема, як нижче.',
                    'Додайте GameConAuth.swift у проєкт.',
                    'let profile = try await GameConAuth(clientId:redirect:).signIn()',
                ],
                'settings' => '',
                'features' => ['ASWebAuthenticationSession', 'PKCE на CryptoKit', 'Один код для iOS і macOS'],
            ],
            'windows' => [
                'logo' => '/images/cms/dotnet.svg',
                'site' => 'https://dotnet.microsoft.com/',
                'name' => 'Windows (.NET)', 'kind' => 'app', 'color' => '#512bd4', 'mark' => 'Win',
                'versions' => 'Windows 10+, .NET 8', 'stack' => 'C#: WPF, WinForms, MAUI', 'package' => 'Клас C#',
                'root' => 'windows', 'shared' => null,
                'redirect' => 'http://127.0.0.1/callback',
                'steps' => [
                    'Розробникам → Новий застосунок без секрету (публічний), адреса повернення — нижче (порт підставляється сам).',
                    'Додайте GameConAuth.cs (чи dotnet run для прикладу).',
                    'var profile = await new GameConAuth("CLIENT_ID").SignInAsync();',
                ],
                'settings' => '',
                'features' => ['Системний браузер + loopback (RFC 8252)', 'PKCE, без секрету', 'WPF, WinForms, MAUI, консоль'],
            ],
            'linux' => [
                'logo' => '/images/cms/linux.svg',
                'site' => 'https://kernel.org/',
                'name' => 'Linux', 'kind' => 'app', 'color' => '#333333', 'mark' => 'Lx',
                'versions' => 'Будь-який дистрибутив', 'stack' => 'Python 3, без залежностей', 'package' => 'CLI gamecon-auth',
                'root' => 'linux', 'shared' => null, 'install' => true,
                'redirect' => 'http://127.0.0.1/callback',
                'steps' => [
                    'Розробникам → Новий застосунок без секрету (публічний), адреса повернення — нижче.',
                    'Встановіть командою з цієї сторінки (curl … | sh) — gamecon-auth з’явиться в ~/.local/bin.',
                    'gamecon-auth login --client-id ВАШ_ID, далі gamecon-auth me / token; у застосунку — from gamecon_auth import login.',
                ],
                'settings' => '',
                'features' => ['Встановлення однією командою', 'Вхід через браузер (loopback, PKCE)', 'Токени оновлюються самі', 'Модуль для GTK/Qt-застосунків'],
            ],
            'flutter' => [
                'logo' => '/images/cms/flutter.svg',
                'site' => 'https://flutter.dev/',
                'name' => 'Flutter', 'kind' => 'app', 'color' => '#027dfd', 'mark' => 'Fl',
                'versions' => 'Flutter 3.19+', 'stack' => 'Android, iOS, macOS, Windows, Linux, Web', 'package' => 'Клас Dart',
                'root' => 'flutter', 'shared' => null,
                'redirect' => 'com.example.game://oauth',
                'steps' => [
                    'Розробникам → Новий застосунок без секрету, адреси повернення — схема (мобільні) і http://localhost:43823/callback (десктоп).',
                    'Додайте flutter_web_auth_2, http, crypto і gamecon_auth.dart.',
                    'final me = await GameConAuth(clientId:redirect:).signIn();',
                ],
                'settings' => '',
                'features' => ['Одна реалізація для 6 платформ', 'PKCE, без секрету'],
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
