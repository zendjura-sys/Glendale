<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Каталог мультиплеєрних ігор (ПК, мобільні, консолі): стартовий список + щоденне оновлення з RAWG.
        Schema::create('games', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 120)->unique();
            $table->string('name', 160);
            $table->char('letter', 1)->index();
            $table->string('category', 16)->index();
            $table->json('platforms')->nullable();
            $table->json('genres')->nullable();
            $table->json('links')->nullable();
            $table->string('cover')->nullable();
            $table->date('released')->nullable();
            $table->decimal('rating', 3, 2)->nullable();
            $table->unsignedInteger('popularity')->default(0)->index();
            $table->unsignedBigInteger('rawg_id')->nullable()->unique();
            $table->timestamp('links_checked_at')->nullable();
            $table->boolean('is_published')->default(true);
            $table->timestamps();
            $table->index(['category', 'letter']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('games');
    }
};
