<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gta_servers', function (Blueprint $table) {
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
        });

        Schema::create('server_claims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('gta_server_id')->constrained()->cascadeOnDelete();
            $table->string('message', 500)->nullable();
            $table->string('status', 16)->default('pending');
            $table->timestamps();
            $table->unique(['user_id', 'gta_server_id']);
        });

        Schema::create('server_news', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gta_server_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();
            $table->index('gta_server_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_news');
        Schema::dropIfExists('server_claims');
        Schema::table('gta_servers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('owner_id');
        });
    }
};
