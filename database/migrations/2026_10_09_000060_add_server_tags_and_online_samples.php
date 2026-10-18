<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gta_servers', function (Blueprint $table) {
            $table->json('tags')->nullable();
        });

        Schema::create('server_online_samples', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gta_server_id')->constrained()->cascadeOnDelete();
            $table->date('sampled_on');
            $table->unsignedInteger('players_online');
            $table->timestamps();
            $table->unique(['gta_server_id', 'sampled_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_online_samples');
        Schema::table('gta_servers', function (Blueprint $table) {
            $table->dropColumn('tags');
        });
    }
};
