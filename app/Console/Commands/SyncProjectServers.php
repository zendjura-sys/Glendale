<?php

namespace App\Console\Commands;

use App\Social\ProjectServers;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/** Автозаповнення серверів проєктів (назви, адреси, онлайн) з публічних списків. */
class SyncProjectServers extends Command
{
    protected $signature = 'projects:sync-servers';

    protected $description = 'Оновити сервери ігрових проєктів з майстер-списку RAGE MP';

    public function handle(): int
    {
        $projects = DB::table('game_projects')->where('servers_source', 'ragemp')->get();
        if ($projects->isEmpty()) {
            return self::SUCCESS;
        }
        $master = ProjectServers::rageMaster();
        if ($master === null) {
            $this->warn('Майстер-список RAGE MP недоступний.');

            return self::FAILURE;
        }
        foreach ($projects as $project) {
            $this->info("{$project->name}: серверів у списку — ".ProjectServers::sync($project, $master));
        }

        return self::SUCCESS;
    }
}
