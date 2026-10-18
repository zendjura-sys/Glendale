<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('party_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('game_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('gta_server_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 120);
            $table->string('note', 500)->nullable();
            $table->string('platform', 12)->nullable();
            $table->json('roles')->nullable();
            $table->unsignedTinyInteger('slots');
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at')->index();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('party_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 40)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unique(['party_post_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('party_members');
        Schema::dropIfExists('party_posts');
    }
};
