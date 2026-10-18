<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clans', function (Blueprint $table) {
            $table->json('questions')->nullable();
        });

        Schema::table('clan_members', function (Blueprint $table) {
            $table->json('answers')->nullable();
        });

        Schema::create('invite_links', function (Blueprint $table) {
            $table->id();
            $table->string('token', 24)->unique();
            $table->string('kind', 16);
            $table->unsignedBigInteger('subject_id');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('expires_at');
            $table->timestamps();
            $table->index(['kind', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invite_links');
        Schema::table('clan_members', function (Blueprint $table) {
            $table->dropColumn('answers');
        });
        Schema::table('clans', function (Blueprint $table) {
            $table->dropColumn('questions');
        });
    }
};
