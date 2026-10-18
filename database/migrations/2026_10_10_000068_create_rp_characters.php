<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rp_characters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('gta_server_id')->constrained()->cascadeOnDelete();
            $table->foreignId('family_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 60);
            $table->unsignedSmallInteger('age')->nullable();
            $table->string('occupation', 60)->nullable();
            $table->string('bio', 600)->nullable();
            $table->text('story')->nullable();
            $table->string('portrait_path')->nullable();
            $table->json('photos')->nullable();
            $table->string('status', 12)->default('active');
            $table->boolean('is_main')->default(false);
            $table->timestamps();
            $table->index(['user_id', 'gta_server_id']);
            $table->index(['gta_server_id', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rp_characters');
    }
};
