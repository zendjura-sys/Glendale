<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('message_attachments', function (Blueprint $table) {
            $table->string('disk', 16)->default('public')->after('type');
            $table->string('name')->nullable()->after('path');
            $table->unsignedSmallInteger('duration')->nullable()->after('size');
            $table->json('meta')->nullable()->after('duration');
        });

        Schema::create('sticker_packs', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 40)->unique();
            $table->string('name', 80);
            $table->string('author', 80)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('stickers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sticker_pack_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->string('emoji', 16)->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stickers');
        Schema::dropIfExists('sticker_packs');

        Schema::table('message_attachments', function (Blueprint $table) {
            $table->dropColumn(['disk', 'name', 'duration', 'meta']);
        });
    }
};
