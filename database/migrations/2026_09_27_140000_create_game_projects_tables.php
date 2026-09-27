<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Довідник ігрових проєктів і серверів — усі на одному сайті GameConnect.
 * Родина обирає проєкт і сервер зі списку; якщо потрібного немає, гравець
 * додає свій (approved = false), і він підтверджується разом із родиною.
 * Повні списки серверів ведуться в адмінці (Родини та союзи → Проєкти).
 */
return new class extends Migration
{
    /** Стартові проєкти. Сервери не вигадуємо — їх додають в адмінці чи з форми. */
    private const PROJECTS = ['Arizona Online', 'Online UA', 'Verba Online', 'Quant RP', 'Nexus RP'];

    public function up(): void
    {
        Schema::create('game_projects', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60)->unique();
            $table->boolean('approved')->default(true);
            $table->unsignedSmallInteger('sort')->default(100);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('game_servers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('game_projects')->cascadeOnDelete();
            $table->string('name', 60);
            $table->boolean('approved')->default(true);
            $table->unsignedSmallInteger('sort')->default(100);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['project_id', 'name']);
        });

        Schema::table('families', function (Blueprint $table) {
            $table->foreignId('project_id')->nullable()->after('tag')->constrained('game_projects')->nullOnDelete();
            $table->foreignId('server_id')->nullable()->after('project_id')->constrained('game_servers')->nullOnDelete();
        });

        foreach (self::PROJECTS as $i => $name) {
            DB::table('game_projects')->insert(['name' => $name, 'sort' => $i + 1, 'created_at' => now(), 'updated_at' => now()]);
        }

        // Наявні родини (Monsory тощо) — прив'язати до довідника.
        foreach (DB::table('families')->get() as $family) {
            if ($family->project === '') {
                continue;
            }
            $projectId = DB::table('game_projects')->whereRaw('LOWER(name) = ?', [mb_strtolower($family->project)])->value('id')
                ?? DB::table('game_projects')->insertGetId(['name' => $family->project, 'created_at' => now(), 'updated_at' => now()]);
            $serverId = null;
            if ($family->server !== '') {
                $serverId = DB::table('game_servers')->where('project_id', $projectId)->whereRaw('LOWER(name) = ?', [mb_strtolower($family->server)])->value('id')
                    ?? DB::table('game_servers')->insertGetId(['project_id' => $projectId, 'name' => $family->server, 'created_at' => now(), 'updated_at' => now()]);
            }
            DB::table('families')->where('id', $family->id)->update(['project_id' => $projectId, 'server_id' => $serverId]);
        }
    }

    public function down(): void
    {
        Schema::table('families', function (Blueprint $table) {
            $table->dropConstrainedForeignId('server_id');
            $table->dropConstrainedForeignId('project_id');
        });
        Schema::dropIfExists('game_servers');
        Schema::dropIfExists('game_projects');
    }
};
