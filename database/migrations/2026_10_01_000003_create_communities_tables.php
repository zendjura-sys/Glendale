<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('communities', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 32)->unique();
            $table->string('name', 100);
            $table->string('type', 16)->default('group');
            $table->string('privacy', 16)->default('open');
            $table->string('wall', 16)->default('open');
            $table->string('category', 32)->nullable()->index();
            $table->string('status', 140)->nullable();
            $table->text('description')->nullable();
            $table->string('website')->nullable();
            $table->string('city', 80)->nullable();
            $table->string('avatar_path')->nullable();
            $table->string('cover_path')->nullable();
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('members_count')->default(0);
            $table->boolean('is_verified')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->index('members_count');
        });

        Schema::create('community_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 16)->default('member');
            $table->string('status', 16)->default('active');
            $table->timestamps();

            $table->unique(['community_id', 'user_id']);
            $table->index(['user_id', 'status']);
            $table->index(['community_id', 'status', 'role']);
        });

        Schema::table('posts', function (Blueprint $table) {
            $table->boolean('as_community')->default(false)->after('wall_id');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('as_community');
        });
        Schema::dropIfExists('community_members');
        Schema::dropIfExists('communities');
    }
};
