<?php

\defined('_JEXEC') or die;

use GameCon\Plugin\System\GameCon\Extension\GameCon;
use Joomla\CMS\Extension\PluginInterface;
use Joomla\CMS\Factory;
use Joomla\CMS\Plugin\PluginHelper;
use Joomla\DI\Container;
use Joomla\DI\ServiceProviderInterface;
use Joomla\Event\DispatcherInterface;

return new class () implements ServiceProviderInterface {
    public function register(Container $container): void
    {
        $container->set(PluginInterface::class, function (Container $container) {
            $plugin = new GameCon($container->get(DispatcherInterface::class), (array) PluginHelper::getPlugin('system', 'gamecon'));
            $plugin->setApplication(Factory::getApplication());

            return $plugin;
        });
    }
};
