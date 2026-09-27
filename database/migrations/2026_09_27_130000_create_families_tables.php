<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Система управління родинами (публічно — «Моя родина») і союзи родин.
 *
 * Будь-хто реєструє родину → pending → адміністратор платформи
 * підтверджує (verified) або відхиляє (rejected, з поясненням).
 * Союз створює лідер верифікованої родини; союз теж проходить перевірку.
 * Monsory — перша, одразу верифікована родина з наявними учасниками.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('families', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60);
            $table->string('tag', 8)->nullable();
            $table->string('project', 60)->default('');
            $table->string('server', 60)->default('');
            $table->text('description')->nullable();
            $table->string('avatar_path')->nullable();
            $table->string('cover_path')->nullable();
            $table->string('discord_url')->nullable();
            $table->string('telegram_url')->nullable();
            // Доказ для перевірки (скріншот родини в грі) — бачать лише
            // лідер і адміністрація.
            $table->string('proof_path')->nullable();
            $table->foreignId('leader_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 12)->default('pending')->index();
            $table->text('review_note')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
        });

        Schema::create('family_members', function (Blueprint $table) {
            $table->foreignId('family_id')->constrained('families')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 10)->default('member');
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['family_id', 'user_id']);
            $table->index('user_id');
        });

        Schema::create('family_join_requests', function (Blueprint $table) {
            $table->foreignId('family_id')->constrained('families')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('message', 300)->default('');
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['family_id', 'user_id']);
        });

        Schema::create('family_unions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60);
            $table->string('tag', 8)->nullable();
            $table->text('description')->nullable();
            $table->string('avatar_path')->nullable();
            $table->foreignId('founder_family_id')->constrained('families')->cascadeOnDelete();
            $table->string('status', 12)->default('pending')->index();
            $table->text('review_note')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
        });

        // Родина — щонайбільше в одному союзі (перевіряється в коді).
        Schema::create('family_union_members', function (Blueprint $table) {
            $table->foreignId('union_id')->constrained('family_unions')->cascadeOnDelete();
            $table->foreignId('family_id')->constrained('families')->cascadeOnDelete();
            $table->string('role', 10)->default('member');
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['union_id', 'family_id']);
            $table->index('family_id');
        });

        Schema::create('family_union_requests', function (Blueprint $table) {
            $table->foreignId('union_id')->constrained('family_unions')->cascadeOnDelete();
            $table->foreignId('family_id')->constrained('families')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['union_id', 'family_id']);
        });

        Schema::table('social_notifications', function (Blueprint $table) {
            $table->foreignId('family_id')->nullable()->after('group_id')->constrained('families')->cascadeOnDelete();
            $table->foreignId('union_id')->nullable()->after('family_id')->constrained('family_unions')->cascadeOnDelete();
        });

        $this->grantPermission();
        $this->seedMonsory();
    }

    private function grantPermission(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }
        $permission = Permission::firstOrCreate(['name' => 'families.manage', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web'])->givePermissionTo($permission);
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /** Monsory — перша родина платформи: одразу верифікована, з наявним складом. */
    private function seedMonsory(): void
    {
        $members = User::query()->where('is_shadow', false)->whereNotNull('position_key')->orderBy('id')->get();
        if ($members->isEmpty()) {
            return;
        }

        $admins = User::role('admin')->pluck('id')->all();
        $leader = $members->first(fn ($u) => in_array($u->id, $admins, true)) ?? $members->first();

        $familyId = DB::table('families')->insertGetId([
            'name' => 'Monsory',
            'tag' => 'MNS',
            'project' => 'Verba Online',
            'server' => '',
            'description' => 'Перша родина платформи.',
            'leader_id' => $leader->id,
            'status' => 'verified',
            'verified_at' => now(),
            'reviewed_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('family_members')->insert($members->map(fn ($u) => [
            'family_id' => $familyId,
            'user_id' => $u->id,
            'role' => $u->id === $leader->id ? 'leader' : (in_array($u->id, $admins, true) ? 'deputy' : 'member'),
            'created_at' => $u->created_at ?? now(),
        ])->all());
    }

    public function down(): void
    {
        Schema::table('social_notifications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('union_id');
            $table->dropConstrainedForeignId('family_id');
        });
        Schema::dropIfExists('family_union_requests');
        Schema::dropIfExists('family_union_members');
        Schema::dropIfExists('family_unions');
        Schema::dropIfExists('family_join_requests');
        Schema::dropIfExists('family_members');
        Schema::dropIfExists('families');
    }
};
