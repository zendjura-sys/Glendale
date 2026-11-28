<?php

if (! defined('IN_DISCUZ') || ! defined('IN_ADMINCP')) {
    exit('Access Denied');
}
runquery('DROP TABLE IF EXISTS pre_gamecon_link;');
$finish = true;
