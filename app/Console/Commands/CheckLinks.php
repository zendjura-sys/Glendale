<?php

namespace App\Console\Commands;

use App\Services\Quality\LinkChecker;
use Illuminate\Console\Command;

/** Нічна перевірка битих посилань і картинок (звіт — в адмінці «Биті посилання»). */
class CheckLinks extends Command
{
    protected $signature = 'gc:check-links {--limit=400}';

    protected $description = 'Перевірити порцію посилань і картинок на биті адреси';

    public function handle(LinkChecker $checker): int
    {
        $result = $checker->run(max(1, (int) $this->option('limit')));
        $this->info("Перевірено: {$result['checked']}, битих: {$result['broken']}");

        return self::SUCCESS;
    }
}
