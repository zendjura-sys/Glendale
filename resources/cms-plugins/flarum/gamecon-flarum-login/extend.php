<?php

use Flarum\Extend;
use GameCon\FlarumLogin\GameConAuthController;

return [
    (new Extend\Frontend('forum'))->js(__DIR__.'/js/dist/forum.js'),
    (new Extend\Frontend('admin'))->js(__DIR__.'/js/dist/admin.js'),
    new Extend\Locales(__DIR__.'/locale'),
    (new Extend\Routes('forum'))->get('/auth/gamecon', 'auth.gamecon', GameConAuthController::class),
];
