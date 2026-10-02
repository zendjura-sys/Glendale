<?php

namespace Database\Seeders;

use App\Models\Module;
use App\Support\Modules\ModuleManager;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Базове наповнення: стан модулів за замовчуванням. Демо-дані — окремо через DemoSeeder.
     */
    public function run(ModuleManager $modules): void
    {
        $modules->flush();

        foreach ($modules->all() as $module) {
            Module::query()->firstOrCreate(
                ['key' => $module['key']],
                ['enabled' => $module['enabled'], 'position' => $module['nav']['position'] ?? 0],
            );
        }

        $modules->flush();
    }
}
