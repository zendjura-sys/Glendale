<?php

class formGameconOptions extends cmsForm
{
    public function init()
    {
        return [
            [
                'type' => 'fieldset',
                'title' => 'GameCon',
                'childs' => [
                    new fieldString('client_id', ['title' => 'Client ID', 'rules' => [['required']]]),
                    new fieldString('client_secret', ['title' => 'Client Secret', 'is_password' => true, 'rules' => [['required']]]),
                    new fieldString('base', ['title' => 'Адреса GameCon', 'default' => 'https://gamecon.online']),
                ],
            ],
        ];
    }
}
