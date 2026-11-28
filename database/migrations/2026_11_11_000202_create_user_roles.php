<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Ролі-плашки користувачів (як ролі сервера Discord, але для всього GameCon): «old», «Big Sponsor»…
// Створює адміністратор; видаються вручну або автоматично за правилом (GameCon+, стаж, рівень, досягнення, підтримка).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_roles', function (Blueprint $table) {
            $table->id();
            $table->string('name', 30);
            // regular — звичайна, holiday — святкова (діє в межах дат), award — нагородна, premium — преміум.
            // Ролі команди — окремо (staff_roles), власна роль GameCon+ — users.plus_title.
            $table->string('kind', 16)->default('regular');
            $table->string('color', 16)->default('sky');
            $table->string('icon', 32)->nullable();
            $table->unsignedSmallInteger('priority')->default(100);
            // manual | plus | account_years | level | achievement | spent
            $table->string('rule', 24)->default('manual');
            $table->string('rule_value', 64)->nullable();
            $table->string('description', 160)->nullable();
            // Святкова роль показується лише між цими датами (включно); порожні — завжди.
            $table->date('active_from')->nullable();
            $table->date('active_until')->nullable();
            $table->timestamps();
        });

        Schema::create('user_role_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_role_id')->constrained('user_roles')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Видана автоматично (нічна задача) — забирається, коли умова перестає виконуватися.
            $table->boolean('auto')->default(false);
            $table->foreignId('granted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['user_role_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_role_user');
        Schema::dropIfExists('user_roles');
    }
};
