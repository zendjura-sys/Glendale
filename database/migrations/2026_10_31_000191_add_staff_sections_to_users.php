<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Ролі команди: які розділи адмінки доступні модератору (адміністратору — усі).
        Schema::table('users', function (Blueprint $table) {
            $table->json('staff_sections')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('staff_sections');
        });
    }
};
