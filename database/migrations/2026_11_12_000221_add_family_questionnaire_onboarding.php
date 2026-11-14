<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Анкета для заявки в сім’ю й чек-лист новачка: питання й кроки — у сім’ї, відповіді й прогрес — в учасника. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('families', function (Blueprint $table) {
            $table->json('questions')->nullable();
            $table->json('onboarding')->nullable();
        });
        Schema::table('family_members', function (Blueprint $table) {
            $table->json('answers')->nullable();
            $table->json('onboarding_done')->nullable();
            $table->timestamp('onboarded_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('families', fn (Blueprint $table) => $table->dropColumn(['questions', 'onboarding']));
        Schema::table('family_members', fn (Blueprint $table) => $table->dropColumn(['answers', 'onboarding_done', 'onboarded_at']));
    }
};
