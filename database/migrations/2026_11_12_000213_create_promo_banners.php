<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Банери з A/B-тестами: кожна людина стабільно бачить один варіант; рахуються покази й кліки. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promo_banners', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80);
            $table->string('placement', 16)->default('feed');
            $table->string('status', 12)->default('draft');
            $table->foreignId('winner_id')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();
            $table->index(['placement', 'status']);
        });

        Schema::create('promo_banner_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promo_banner_id')->constrained()->cascadeOnDelete();
            $table->string('label', 2);
            $table->string('title', 80);
            $table->string('text', 200)->nullable();
            $table->string('cta', 30);
            $table->string('url', 300);
            $table->string('tone', 12)->default('indigo');
            $table->unsignedTinyInteger('weight')->default(50);
            $table->unsignedInteger('impressions')->default(0);
            $table->unsignedInteger('clicks')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promo_banner_variants');
        Schema::dropIfExists('promo_banners');
    }
};
