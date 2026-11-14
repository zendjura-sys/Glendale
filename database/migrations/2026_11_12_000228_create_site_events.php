<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Сезонні події сайту: завдання на час події, спільна мета й нагорода-косметика. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_events', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 60)->unique();
            $table->string('title', 80);
            $table->string('description', 500)->nullable();
            $table->string('theme', 16)->default('none');
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->json('tasks');
            $table->string('goal_metric', 16)->nullable();
            $table->unsignedInteger('goal_target')->nullable();
            $table->json('reward');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['starts_at', 'ends_at']);
        });
        Schema::create('site_event_claims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('site_event_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->unique(['site_event_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_event_claims');
        Schema::dropIfExists('site_events');
    }
};
