<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('server_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('gta_server_id')->constrained()->cascadeOnDelete();
            $table->date('voted_on');
            $table->timestamp('created_at')->nullable();
            // Один голос на день: людина обирає, за який сервер віддати його сьогодні.
            $table->unique(['user_id', 'voted_on']);
            $table->index(['gta_server_id', 'voted_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_votes');
    }
};
