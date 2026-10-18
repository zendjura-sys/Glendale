<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->json('card')->nullable();
        });

        Schema::create('follows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 16);
            $table->unsignedBigInteger('subject_id');
            $table->timestamps();
            $table->unique(['user_id', 'kind', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('follows');
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('card');
        });
    }
};
