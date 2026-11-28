<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** LiveCast: інтеграції Donatik/Donatello (API-токени, вебхуки) і meta донатів у чаті. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('livecast_integrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 16); // donatik | donatello
            $table->string('page_url', 500)->nullable();
            $table->text('api_token')->nullable(); // encrypted
            $table->text('webhook_key')->nullable(); // encrypted — X-Key / секрет колбеку
            $table->string('hook_id', 40)->unique();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'provider']);
        });

        Schema::table('livecast_messages', function (Blueprint $table) {
            $table->json('meta')->nullable()->after('gift_key');
        });
    }

    public function down(): void
    {
        Schema::table('livecast_messages', function (Blueprint $table) {
            $table->dropColumn('meta');
        });
        Schema::dropIfExists('livecast_integrations');
    }
};
