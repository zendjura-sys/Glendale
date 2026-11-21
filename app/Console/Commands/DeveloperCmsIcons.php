<?php

namespace App\Console\Commands;

use App\Support\Developer\CmsIcons;
use App\Support\Developer\CmsPlugins;
use Illuminate\Console\Command;

/** Завантажити фавікони рушіїв для каталогу плагінів (бракує або --force — усі). */
class DeveloperCmsIcons extends Command
{
    protected $signature = 'developers:cms-icons {--force : Оновити всі, навіть наявні}';

    protected $description = 'Фавікони CMS і форумів для каталогу плагінів «Розробникам»';

    public function handle(): int
    {
        foreach (CmsPlugins::all() as $key => $plugin) {
            if (! $this->option('force') && CmsIcons::url($key) !== null) {
                continue;
            }
            $ok = CmsIcons::fetch($key, (string) $plugin['site']);
            $this->line(($ok ? '✓ ' : '✗ ').$plugin['name']);
        }

        return self::SUCCESS;
    }
}
