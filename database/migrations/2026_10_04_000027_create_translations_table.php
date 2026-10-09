<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Переклади інтерфейсу: джерело — українська, ключ — сам текст (sha1 для індексу).
        Schema::create('translations', function (Blueprint $table) {
            $table->id();
            $table->string('locale', 16);
            $table->char('hash', 40);
            $table->text('source');
            $table->text('value');
            // Виправлено вручну в адмінці — автопереклад не перезаписує.
            $table->boolean('is_manual')->default(false);
            $table->timestamps();
            $table->unique(['locale', 'hash']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('locale', 16)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('locale'));
        Schema::dropIfExists('translations');
    }
};
