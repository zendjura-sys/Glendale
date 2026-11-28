<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Історія ніків: хто, коли й з якого на який змінив адресу сторінки.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('username_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('old_username', 64)->index();
            $table->string('new_username', 64);
            $table->timestamp('created_at')->useCurrent();
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('username_changes');
    }
};
