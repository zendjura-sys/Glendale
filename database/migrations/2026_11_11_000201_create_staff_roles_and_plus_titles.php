<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Ролі команди (назва, колір, розділи адмінки) і власна роль-підпис для підписників GameCon+.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_roles', function (Blueprint $table) {
            $table->id();
            $table->string('name', 40);
            $table->string('color', 16)->default('sky');
            $table->json('sections')->nullable();
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('staff_role_id')->nullable()->constrained('staff_roles')->nullOnDelete();
            $table->string('plus_title', 24)->nullable();
            $table->string('plus_title_color', 16)->nullable();
            $table->timestamp('plus_title_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('staff_role_id');
            $table->dropColumn(['plus_title', 'plus_title_color', 'plus_title_at']);
        });
        Schema::dropIfExists('staff_roles');
    }
};
