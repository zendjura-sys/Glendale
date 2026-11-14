<?php

namespace GameCon\Login;

use XF\AddOn\AbstractSetup;
use XF\Db\Schema\Create;

class Setup extends AbstractSetup
{
    public function install(array $stepParams = [])
    {
        $this->schemaManager()->createTable('xf_gamecon_link', function (Create $table) {
            $table->addColumn('user_id', 'int');
            $table->addColumn('gamecon_id', 'varchar', 32);
            $table->addPrimaryKey('user_id');
            $table->addUniqueKey('gamecon_id');
        });
    }

    public function upgrade(array $stepParams = [])
    {
    }

    public function uninstall(array $stepParams = [])
    {
        $this->schemaManager()->dropTable('xf_gamecon_link');
    }
}
