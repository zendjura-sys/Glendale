<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Рівні підписки автора (до трьох): назва, ціна на місяць (копійки), що отримує підписник.
        Schema::create('author_tiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 40);
            $table->unsignedInteger('price');
            $table->string('perks', 300)->nullable();
            $table->unsignedTinyInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('author_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('tier_id')->nullable()->constrained('author_tiers')->nullOnDelete();
            $table->unsignedInteger('price');
            $table->timestamp('expires_at');
            $table->boolean('auto_renew')->default(true);
            $table->timestamps();
            $table->unique(['user_id', 'author_id']);
            $table->index(['author_id', 'expires_at']);
        });

        Schema::table('posts', function (Blueprint $table) {
            $table->boolean('subscribers_only')->default(false);
        });

        // Просування спільноти в каталозі (оплачене з рахунку або від адміна).
        Schema::table('communities', function (Blueprint $table) {
            $table->timestamp('promoted_until')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('communities', fn (Blueprint $table) => $table->dropColumn('promoted_until'));
        Schema::table('posts', fn (Blueprint $table) => $table->dropColumn('subscribers_only'));
        Schema::dropIfExists('author_subscriptions');
        Schema::dropIfExists('author_tiers');
    }
};
