<?php
/**
 * Plugin Name: Увійти через GameCon
 * Plugin URI: https://gamecon.online/developers/plugins/wordpress
 * Description: Вхід і реєстрація через акаунт GameCon (OAuth 2.1 + PKCE). Кнопка на сторінці входу, шорткод [gamecon_login] і віджет профілю [gamecon_profile].
 * Version: 1.0.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: GameCon
 * Author URI: https://gamecon.online
 * License: GPL-2.0-or-later
 * Text Domain: gamecon-login
 */

if (! defined('ABSPATH')) {
    exit;
}

require_once __DIR__.'/lib/GameConClient.php';

final class GameCon_Login
{
    const OPTION = 'gamecon_login';
    const META = 'gamecon_id';

    public static function boot()
    {
        add_action('init', [__CLASS__, 'route']);
        add_action('login_form', [__CLASS__, 'login_button']);
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('admin_init', [__CLASS__, 'settings']);
        add_shortcode('gamecon_login', [__CLASS__, 'shortcode']);
        add_shortcode('gamecon_profile', [__CLASS__, 'profile_shortcode']);
        add_filter('get_avatar_url', [__CLASS__, 'avatar'], 10, 3);
        add_filter('plugin_action_links_'.plugin_basename(__FILE__), function ($links) {
            array_unshift($links, '<a href="'.esc_url(admin_url('options-general.php?page=gamecon-login')).'">'.esc_html__('Налаштування', 'gamecon-login').'</a>');

            return $links;
        });
    }

    public static function opt($key, $default = '')
    {
        $all = get_option(self::OPTION, []);

        return isset($all[$key]) && $all[$key] !== '' ? $all[$key] : $default;
    }

    public static function redirect_uri()
    {
        return add_query_arg('gamecon', 'callback', home_url('/'));
    }

    private static function client()
    {
        $scope = self::opt('email', '1') === '1' ? 'profile email' : 'profile';

        return new GameConClient(self::opt('base', 'https://gamecon.online'), self::opt('client_id'), self::opt('client_secret'), self::redirect_uri(), $scope);
    }

    public static function login_url($back = '')
    {
        return add_query_arg(['gamecon' => 'login', 'back' => rawurlencode($back !== '' ? $back : (isset($_SERVER['REQUEST_URI']) ? home_url(wp_unslash($_SERVER['REQUEST_URI'])) : home_url('/')))], home_url('/'));
    }

    /** /?gamecon=login і /?gamecon=callback */
    public static function route()
    {
        if (empty($_GET['gamecon'])) {
            return;
        }
        $client = self::client();
        if (! $client->configured()) {
            wp_die(esc_html__('Вхід через GameCon ще не налаштовано.', 'gamecon-login'));
        }
        $key = 'gamecon_'.(isset($_COOKIE['gamecon_flow']) ? preg_replace('/[^A-Za-z0-9_\-]/', '', $_COOKIE['gamecon_flow']) : '');

        if ($_GET['gamecon'] === 'login') {
            $auth = $client->authorize();
            $flow = GameConClient::random(16);
            $back = isset($_GET['back']) ? esc_url_raw(rawurldecode(wp_unslash($_GET['back']))) : home_url('/');
            set_transient('gamecon_'.$flow, ['state' => $auth['state'], 'verifier' => $auth['verifier'], 'back' => wp_validate_redirect($back, home_url('/'))], 15 * MINUTE_IN_SECONDS);
            setcookie('gamecon_flow', $flow, time() + 900, COOKIEPATH ?: '/', COOKIE_DOMAIN, is_ssl(), true);
            wp_redirect($auth['url']);
            exit;
        }

        if ($_GET['gamecon'] === 'callback') {
            $flow = get_transient($key);
            delete_transient($key);
            try {
                $user = $client->callback(wp_unslash($_GET), is_array($flow) ? $flow['state'] : '', is_array($flow) ? $flow['verifier'] : '');
                $wp_user = self::find_or_create($user);
            } catch (Exception $e) {
                wp_die(esc_html($e->getMessage()), esc_html__('Вхід через GameCon', 'gamecon-login'), ['back_link' => true]);
            }
            wp_set_current_user($wp_user->ID);
            wp_set_auth_cookie($wp_user->ID, true);
            do_action('wp_login', $wp_user->user_login, $wp_user);
            wp_safe_redirect(is_array($flow) && ! empty($flow['back']) ? $flow['back'] : home_url('/'));
            exit;
        }
    }

    /** Знайти за GameCon ID, далі за підтвердженою поштою, інакше створити. */
    private static function find_or_create(array $user)
    {
        $found = get_users(['meta_key' => self::META, 'meta_value' => $user['id'], 'number' => 1]);
        if ($found) {
            update_user_meta($found[0]->ID, 'gamecon_avatar', $user['avatar']);

            return $found[0];
        }
        if ($user['email'] && $user['email_verified'] && ($by_email = get_user_by('email', $user['email']))) {
            update_user_meta($by_email->ID, self::META, $user['id']);
            update_user_meta($by_email->ID, 'gamecon_avatar', $user['avatar']);

            return $by_email;
        }
        if (! get_option('users_can_register') && self::opt('register', '1') !== '1') {
            throw new RuntimeException(__('Реєстрація на сайті закрита.', 'gamecon-login'));
        }
        $login = sanitize_user(GameConClient::safeUsername($user['username'], 50), true);
        $base = $login;
        for ($i = 2; username_exists($login); $i++) {
            $login = $base.$i;
        }
        $email = $user['email'] && ! email_exists($user['email']) ? $user['email'] : GameConClient::placeholderEmail($user, wp_parse_url(home_url(), PHP_URL_HOST));
        $id = wp_insert_user([
            'user_login' => $login,
            'user_pass' => wp_generate_password(32),
            'user_email' => $email,
            'display_name' => $user['name'] !== '' ? $user['name'] : $login,
            'user_url' => $user['profile'],
            'role' => get_option('default_role', 'subscriber'),
        ]);
        if (is_wp_error($id)) {
            throw new RuntimeException($id->get_error_message());
        }
        update_user_meta($id, self::META, $user['id']);
        update_user_meta($id, 'gamecon_username', $user['username']);
        update_user_meta($id, 'gamecon_avatar', $user['avatar']);

        return get_user_by('id', $id);
    }

    public static function avatar($url, $id_or_email, $args)
    {
        $user = is_numeric($id_or_email) ? get_user_by('id', (int) $id_or_email) : ($id_or_email instanceof WP_User ? $id_or_email : null);
        $own = $user ? get_user_meta($user->ID, 'gamecon_avatar', true) : '';

        return is_string($own) && $own !== '' ? $own : $url;
    }

    public static function button($back = '')
    {
        return '<a class="gamecon-login-button" href="'.esc_url(self::login_url($back)).'" style="display:flex;align-items:center;justify-content:center;gap:8px;margin:12px 0;padding:10px 14px;border-radius:10px;background:#4f46e5;color:#fff;font-weight:600;text-decoration:none">'
            .'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg>'
            .esc_html__('Увійти через GameCon', 'gamecon-login').'</a>';
    }

    public static function login_button()
    {
        if (self::client()->configured()) {
            echo self::button(isset($_REQUEST['redirect_to']) ? wp_unslash($_REQUEST['redirect_to']) : admin_url());
        }
    }

    public static function shortcode()
    {
        return is_user_logged_in() || ! self::client()->configured() ? '' : self::button();
    }

    /** [gamecon_profile username="nick"] — картка профілю GameCon. */
    public static function profile_shortcode($atts)
    {
        $atts = shortcode_atts(['username' => ''], $atts);
        $username = sanitize_user($atts['username'] !== '' ? $atts['username'] : (string) get_user_meta(get_current_user_id(), 'gamecon_username', true));
        if ($username === '') {
            return '';
        }
        $base = rtrim(self::opt('base', 'https://gamecon.online'), '/');

        return '<iframe src="'.esc_url($base.'/widget/u/'.rawurlencode($username)).'" style="width:100%;max-width:420px;height:160px;border:0;border-radius:16px" loading="lazy" title="GameCon"></iframe>';
    }

    public static function menu()
    {
        add_options_page(__('GameCon', 'gamecon-login'), __('GameCon', 'gamecon-login'), 'manage_options', 'gamecon-login', [__CLASS__, 'page']);
    }

    public static function settings()
    {
        register_setting('gamecon_login', self::OPTION, ['sanitize_callback' => function ($in) {
            return [
                'base' => esc_url_raw(isset($in['base']) ? $in['base'] : ''),
                'client_id' => sanitize_text_field(isset($in['client_id']) ? $in['client_id'] : ''),
                'client_secret' => sanitize_text_field(isset($in['client_secret']) ? $in['client_secret'] : ''),
                'email' => empty($in['email']) ? '0' : '1',
                'register' => empty($in['register']) ? '0' : '1',
            ];
        }]);
    }

    public static function page()
    {
        $o = get_option(self::OPTION, []); ?>
        <div class="wrap">
            <h1><?php esc_html_e('Увійти через GameCon', 'gamecon-login'); ?></h1>
            <p><?php esc_html_e('1. Створіть застосунок у розділі «Розробникам» на GameCon. 2. Вкажіть у ньому адресу повернення нижче. 3. Вставте Client ID і Secret.', 'gamecon-login'); ?></p>
            <p><strong><?php esc_html_e('Адреса повернення (Redirect URI):', 'gamecon-login'); ?></strong> <code><?php echo esc_html(self::redirect_uri()); ?></code></p>
            <form method="post" action="options.php">
                <?php settings_fields('gamecon_login'); ?>
                <table class="form-table" role="presentation">
                    <tr><th><label for="gc-id">Client ID</label></th><td><input id="gc-id" class="regular-text" name="gamecon_login[client_id]" value="<?php echo esc_attr(isset($o['client_id']) ? $o['client_id'] : ''); ?>"></td></tr>
                    <tr><th><label for="gc-secret">Client Secret</label></th><td><input id="gc-secret" type="password" class="regular-text" name="gamecon_login[client_secret]" value="<?php echo esc_attr(isset($o['client_secret']) ? $o['client_secret'] : ''); ?>" autocomplete="off"></td></tr>
                    <tr><th><label for="gc-base"><?php esc_html_e('Адреса GameCon', 'gamecon-login'); ?></label></th><td><input id="gc-base" class="regular-text" name="gamecon_login[base]" placeholder="https://gamecon.online" value="<?php echo esc_attr(isset($o['base']) ? $o['base'] : ''); ?>"></td></tr>
                    <tr><th><?php esc_html_e('Пошта', 'gamecon-login'); ?></th><td><label><input type="checkbox" name="gamecon_login[email]" value="1" <?php checked(! isset($o['email']) || $o['email'] === '1'); ?>> <?php esc_html_e('Просити доступ до email (для зв’язку з наявними акаунтами)', 'gamecon-login'); ?></label></td></tr>
                    <tr><th><?php esc_html_e('Реєстрація', 'gamecon-login'); ?></th><td><label><input type="checkbox" name="gamecon_login[register]" value="1" <?php checked(! isset($o['register']) || $o['register'] === '1'); ?>> <?php esc_html_e('Створювати акаунт для нових гравців, навіть якщо реєстрація закрита', 'gamecon-login'); ?></label></td></tr>
                </table>
                <?php submit_button(); ?>
            </form>
            <p><?php esc_html_e('Шорткоди: [gamecon_login] — кнопка входу, [gamecon_profile username="нік"] — картка профілю GameCon.', 'gamecon-login'); ?></p>
        </div>
        <?php
    }
}

GameCon_Login::boot();
