<?php

namespace gamecon\login\migrations;

class install extends \phpbb\db\migration\migration
{
    public static function depends_on()
    {
        return ['\phpbb\db\migration\data\v330\v330'];
    }

    public function effectively_installed()
    {
        return isset($this->config['gamecon_client_id']);
    }

    public function update_schema()
    {
        return ['add_tables' => [$this->table_prefix.'gamecon_links' => [
            'COLUMNS' => ['user_id' => ['UINT', 0], 'gamecon_id' => ['VCHAR:32', '']],
            'PRIMARY_KEY' => 'user_id',
            'KEYS' => ['gamecon_id' => ['UNIQUE', 'gamecon_id']],
        ]]];
    }

    public function revert_schema()
    {
        return ['drop_tables' => [$this->table_prefix.'gamecon_links']];
    }

    public function update_data()
    {
        return [
            ['config.add', ['gamecon_client_id', '']],
            ['config.add', ['gamecon_client_secret', '']],
            ['config.add', ['gamecon_base', 'https://gamecon.online']],
            ['module.add', ['acp', 'ACP_CAT_DOT_MODS', 'ACP_GAMECON']],
            ['module.add', ['acp', 'ACP_GAMECON', ['module_basename' => '\gamecon\login\acp\main_module', 'modes' => ['settings']]]],
        ];
    }
}
