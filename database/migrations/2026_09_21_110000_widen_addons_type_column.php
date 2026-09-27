<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Було enum('core','module','plugin','theme') — CHECK-обмеження в
        // SQLite не пускало новий тип 'union' (Union-аддони для
        // union.gamecon.online, дивись AddonManifest::TYPES). Переводимо
        // на звичайний string: новий тип пакета більше не вимагає міграції
        // схеми, дозволені значення й так контролює AddonManifest у коді.
        Schema::table('addons', function (Blueprint $table) {
            $table->string('type', 20)->change();
        });
    }

    public function down(): void
    {
        Schema::table('addons', function (Blueprint $table) {
            $table->enum('type', ['core', 'module', 'plugin', 'theme'])->change();
        });
    }
};
