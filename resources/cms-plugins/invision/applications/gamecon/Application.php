<?php
/**
 * GameCon для Invision Community: вхід через GameCon (OAuth 2.1), далі — інші функції GameCon.
 */

namespace IPS\gamecon;

class _Application extends \IPS\Application
{
    /** Іконка в адмінці. */
    protected function get__icon()
    {
        return 'gamepad';
    }
}
