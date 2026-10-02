<?php

namespace App\Console\Commands;

use App\Models\GtaServer;
use App\Services\Servers\ServerCatalog;
use App\Services\Servers\ServerDirectory;
use App\Services\Servers\ServerIconFetcher;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('servers:sync {--seed : Додати відсутні сервери базового списку} {--discover : Знайти нові українські сервери в майстер-листі RAGE:MP} {--icons : Оновити іконки старші за тиждень} {--all-icons : Перезавантажити всі іконки}')]
#[Description('Онлайн GTA-серверів, автопошук нових проєктів і підтягування іконок')]
class ServersSync extends Command
{
    public function handle(ServerDirectory $directory, ServerIconFetcher $icons, ServerCatalog $catalog): int
    {
        if ($this->option('seed')) {
            $this->info('Базовий список: +'.count($catalog->import()));
        }

        if ($this->option('discover')) {
            $found = $directory->discover();
            $this->info('Знайдено нових серверів: '.count($found));
            foreach ($found as $server) {
                $this->line("  • {$server->name} ({$server->connect})");
                $icons->fetch($server);
            }
        }

        $stats = $directory->refreshStats();
        $this->info("Онлайн оновлено: {$stats['updated']}, без даних: {$stats['failed']}");

        $query = GtaServer::query()->where('status', '!=', GtaServer::STATUS_REJECTED);
        if (! $this->option('all-icons')) {
            $query->where(fn ($q) => $q->whereNull('icon_path')->where(fn ($q) => $q->whereNull('icon_fetched_at')->orWhere('icon_fetched_at', '<', now()->subDay()))
                ->orWhere(fn ($q) => $q->when($this->option('icons'), fn ($q) => $q->where('icon_fetched_at', '<', now()->subWeek()), fn ($q) => $q->whereRaw('1 = 0'))));
        }
        foreach ($query->get() as $server) {
            if ($server->icon_source === 'upload' && ! $this->option('all-icons')) {
                continue;
            }
            $source = $icons->fetch($server);
            $this->line("  {$server->name}: ".($source ? "іконка з {$source}" : 'іконку не знайдено'));
        }

        return self::SUCCESS;
    }
}
