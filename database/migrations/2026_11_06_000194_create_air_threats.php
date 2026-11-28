<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Повітряні цілі з відкритих зведень (Повітряні сили ЗСУ й канали моніторингу): приблизне місце, курс і час «згасання».
        Schema::create('air_threats', function (Blueprint $table) {
            $table->id();
            $table->string('type', 16);
            $table->string('region_slug', 32)->nullable();
            $table->string('place_name', 80)->nullable();
            $table->string('title', 300);
            $table->float('lat');
            $table->float('lng');
            $table->smallInteger('course_deg')->nullable();
            $table->smallInteger('speed_kmh')->default(0);
            $table->string('source_ref', 120)->nullable()->unique();
            // Канали, що підтвердили мітку, і упевненість 0–100 за їхньою вагою довіри.
            $table->json('sources')->nullable();
            $table->unsignedTinyInteger('confidence')->default(0);
            $table->timestamp('detected_at');
            $table->timestamp('expires_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('air_threats');
    }
};
