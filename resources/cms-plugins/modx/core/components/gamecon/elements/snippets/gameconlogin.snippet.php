<?php
/**
 * Сніпет [[!GameConLogin]] — кнопка «Увійти через GameCon» для гостей.
 *
 * @var modX $modx
 * @var array $scriptProperties
 */
if ($modx->user->isAuthenticated($modx->context->get('key')) || ! $modx->getOption('gamecon.client_id')) {
    return '';
}
$label = $modx->getOption('label', $scriptProperties, 'Увійти через GameCon');

return '<a class="gamecon-login" href="'.htmlspecialchars(rtrim($modx->getOption('site_url'), '/').'/?gamecon=login', ENT_QUOTES).'" '
    .'style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:10px;background:#4f46e5;color:#fff;font-weight:600;text-decoration:none">'
    .htmlspecialchars($label, ENT_QUOTES).'</a>';
