<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('family_events', function (Blueprint $table) {
            $table->unsignedSmallInteger('capacity')->nullable()->after('reward');
            $table->string('cover_path')->nullable()->after('capacity');
            $table->string('checkin_code', 6)->nullable()->after('cover_path');
            $table->foreignId('album_id')->nullable()->after('checkin_code')->constrained('photo_albums')->nullOnDelete();
        });

        Schema::table('clan_events', function (Blueprint $table) {
            $table->string('cover_path')->nullable()->after('description');
        });

        Schema::table('families', function (Blueprint $table) {
            $table->timestamp('season_started_at')->nullable();
        });

        Schema::create('family_seasons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('number');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at');
            $table->json('top');
            $table->timestamps();
            $table->unique(['family_id', 'number']);
        });

        // Хто вже отримав нагадування з певним запасом часу (10 хв, пів години, година, доба).
        Schema::create('event_reminder_log', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 10);
            $table->unsignedBigInteger('event_id');
            $table->unsignedSmallInteger('lead_minutes');
            $table->timestamp('created_at');
            $table->unique(['kind', 'event_id', 'lead_minutes']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_reminder_log');
        Schema::dropIfExists('family_seasons');
        Schema::table('families', fn (Blueprint $table) => $table->dropColumn('season_started_at'));
        Schema::table('clan_events', fn (Blueprint $table) => $table->dropColumn('cover_path'));
        Schema::table('family_events', function (Blueprint $table) {
            $table->dropConstrainedForeignId('album_id');
            $table->dropColumn(['capacity', 'cover_path', 'checkin_code']);
        });
    }
};
