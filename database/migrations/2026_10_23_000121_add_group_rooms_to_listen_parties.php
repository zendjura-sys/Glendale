<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Кімнати «Слухати разом» для сім’ї, клану чи спільноти: діджей, пропозиції в чергу, радіо.
        Schema::table('listen_parties', function (Blueprint $table) {
            // family | clan | community; порожньо — кімната з друзями за посиланням.
            $table->string('group_type', 16)->nullable()->after('host_id');
            $table->unsignedBigInteger('group_id')->nullable()->after('group_type');
            $table->string('title', 80)->nullable()->after('group_id');
            // Замість треку може грати радіостанція GameCon.
            $table->foreignId('station_id')->nullable()->after('track_id')->constrained('radio_stations')->nullOnDelete();
            // Черга з погодженням: слухачі пропонують, діджей вирішує.
            $table->boolean('moderated')->default(false)->after('shared_control');
            // Пропозиції: [{track_id|station_id, by}].
            $table->json('suggestions')->nullable()->after('queue');
            $table->index(['group_type', 'group_id', 'ended_at']);
        });

        Schema::table('listen_party_members', function (Blueprint $table) {
            $table->timestamp('kicked_at')->nullable();
        });

        // Легкий чат кімнати та реакції емодзі.
        Schema::create('listen_party_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('listen_party_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('emoji', 16)->nullable();
            $table->string('body', 500)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['listen_party_id', 'id']);
        });

        // Хто в групі може відкривати кімнати: усі (типово), лише адміністратори або ніхто.
        Schema::create('listen_room_policies', function (Blueprint $table) {
            $table->id();
            $table->string('group_type', 16);
            $table->unsignedBigInteger('group_id');
            $table->string('who', 16)->default('all');
            $table->timestamps();
            $table->unique(['group_type', 'group_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listen_room_policies');
        Schema::dropIfExists('listen_party_messages');
        Schema::table('listen_party_members', function (Blueprint $table) {
            $table->dropColumn('kicked_at');
        });
        Schema::table('listen_parties', function (Blueprint $table) {
            $table->dropIndex(['group_type', 'group_id', 'ended_at']);
            $table->dropConstrainedForeignId('station_id');
            $table->dropColumn(['group_type', 'group_id', 'title', 'moderated', 'suggestions']);
        });
    }
};
