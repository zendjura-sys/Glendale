<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gta_servers', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 80)->unique();
            $table->string('name', 80);
            $table->string('platform', 10)->default('pc');
            $table->string('multiplayer', 16)->default('ragemp');
            $table->string('tagline', 160)->nullable();
            $table->text('description')->nullable();
            $table->string('website')->nullable();
            $table->string('discord_invite', 64)->nullable();
            $table->string('telegram')->nullable();
            // ip:port для RAGE:MP / alt:V або код cfx.re для FiveM.
            $table->string('connect', 120)->nullable()->index();

            $table->string('icon_path')->nullable();
            $table->string('icon_url', 500)->nullable();
            $table->string('icon_source', 16)->nullable();
            $table->timestamp('icon_fetched_at')->nullable();

            $table->unsignedInteger('players_online')->nullable();
            $table->unsignedInteger('players_max')->nullable();
            $table->unsignedInteger('players_peak')->nullable();
            $table->unsignedInteger('discord_members')->nullable();
            $table->unsignedInteger('discord_online')->nullable();
            $table->timestamp('stats_updated_at')->nullable();

            $table->string('status', 12)->default('published')->index();
            $table->string('origin', 12)->default('manual');
            $table->string('review_note', 300)->nullable();
            $table->foreignId('suggested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_featured')->default(false);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gta_servers');
    }
};
