<?php

namespace App\Console\Commands;

use App\Social\ProjectLogos;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Довідник проєктів з ілюстраціями: підтягнути логотипи з офіційних сайтів
 * проєктів. Деплой запускає без --force — лише для проєктів без логотипу,
 * тож завантажене адміном вручну не перезаписується.
 */
class FetchProjectLogos extends Command
{
    protected $signature = 'projects:fetch-logos {--force : Оновити й наявні логотипи}';

    protected $description = 'Завантажити логотипи ігрових проєктів з їхніх сайтів';

    public function handle(): int
    {
        $projects = DB::table('game_projects')->whereNotNull('website')->where('website', '!=', '')
            ->when(! $this->option('force'), fn ($q) => $q->whereNull('logo_path'))->get();

        foreach ($projects as $project) {
            $path = ProjectLogos::fetch($project);
            $path ? $this->info("{$project->name}: {$path}") : $this->warn("{$project->name}: не вдалося ({$project->website})");
        }

        return self::SUCCESS;
    }
}
