<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profile_visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('visitor_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('visited_at');
            $table->unique(['user_id', 'visitor_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profile_visits');
    }
};
