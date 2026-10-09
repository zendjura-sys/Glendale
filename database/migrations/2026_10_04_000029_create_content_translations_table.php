<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // «Перекласти» під записами, коментарями й повідомленнями: переклад кешується на мову й версію тексту.
        Schema::create('content_translations', function (Blueprint $table) {
            $table->id();
            $table->string('type', 16);
            $table->unsignedBigInteger('item_id');
            $table->string('locale', 16);
            $table->char('hash', 40);
            $table->text('text');
            $table->string('source_lang', 8)->nullable();
            $table->timestamps();
            $table->unique(['type', 'item_id', 'locale', 'hash']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_translations');
    }
};
