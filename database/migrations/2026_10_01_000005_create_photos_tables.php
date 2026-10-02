<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('photo_albums', function (Blueprint $table) {
            $table->id();
            $table->morphs('owner');
            $table->string('title', 80);
            $table->string('description', 500)->nullable();
            $table->string('privacy', 16)->default('public');
            $table->boolean('comments_enabled')->default(true);
            $table->unsignedBigInteger('cover_photo_id')->nullable();
            $table->unsignedInteger('photos_count')->default(0);
            $table->timestamps();
        });

        Schema::create('photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('album_id')->constrained('photo_albums')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('path');
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->unsignedBigInteger('size')->nullable();
            $table->string('caption', 500)->nullable();
            $table->unsignedInteger('likes_count')->default(0);
            $table->unsignedInteger('comments_count')->default(0);
            $table->unsignedInteger('views_count')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['album_id', 'id']);
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->foreignId('post_id')->nullable()->change();
            $table->foreignId('photo_id')->nullable()->after('post_id')->constrained()->cascadeOnDelete();
            $table->index(['photo_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('photo_id');
        });

        Schema::dropIfExists('photos');
        Schema::dropIfExists('photo_albums');
    }
};
