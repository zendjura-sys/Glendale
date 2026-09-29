<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cinema_titles', function (Blueprint $table) {
            $table->string('kodik_id', 80)->nullable()->index()->after('imdb_id');
            $table->string('kinopoisk_id', 32)->nullable()->index()->after('kodik_id');
            $table->timestamp('kodik_synced_at')->nullable()->after('kodik_checked_at');
        });

        Schema::create('cinema_kodik_sources', function (Blueprint $table) {
            $table->id();
            $table->foreignId('title_id')->constrained('cinema_titles')->cascadeOnDelete();
            $table->string('kodik_id', 80)->index();
            $table->string('content_type', 40)->nullable();
            $table->string('translation_id', 40)->default('0');
            $table->string('translation_title')->nullable();
            $table->string('translation_type', 40)->nullable();
            $table->string('quality', 80)->nullable();
            $table->string('link');
            $table->unsignedSmallInteger('last_season')->nullable();
            $table->unsignedSmallInteger('last_episode')->nullable();
            $table->json('availability')->nullable();
            $table->json('material')->nullable();
            $table->timestamp('source_updated_at')->nullable();
            $table->char('payload_hash', 64)->nullable()->index();
            $table->boolean('is_available')->default(true)->index();
            $table->timestamps();
            $table->unique(['kodik_id', 'translation_id'], 'cinema_kodik_source_identity_unique');
            $table->index(['title_id', 'is_available']);
        });

        Schema::create('cinema_sync_runs', function (Blueprint $table) {
            $table->id();
            $table->string('source', 32)->default('kodik')->index();
            $table->string('mode', 32)->index();
            $table->string('status', 32)->default('queued')->index();
            $table->string('initiator', 32)->default('scheduler');
            $table->foreignId('initiated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('cursor_before')->nullable();
            $table->text('cursor_after')->nullable();
            $table->json('counters')->nullable();
            $table->string('error_summary')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
            $table->index(['source', 'mode', 'status']);
        });

        Schema::create('cinema_sync_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('run_id')->constrained('cinema_sync_runs')->cascadeOnDelete();
            $table->foreignId('title_id')->nullable()->constrained('cinema_titles')->cascadeOnDelete();
            $table->string('action', 48)->index();
            $table->string('status', 32)->index();
            $table->json('identifiers')->nullable();
            $table->json('context')->nullable();
            $table->string('message')->nullable();
            $table->timestamps();
            $table->index(['run_id', 'status']);
            $table->index(['title_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cinema_sync_events');
        Schema::dropIfExists('cinema_sync_runs');
        Schema::dropIfExists('cinema_kodik_sources');

        Schema::table('cinema_titles', function (Blueprint $table) {
            $table->dropIndex(['kodik_id']);
            $table->dropIndex(['kinopoisk_id']);
            $table->dropColumn(['kodik_id', 'kinopoisk_id', 'kodik_synced_at']);
        });
    }
};
