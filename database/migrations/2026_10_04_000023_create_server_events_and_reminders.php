<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Події серверів GTA: турніри, загальносерверні заходи, збори сімей; «піду / не піду».
        Schema::create('server_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('gta_server_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('family_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 120);
            $table->string('type', 20);
            $table->string('description', 1000)->nullable();
            $table->timestamp('starts_at');
            $table->boolean('is_official')->default(false);
            $table->timestamp('reminded_at')->nullable();
            $table->timestamps();
            $table->index(['gta_server_id', 'starts_at']);
        });

        Schema::create('server_event_rsvps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status', 10);
            $table->unique(['server_event_id', 'user_id']);
        });

        // Нагадування за пів години до початку — щоб не надсилати двічі.
        Schema::table('family_events', function (Blueprint $table) {
            $table->timestamp('reminded_at')->nullable();
        });
        Schema::table('clan_events', function (Blueprint $table) {
            $table->timestamp('reminded_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('clan_events', fn (Blueprint $table) => $table->dropColumn('reminded_at'));
        Schema::table('family_events', fn (Blueprint $table) => $table->dropColumn('reminded_at'));
        Schema::dropIfExists('server_event_rsvps');
        Schema::dropIfExists('server_events');
    }
};
