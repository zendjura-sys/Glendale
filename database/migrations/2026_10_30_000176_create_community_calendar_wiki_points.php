<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Календар спільноти: події з «Буду / Можливо».
        Schema::create('community_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 120);
            $table->text('description')->nullable();
            $table->string('place', 120)->nullable();
            $table->timestamp('starts_at')->index();
            $table->timestamp('ends_at')->nullable();
            $table->unsignedInteger('going_count')->default(0);
            $table->timestamps();
        });
        Schema::create('community_event_rsvps', function (Blueprint $table) {
            $table->foreignId('event_id')->constrained('community_events')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status', 8);
            $table->timestamps();
            $table->primary(['event_id', 'user_id']);
        });

        // Спільні історії події: історії учасників, привʼязані до події.
        Schema::table('stories', function (Blueprint $table) {
            $table->foreignId('community_event_id')->nullable()->constrained('community_events')->nullOnDelete();
        });

        // Вікі спільноти з історією правок.
        Schema::create('community_wiki_pages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_id')->constrained()->cascadeOnDelete();
            $table->string('slug', 60);
            $table->string('title', 120);
            $table->text('body');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['community_id', 'slug']);
        });
        Schema::create('community_wiki_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('page_id')->constrained('community_wiki_pages')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 120);
            $table->text('body');
            $table->timestamp('created_at')->nullable();
        });

        // Бали учасника спільноти за активність.
        Schema::table('community_members', function (Blueprint $table) {
            $table->integer('points')->default(0);
        });
        Schema::table('communities', function (Blueprint $table) {
            $table->boolean('wiki_open')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('communities', fn (Blueprint $table) => $table->dropColumn('wiki_open'));
        Schema::table('community_members', fn (Blueprint $table) => $table->dropColumn('points'));
        Schema::dropIfExists('community_wiki_revisions');
        Schema::dropIfExists('community_wiki_pages');
        Schema::table('stories', function (Blueprint $table) {
            $table->dropConstrainedForeignId('community_event_id');
        });
        Schema::dropIfExists('community_event_rsvps');
        Schema::dropIfExists('community_events');
    }
};
