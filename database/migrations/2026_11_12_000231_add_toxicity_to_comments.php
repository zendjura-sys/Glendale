<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Автоприховування токсичних коментарів: оцінка, коли й чому приховано, хто повернув. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->unsignedTinyInteger('toxicity')->nullable()->after('sticker');
            $table->timestamp('hidden_at')->nullable()->after('toxicity');
            $table->string('hidden_reason', 160)->nullable()->after('hidden_at');
            $table->foreignId('restored_by')->nullable()->after('hidden_reason')->constrained('users')->nullOnDelete();
            $table->index('hidden_at');
        });
    }

    public function down(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('restored_by');
            $table->dropIndex(['hidden_at']);
            $table->dropColumn(['toxicity', 'hidden_at', 'hidden_reason']);
        });
    }
};
