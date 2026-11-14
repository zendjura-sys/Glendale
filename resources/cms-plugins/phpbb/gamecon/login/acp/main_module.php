<?php

namespace gamecon\login\acp;

/** Адмінка → Розширення → GameCon: Client ID, Secret, адреса GameCon. */
class main_module
{
    public $u_action;
    public $tpl_name;
    public $page_title;

    public function main($id, $mode)
    {
        global $config, $request, $template, $user, $phpbb_container, $phpEx;

        $user->add_lang_ext('gamecon/login', 'common');
        $this->tpl_name = 'acp_gamecon';
        $this->page_title = $user->lang('ACP_GAMECON');
        add_form_key('gamecon_login');
        if ($request->is_set_post('submit')) {
            if (! check_form_key('gamecon_login')) {
                trigger_error('FORM_INVALID', E_USER_WARNING);
            }
            $config->set('gamecon_client_id', trim($request->variable('gamecon_client_id', '')));
            $secret = trim($request->variable('gamecon_client_secret', ''));
            if ($secret !== '') {
                $config->set('gamecon_client_secret', $secret);
            }
            $config->set('gamecon_base', trim($request->variable('gamecon_base', 'https://gamecon.online')));
            $phpbb_container->get('log')->add('admin', $user->data['user_id'], $user->ip, 'LOG_GAMECON_SETTINGS');
            trigger_error($user->lang('CONFIG_UPDATED').adm_back_link($this->u_action));
        }
        $template->assign_vars([
            'GAMECON_CLIENT_ID' => $config['gamecon_client_id'],
            'GAMECON_BASE' => $config['gamecon_base'],
            'GAMECON_SECRET_SET' => $config['gamecon_client_secret'] !== '',
            'GAMECON_REDIRECT' => generate_board_url().'/app.'.$phpEx.'/gamecon/callback',
            'U_ACTION' => $this->u_action,
        ]);
    }
}
