<?php

namespace App\Console\Commands;

use App\Services\I18n\CatalogTranslator;
use App\Support\I18n\Locales;
use Illuminate\Console\Command;

class I18nTranslate extends Command
{
    protected $signature = 'i18n:translate {locale? : Код мови; без нього — усі додані мови} {--all : Перекласти заново все, крім виправленого вручну}';

    protected $description = 'Докладає переклади нових рядків інтерфейсу через DeepL';

    public function handle(CatalogTranslator $translator, Locales $locales): int
    {
        $codes = $this->argument('locale') !== null
            ? [Locales::normalize((string) $this->argument('locale'))]
            : array_column($locales->configured(), 'code');
        foreach (array_filter($codes) as $code) {
            $result = $translator->run((string) $code, (bool) $this->option('all'));
            $this->line("{$code}: перекладено {$result['translated']}".($result['error'] ? " — {$result['error']}" : ''));
        }

        return self::SUCCESS;
    }
}
