<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Журнал дій модераторів спільноти + «погодитися з правилами» при вступі. */
    public function up(): void
    {
        Schema::create('community_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 40);
            $table->foreignId('target_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('note', 300)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['community_id', 'id']);
        });
        Schema::table('communities', function (Blueprint $table) {
            $table->boolean('rules_accept')->default(false)->after('rules');
        });
    }

    public function down(): void
    {
        Schema::table('communities', function (Blueprint $table) {
            $table->dropColumn('rules_accept');
        });
        Schema::dropIfExists('community_logs');
    }
};
