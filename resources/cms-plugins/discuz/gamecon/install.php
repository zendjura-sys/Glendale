<?php

if (! defined('IN_DISCUZ') || ! defined('IN_ADMINCP')) {
    exit('Access Denied');
}
$sql = <<<'SQL'
CREATE TABLE IF NOT EXISTS pre_gamecon_link (
  uid mediumint(8) unsigned NOT NULL,
  gamecon_id varchar(32) NOT NULL,
  PRIMARY KEY (uid),
  UNIQUE KEY gamecon_id (gamecon_id)
) ENGINE=InnoDB;
SQL;
runquery($sql);
$finish = true;
