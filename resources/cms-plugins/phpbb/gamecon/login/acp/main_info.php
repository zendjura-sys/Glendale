<?php

namespace gamecon\login\acp;

class main_info
{
    public function module()
    {
        return [
            'filename' => '\gamecon\login\acp\main_module',
            'title' => 'ACP_GAMECON',
            'modes' => ['settings' => ['title' => 'ACP_GAMECON_SETTINGS', 'auth' => 'ext_gamecon/login && acl_a_board', 'cat' => ['ACP_GAMECON']]],
        ];
    }
}
