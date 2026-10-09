<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->string('alt', 200)->nullable();
            $table->boolean('is_sensitive')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->dropColumn(['alt', 'is_sensitive']);
        });
    }
};
