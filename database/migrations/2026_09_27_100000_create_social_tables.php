<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Соцмережа платформи (перенесено з Glendale): стіна й стрічка, лайки,
 * коментарі, репости, друзі, спільноти, фото, сповіщення, скарги й
 * оголошення. Користувачі — ті самі users, що й у системі родини.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('cover_path')->nullable()->after('avatar_path');
            $table->string('status', 140)->default('')->after('cover_path');
            $table->text('bio')->nullable()->after('status');
            $table->string('city', 80)->default('')->after('bio');
        });

        Schema::create('social_groups', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->string('avatar_path')->nullable();
            $table->string('cover_path')->nullable();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('privacy', 10)->default('open');
            $table->timestamps();
        });

        Schema::create('social_group_members', function (Blueprint $table) {
            $table->foreignId('group_id')->constrained('social_groups')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 10)->default('member');
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['group_id', 'user_id']);
            $table->index('user_id');
        });

        Schema::create('social_group_requests', function (Blueprint $table) {
            $table->foreignId('group_id')->constrained('social_groups')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['group_id', 'user_id']);
        });

        Schema::create('social_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->string('owner_type', 10);
            $table->unsignedBigInteger('owner_id');
            $table->boolean('from_group')->default(false);
            $table->text('text')->nullable();
            $table->string('image_path')->nullable();
            $table->foreignId('repost_of')->nullable()->constrained('social_posts')->nullOnDelete();
            $table->string('spotify', 300)->default('');
            $table->timestamps();
            $table->index(['owner_type', 'owner_id', 'id']);
            $table->index(['author_id', 'id']);
        });

        Schema::create('social_likes', function (Blueprint $table) {
            $table->foreignId('post_id')->constrained('social_posts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['post_id', 'user_id']);
        });

        Schema::create('social_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('social_posts')->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->text('text');
            $table->timestamps();
            $table->index(['post_id', 'id']);
        });

        // Дружба зберігається в обидва боки (A→B і B→A) — вибірки «друзі
        // людини» стають простим WHERE user_id = ?.
        Schema::create('social_friends', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('friend_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['user_id', 'friend_id']);
        });

        Schema::create('social_friend_requests', function (Blueprint $table) {
            $table->foreignId('from_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('to_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['from_id', 'to_id']);
            $table->index('to_id');
        });

        Schema::create('social_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('path');
            $table->string('album', 20)->default('uploaded');
            $table->timestamps();
            $table->index(['user_id', 'id']);
        });

        Schema::create('social_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('actor_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 30);
            $table->foreignId('post_id')->nullable()->constrained('social_posts')->cascadeOnDelete();
            $table->foreignId('group_id')->nullable()->constrained('social_groups')->cascadeOnDelete();
            $table->string('text', 200)->default('');
            $table->boolean('is_read')->default(false);
            $table->timestamp('created_at')->useCurrent();
            $table->index(['user_id', 'id']);
            $table->index(['user_id', 'is_read']);
        });

        Schema::create('social_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
            $table->string('target_type', 20);
            $table->unsignedBigInteger('target_id');
            $table->string('category', 30);
            $table->text('description')->nullable();
            $table->string('status', 12)->default('open');
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('resolution')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'id']);
        });

        Schema::create('social_announcements', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('body')->nullable();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_announcements');
        Schema::dropIfExists('social_reports');
        Schema::dropIfExists('social_notifications');
        Schema::dropIfExists('social_photos');
        Schema::dropIfExists('social_friend_requests');
        Schema::dropIfExists('social_friends');
        Schema::dropIfExists('social_comments');
        Schema::dropIfExists('social_likes');
        Schema::dropIfExists('social_posts');
        Schema::dropIfExists('social_group_requests');
        Schema::dropIfExists('social_group_members');
        Schema::dropIfExists('social_groups');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['cover_path', 'status', 'bio', 'city']);
        });
    }
};
