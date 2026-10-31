<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * «Готовий грати зараз»: людина на годину-дві показує друзям, що вільна й шукає компанію.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ready_to_play', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->foreignId('game_id')->nullable()->constrained()->nullOnDelete();
            $table->string('note', 80)->nullable();
            $table->timestamp('until')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ready_to_play');
    }
};
