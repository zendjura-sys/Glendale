<?php

namespace IPS\gamecon\modules\admin\settings;

if (! \defined('\IPS\SUITE_UNIQUE_KEY')) {
    header(($_SERVER['SERVER_PROTOCOL'] ?? 'HTTP/1.0').' 403 Forbidden');
    exit;
}

/** ACP → GameCon: Client ID, Secret, адреса GameCon (зміни пишуться в журнал адмінки). */
class _settings extends \IPS\Dispatcher\Controller
{
    protected function manage()
    {
        $form = new \IPS\Helpers\Form;
        $form->addMessage('Адреса повернення для застосунку GameCon: '.\IPS\Http\Url::internal('app=gamecon&module=system&controller=login&do=callback', 'front'), 'ipsMessage ipsMessage_info');
        $form->add(new \IPS\Helpers\Form\Text('gamecon_client_id', \IPS\Settings::i()->gamecon_client_id, true));
        $form->add(new \IPS\Helpers\Form\Password('gamecon_client_secret', \IPS\Settings::i()->gamecon_client_secret, false));
        $form->add(new \IPS\Helpers\Form\Url('gamecon_base', \IPS\Settings::i()->gamecon_base ?: 'https://gamecon.online', true));
        if ($values = $form->values()) {
            if (! $values['gamecon_client_secret']) {
                unset($values['gamecon_client_secret']);
            }
            $values['gamecon_base'] = (string) $values['gamecon_base'];
            $form->saveAsSettings($values);
            \IPS\Session::i()->log('acplog__gamecon_settings');
            \IPS\Output::i()->redirect(\IPS\Http\Url::internal('app=gamecon&module=settings&controller=settings'), 'saved');
        }
        \IPS\Output::i()->title = 'GameCon';
        \IPS\Output::i()->output = (string) $form;
    }
}
