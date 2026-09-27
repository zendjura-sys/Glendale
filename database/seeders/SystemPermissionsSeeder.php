<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Права на разделы системной админки CMS (настройки, ролі, учасники).
 * Выданы роли "admin" — той же самой, что уже владеет addons.manage.
 */
class SystemPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $role = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);

        foreach (['settings.manage', 'roles.manage', 'users.manage', 'union.manage', 'families.manage', 'cinema.manage'] as $name) {
            $permission = Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
            $role->givePermissionTo($permission);
        }
    }
}
