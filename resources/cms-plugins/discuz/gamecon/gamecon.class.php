<?php

if (! defined('IN_DISCUZ')) {
    exit('Access Denied');
}

/** Кнопка «Увійти через GameCon» біля форми входу. */
class plugin_gamecon
{
    public function global_login_extra()
    {
        global $_G;
        if ($_G['uid'] || empty($_G['cache']['plugin']['gamecon']['client_id'])) {
            return '';
        }

        return '<div class="fastlg_fm y" style="margin-right:10px;padding-right:10px"><a href="plugin.php?id=gamecon:login" style="display:inline-block;padding:4px 10px;border-radius:6px;background:#4f46e5;color:#fff;font-weight:bold">Увійти через GameCon</a></div>';
    }
}

class plugin_gamecon_member extends plugin_gamecon
{
    public function logging_method()
    {
        return $this->global_login_extra();
    }

    public function register_logging_method()
    {
        return $this->global_login_extra();
    }
}
