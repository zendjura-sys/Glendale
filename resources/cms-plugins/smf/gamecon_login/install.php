<?php

if (file_exists(dirname(__FILE__).'/SSI.php') && ! defined('SMF')) {
    require_once dirname(__FILE__).'/SSI.php';
} elseif (! defined('SMF')) {
    die('<b>Error:</b> Cannot install - please verify you put this in the same place as SMF\'s index.php.');
}

global $smcFunc;
db_extend('packages');
$smcFunc['db_create_table']('{db_prefix}gamecon_links', [
    ['name' => 'id_member', 'type' => 'mediumint', 'unsigned' => true, 'default' => 0],
    ['name' => 'gamecon_id', 'type' => 'varchar', 'size' => 32, 'default' => ''],
], [
    ['type' => 'primary', 'columns' => ['id_member']],
    ['type' => 'unique', 'columns' => ['gamecon_id']],
], [], 'ignore');
updateSettings(['gamecon_base' => 'https://gamecon.online']);
