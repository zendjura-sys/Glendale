<?php
require __DIR__.'/config.php';
session_start();
$flow = $_SESSION['gamecon'] ?? [];
unset($_SESSION['gamecon']);
try {
    $user = gamecon()->callback($_GET, $flow['state'] ?? '', $flow['verifier'] ?? '');
} catch (RuntimeException $e) {
    http_response_code(400);
    exit(htmlspecialchars($e->getMessage()));
}
// Тут знайдіть або створіть користувача у своїй базі за $user['id'].
session_regenerate_id(true);
$_SESSION['user'] = $user;
header('Location: /');
