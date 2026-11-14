<?php

namespace gamecon\login\controller;

/**
 * /app.php/gamecon/login → GameCon → /app.php/gamecon/callback.
 */
class main
{
    protected $config;
    protected $db;
    protected $user;
    protected $request;
    protected $helper;
    protected $language;
    protected $root_path;
    protected $php_ext;
    protected $table;

    public function __construct(\phpbb\config\config $config, \phpbb\db\driver\driver_interface $db, \phpbb\user $user, \phpbb\request\request $request, \phpbb\controller\helper $helper, \phpbb\language\language $language, $root_path, $php_ext, $table_prefix)
    {
        $this->config = $config;
        $this->db = $db;
        $this->user = $user;
        $this->request = $request;
        $this->helper = $helper;
        $this->language = $language;
        $this->root_path = $root_path;
        $this->php_ext = $php_ext;
        $this->table = $table_prefix.'gamecon_links';
        $this->language->add_lang('common', 'gamecon/login');
    }

    private function client()
    {
        require_once __DIR__.'/../lib/GameConClient.php';

        return new \GameConClient(
            (string) $this->config['gamecon_base'],
            (string) $this->config['gamecon_client_id'],
            (string) $this->config['gamecon_client_secret'],
            generate_board_url().'/app.'.$this->php_ext.'/gamecon/callback',
            'profile email'
        );
    }

    public function login()
    {
        $client = $this->client();
        if (! $client->configured()) {
            trigger_error('GAMECON_NOT_CONFIGURED');
        }
        $auth = $client->authorize();
        // Стан входу — у cookie на 15 хв (сесія гостя phpBB може змінитися).
        $this->user->set_cookie('gc_state', $auth['state'].'.'.$auth['verifier'], time() + 900);
        redirect($auth['url'], false, true);
    }

    public function callback()
    {
        $cookie = $this->request->variable($this->config['cookie_name'].'_gc_state', '', false, \phpbb\request\request_interface::COOKIE);
        list($state, $verifier) = array_pad(explode('.', $cookie, 2), 2, '');
        $this->user->set_cookie('gc_state', '', time() - 3600);
        try {
            $profile = $this->client()->callback($this->request->get_super_global(\phpbb\request\request_interface::GET), $state, $verifier);
            $user_id = $this->find_or_create($profile);
        } catch (\Exception $e) {
            trigger_error(htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8'));
        }
        $this->user->session_kill(false);
        $this->user->session_create($user_id, false, true, true);
        redirect(append_sid($this->root_path.'index.'.$this->php_ext));
    }

    private function find_or_create(array $profile)
    {
        $sql = 'SELECT user_id FROM '.$this->table.' WHERE gamecon_id = \''.$this->db->sql_escape($profile['id']).'\'';
        $result = $this->db->sql_query($sql);
        $user_id = (int) $this->db->sql_fetchfield('user_id');
        $this->db->sql_freeresult($result);
        if ($user_id) {
            return $user_id;
        }
        if ($profile['email'] && $profile['email_verified']) {
            $result = $this->db->sql_query('SELECT user_id FROM '.USERS_TABLE." WHERE user_email = '".$this->db->sql_escape(utf8_strtolower($profile['email']))."' AND user_type <> ".USER_IGNORE);
            $user_id = (int) $this->db->sql_fetchfield('user_id');
            $this->db->sql_freeresult($result);
            if ($user_id) {
                $this->link($user_id, $profile['id']);

                return $user_id;
            }
        }
        if (! function_exists('user_add')) {
            include $this->root_path.'includes/functions_user.'.$this->php_ext;
        }
        $username = \GameConClient::safeUsername($profile['username'], (int) $this->config['max_name_chars']);
        $base = $username;
        for ($i = 2; $this->taken($username); $i++) {
            $username = $base.$i;
        }
        $result = $this->db->sql_query('SELECT group_id FROM '.GROUPS_TABLE." WHERE group_name = 'REGISTERED' AND group_type = ".GROUP_SPECIAL);
        $group_id = (int) $this->db->sql_fetchfield('group_id');
        $this->db->sql_freeresult($result);
        $email = $profile['email'] ?: \GameConClient::placeholderEmail($profile, $this->config['server_name']);
        $user_id = user_add([
            'username' => $username,
            'user_password' => phpbb_hash(\GameConClient::random(24)),
            'user_email' => $email,
            'group_id' => $group_id,
            'user_type' => USER_NORMAL,
            'user_ip' => $this->user->ip,
            'user_regdate' => time(),
            'user_lang' => $this->user->lang_name,
        ]);
        if (! $user_id) {
            throw new \RuntimeException('Не вдалося створити акаунт.');
        }
        $this->link($user_id, $profile['id']);

        return (int) $user_id;
    }

    private function taken($username)
    {
        $result = $this->db->sql_query('SELECT user_id FROM '.USERS_TABLE." WHERE username_clean = '".$this->db->sql_escape(utf8_clean_string($username))."'");
        $id = $this->db->sql_fetchfield('user_id');
        $this->db->sql_freeresult($result);

        return (bool) $id;
    }

    private function link($user_id, $gamecon_id)
    {
        $this->db->sql_query('DELETE FROM '.$this->table.' WHERE user_id = '.(int) $user_id);
        $this->db->sql_query('INSERT INTO '.$this->table.' '.$this->db->sql_build_array('INSERT', ['user_id' => (int) $user_id, 'gamecon_id' => (string) $gamecon_id]));
    }
}
