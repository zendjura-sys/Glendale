<?php
// PHP без фреймворку: «Увійти через GameCon». Покладіть поруч GameConClient.php (є в архіві).
require __DIR__.'/config.php';
session_start();
$auth = gamecon()->authorize();
$_SESSION['gamecon'] = ['state' => $auth['state'], 'verifier' => $auth['verifier']];
header('Location: '.$auth['url']);
