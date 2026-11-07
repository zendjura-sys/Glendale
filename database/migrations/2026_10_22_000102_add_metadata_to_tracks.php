<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Автоматичні метадані треку: ідентифікатори MusicBrainz (запис, реліз, група релізів, виконавець),
 * головне джерело, походження кожного поля ({поле: {source, score}}) і час останнього збагачення.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tracks', function (Blueprint $table) {
            $table->uuid('mbid')->nullable()->after('quality');
            $table->uuid('release_mbid')->nullable()->after('mbid');
            $table->uuid('release_group_mbid')->nullable()->after('release_mbid');
            $table->uuid('artist_mbid')->nullable()->after('release_group_mbid');
            $table->string('metadata_source', 20)->nullable()->after('artist_mbid');
            $table->json('metadata_meta')->nullable()->after('metadata_source');
            $table->timestamp('enriched_at')->nullable()->after('metadata_meta');
            $table->index('enriched_at');
        });
    }

    public function down(): void
    {
        Schema::table('tracks', function (Blueprint $table) {
            $table->dropIndex(['enriched_at']);
            $table->dropColumn(['mbid', 'release_mbid', 'release_group_mbid', 'artist_mbid', 'metadata_source', 'metadata_meta', 'enriched_at']);
        });
    }
};
