<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Кімнати, які адміністрація сайту додає в кожну сім’ю, і ранги, яким вони відкриті за замовчуванням.
        Schema::create('voice_room_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60);
            $table->json('ranks')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        // ranks: які ранги сім’ї (1–9) можуть зайти; null — усі учасники. Лідер заходить завжди.
        Schema::table('voice_rooms', function (Blueprint $table) {
            $table->json('ranks')->nullable()->after('position');
            $table->foreignId('template_id')->nullable()->after('ranks')->constrained('voice_room_templates')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('voice_rooms', function (Blueprint $table) {
            $table->dropConstrainedForeignId('template_id');
            $table->dropColumn('ranks');
        });
        Schema::dropIfExists('voice_room_templates');
    }
};
