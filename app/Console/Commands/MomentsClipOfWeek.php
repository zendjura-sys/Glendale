<?php

namespace App\Console\Commands;

use App\Services\Moments\ClipOfWeek;
use App\Support\Modules\ModuleManager;
use App\Support\Plugins\Plugins;
use Illuminate\Console\Command;

/** Щопонеділка: «Кліп тижня» минулого тижня — в архів, автору — сповіщення. */
class MomentsClipOfWeek extends Command
{
    protected $signature = 'moments:clip-of-week';

    protected $description = 'Обрати «Кліп тижня» за минулий тиждень';

    public function handle(ClipOfWeek $clips, Plugins $plugins, ModuleManager $modules): int
    {
        if (! $plugins->on('clip_of_week') || ! $modules->enabled('moments')) {
            return self::SUCCESS;
        }
        $moment = $clips->crown();
        $this->info($moment ? "Кліп тижня: «{$moment->title}»" : 'Переможця немає або вже обрано.');

        return self::SUCCESS;
    }
}
