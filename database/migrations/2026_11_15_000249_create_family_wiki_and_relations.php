<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Вікі сім’ї (для учасників) і стосунки сімей на сервері: союзи й війни. */
    public function up(): void
    {
        Schema::create('family_wiki_pages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->string('slug', 80);
            $table->string('title', 120);
            $table->text('body')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['family_id', 'slug']);
        });

        Schema::create('family_relations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('other_family_id')->constrained('families')->cascadeOnDelete();
            $table->string('type', 12);
            $table->string('status', 12)->default('pending');
            $table->string('note', 300)->nullable();
            $table->foreignId('initiated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
            $table->index(['family_id', 'status']);
            $table->index(['other_family_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('family_relations');
        Schema::dropIfExists('family_wiki_pages');
    }
};
