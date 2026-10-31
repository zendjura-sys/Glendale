<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Журнал помилок для адмінки: однакові помилки групуються (fingerprint), рахується кількість.
        Schema::create('error_logs', function (Blueprint $table) {
            $table->id();
            $table->string('fingerprint', 40)->unique();
            $table->string('class', 200);
            $table->text('message');
            $table->string('file', 300)->nullable();
            $table->unsignedInteger('line')->nullable();
            $table->string('url', 500)->nullable();
            $table->string('method', 10)->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('count')->default(1);
            $table->timestamp('first_seen_at');
            $table->timestamp('last_seen_at')->index();
            $table->timestamp('resolved_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('error_logs');
    }
};
