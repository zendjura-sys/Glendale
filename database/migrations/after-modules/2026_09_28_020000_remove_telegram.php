<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Telegram більше не використовується: прибираємо таблиці бота (прив'язки
 * акаунтів, чати, заявки), його налаштування, право telegram.manage і
 * досягнення «На звʼязку» (за прив'язку Telegram). Сповіщення лишаються
 * на сайті («дзвіночок»), у браузерному й мобільному push.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['telegram_applications', 'telegram_chats', 'telegram_links'] as $table) {
            Schema::dropIfExists($table);
        }

        DB::table('settings')->where('key', 'like', 'telegram\_%')->delete();
        DB::table('settings')->whereIn('key', ['ai_applications_review_enabled', 'ai_applications_review_instructions'])->delete();

        if (Schema::hasTable('permissions')) {
            $id = DB::table('permissions')->where('name', 'telegram.manage')->value('id');
            if ($id) {
                DB::table('role_has_permissions')->where('permission_id', $id)->delete();
                DB::table('model_has_permissions')->where('permission_id', $id)->delete();
                DB::table('permissions')->where('id', $id)->delete();
            }
        }

        if (Schema::hasTable('achievements')) {
            $id = DB::table('achievements')->where('code', 'telegram_linked')->value('id');
            if ($id) {
                DB::table('user_achievements')->where('achievement_id', $id)->delete();
                DB::table('achievements')->where('id', $id)->delete();
            }
        }

        if (Schema::hasTable('addons')) {
            DB::table('addons')->where('slug', 'telegram')->delete();
        }
    }

    public function down(): void
    {
        // Повернути бота — окрема робота, а не відкат міграції.
    }
};
