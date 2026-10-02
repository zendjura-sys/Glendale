<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
| Усі грошові поля — у копійках внутрішньої валюти сім’ї (₴).
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('discord_id', 32)->nullable()->unique()->after('email');
            $table->string('discord_username', 64)->nullable()->after('discord_id');
        });

        Schema::create('families', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_id')->nullable()->constrained('gta_servers')->nullOnDelete();
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('slug', 60)->unique();
            $table->string('name', 60);
            $table->string('tag', 8);
            $table->string('logo_path')->nullable();
            $table->string('cover_path')->nullable();
            $table->string('description', 2000)->nullable();
            $table->string('status', 24)->default('pending_verification')->index();
            $table->string('status_reason', 300)->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->bigInteger('treasury')->default(0);
            $table->json('settings')->nullable();
            $table->json('rank_titles')->nullable();
            $table->json('permissions')->nullable();
            $table->text('webhooks')->nullable();
            $table->foreignId('conversation_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_recruiting')->default(true);
            $table->unsignedInteger('members_count')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['server_id', 'tag']);
        });

        Schema::create('family_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('rp_nickname', 40);
            $table->string('static_id', 20);
            $table->unsignedTinyInteger('rank')->default(1);
            $table->string('duties', 160)->nullable();
            $table->bigInteger('balance')->default(0);
            $table->string('status', 12)->default('pending');
            $table->string('application_note', 1000)->nullable();
            $table->timestamp('joined_at')->nullable();
            $table->timestamp('left_at')->nullable();
            $table->timestamps();

            $table->unique(['family_id', 'user_id']);
            $table->unique(['family_id', 'static_id']);
            $table->unique(['family_id', 'rp_nickname']);
            $table->index(['family_id', 'status', 'rank']);
        });

        Schema::create('family_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->string('type', 16);
            $table->foreignId('submitter_id')->constrained('family_members')->cascadeOnDelete();
            $table->foreignId('beneficiary_id')->constrained('family_members')->cascadeOnDelete();
            $table->date('event_date');
            $table->json('data')->nullable();
            $table->string('description', 2000)->nullable();
            $table->string('status', 12)->default('pending');
            $table->bigInteger('reward')->default(0);
            $table->unsignedInteger('points')->default(0);
            $table->json('flags')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('family_members')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('review_comment', 500)->nullable();
            $table->timestamps();

            $table->index(['family_id', 'status', 'id']);
            $table->index(['beneficiary_id', 'type', 'event_date']);
        });

        Schema::create('family_report_proofs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained('family_reports')->cascadeOnDelete();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->char('sha256', 64);
            // 64-бітний dHash у hex — знаходить пересжаті й обрізані копії скріншотів.
            $table->char('phash', 16)->nullable();
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->unsignedInteger('size')->nullable();
            $table->timestamps();

            $table->index(['family_id', 'sha256']);
            $table->index(['family_id', 'phash']);
        });

        Schema::create('family_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('member_id')->nullable()->constrained('family_members')->cascadeOnDelete();
            $table->string('type', 24);
            $table->bigInteger('amount')->default(0);
            $table->bigInteger('balance_after')->nullable();
            $table->bigInteger('treasury_delta')->default(0);
            $table->bigInteger('treasury_after')->nullable();
            $table->foreignId('actor_id')->nullable()->constrained('family_members')->nullOnDelete();
            $table->string('comment', 500)->nullable();
            $table->nullableMorphs('subject');
            $table->timestamp('created_at')->nullable();

            $table->index(['family_id', 'created_at']);
            $table->index(['member_id', 'created_at']);
        });

        Schema::create('family_cashouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('family_members')->cascadeOnDelete();
            $table->bigInteger('amount');
            $table->string('status', 12)->default('pending');
            $table->string('note', 300)->nullable();
            $table->foreignId('processed_by')->nullable()->constrained('family_members')->nullOnDelete();
            $table->timestamp('processed_at')->nullable();
            $table->string('proof_path')->nullable();
            $table->string('process_comment', 300)->nullable();
            $table->timestamps();

            $table->index(['family_id', 'status']);
        });

        Schema::create('family_deposits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('family_members')->cascadeOnDelete();
            $table->bigInteger('amount');
            $table->string('period', 8);
            $table->unsignedSmallInteger('periods');
            // Ставка за період у базисних пунктах (1% = 100).
            $table->unsignedInteger('rate_bp');
            $table->bigInteger('payout');
            $table->string('status', 10)->default('active');
            $table->timestamp('matures_at');
            $table->timestamp('closed_at')->nullable();
            $table->bigInteger('paid')->nullable();
            $table->timestamps();

            $table->index(['status', 'matures_at']);
            $table->index(['family_id', 'member_id']);
        });

        Schema::create('family_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->string('category', 12);
            $table->string('name', 60);
            $table->string('unit', 12)->default('шт');
            $table->integer('quantity')->default(0);
            $table->unsignedInteger('hourly_quota')->nullable();
            $table->unsignedInteger('min_stock')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('is_archived')->default(false);
            $table->timestamps();
        });

        Schema::create('family_item_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->constrained('family_items')->cascadeOnDelete();
            $table->foreignId('member_id')->nullable()->constrained('family_members')->nullOnDelete();
            $table->string('action', 8);
            $table->integer('quantity');
            $table->integer('quantity_after');
            $table->string('proof_path')->nullable();
            $table->string('comment', 300)->nullable();
            $table->boolean('is_suspicious')->default(false);
            $table->timestamp('created_at')->nullable();

            $table->index(['family_id', 'created_at']);
            $table->index(['item_id', 'member_id', 'created_at']);
        });

        Schema::create('family_punishments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('family_members')->cascadeOnDelete();
            $table->foreignId('issuer_id')->nullable()->constrained('family_members')->nullOnDelete();
            $table->string('type', 12);
            $table->string('reason', 500);
            $table->bigInteger('amount')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->boolean('is_auto')->default(false);
            $table->timestamp('revoked_at')->nullable();
            $table->foreignId('revoked_by')->nullable()->constrained('family_members')->nullOnDelete();
            $table->string('revoke_reason', 300)->nullable();
            $table->timestamps();

            $table->index(['family_id', 'member_id', 'type']);
        });

        Schema::create('family_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('family_members')->nullOnDelete();
            $table->string('title', 120);
            $table->string('type', 12)->default('meeting');
            $table->string('description', 1000)->nullable();
            $table->timestamp('starts_at');
            $table->unsignedInteger('points')->default(0);
            $table->bigInteger('reward')->default(0);
            $table->string('status', 10)->default('planned');
            $table->timestamps();

            $table->index(['family_id', 'starts_at']);
        });

        Schema::create('family_event_attendance', function (Blueprint $table) {
            $table->id();
            $table->foreignId('event_id')->constrained('family_events')->cascadeOnDelete();
            $table->foreignId('member_id')->constrained('family_members')->cascadeOnDelete();
            $table->string('status', 10)->default('going');
            $table->timestamps();

            $table->unique(['event_id', 'member_id']);
        });

        Schema::create('family_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('actor_member_id')->nullable()->constrained('family_members')->nullOnDelete();
            $table->foreignId('target_member_id')->nullable()->constrained('family_members')->nullOnDelete();
            $table->string('action', 40);
            $table->json('details')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['family_id', 'id']);
            $table->index(['family_id', 'action']);
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->foreignId('family_id')->nullable()->after('owner_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('family_id');
        });
        Schema::table('families', function (Blueprint $table) {
            $table->dropConstrainedForeignId('conversation_id');
        });
        Schema::dropIfExists('family_audit_logs');
        Schema::dropIfExists('family_event_attendance');
        Schema::dropIfExists('family_events');
        Schema::dropIfExists('family_punishments');
        Schema::dropIfExists('family_item_logs');
        Schema::dropIfExists('family_items');
        Schema::dropIfExists('family_deposits');
        Schema::dropIfExists('family_cashouts');
        Schema::dropIfExists('family_transactions');
        Schema::dropIfExists('family_report_proofs');
        Schema::dropIfExists('family_reports');
        Schema::dropIfExists('family_members');
        Schema::dropIfExists('families');
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['discord_id']);
            $table->dropColumn(['discord_id', 'discord_username']);
        });
    }
};
