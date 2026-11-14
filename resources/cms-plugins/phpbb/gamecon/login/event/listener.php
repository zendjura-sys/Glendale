<?php

namespace gamecon\login\event;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/** Кнопка «Увійти через GameCon» у шапці й на сторінці входу для гостей. */
class listener implements EventSubscriberInterface
{
    protected $config;
    protected $helper;
    protected $template;
    protected $user;

    public function __construct(\phpbb\config\config $config, \phpbb\controller\helper $helper, \phpbb\template\template $template, \phpbb\user $user)
    {
        $this->config = $config;
        $this->helper = $helper;
        $this->template = $template;
        $this->user = $user;
    }

    public static function getSubscribedEvents()
    {
        return [
            'core.user_setup' => 'language',
            'core.page_header' => 'button',
        ];
    }

    public function language($event)
    {
        $lang = $event['lang_set_ext'];
        $lang[] = ['ext_name' => 'gamecon/login', 'lang_set' => 'common'];
        $event['lang_set_ext'] = $lang;
    }

    public function button()
    {
        $this->template->assign_vars([
            'S_GAMECON_LOGIN' => $this->user->data['user_id'] == ANONYMOUS && $this->config['gamecon_client_id'] !== '',
            'U_GAMECON_LOGIN' => $this->helper->route('gamecon_login_start'),
        ]);
    }
}
