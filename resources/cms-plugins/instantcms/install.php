<?php

function install_package()
{
    $core = cmsCore::getInstance();
    $core->db->query('CREATE TABLE IF NOT EXISTS `{#}gamecon_links` (`user_id` int(11) unsigned NOT NULL, `gamecon_id` varchar(32) NOT NULL, PRIMARY KEY (`user_id`), UNIQUE KEY `gamecon_id` (`gamecon_id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    if (! $core->db->getRowsCount('controllers', "name = 'gamecon'")) {
        $core->db->insert('controllers', ['title' => 'GameCon', 'name' => 'gamecon', 'is_enabled' => 1, 'options' => '---', 'author' => 'GameCon', 'url' => 'https://gamecon.online', 'version' => '1.0.0', 'is_backend' => 1, 'is_external' => 1]);
    }

    return true;
}
