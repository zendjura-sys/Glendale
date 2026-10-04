<?php

namespace App\Jobs;

use App\Services\I18n\CatalogTranslator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Автопереклад інтерфейсу на мову у фоні (кілька тисяч рядків — кілька хвилин).
 */
class TranslateLanguage implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 1800;

    public int $tries = 1;

    public function __construct(public string $locale, public bool $all = false) {}

    public function uniqueId(): string
    {
        return $this->locale;
    }

    public function handle(CatalogTranslator $translator): void
    {
        $translator->run($this->locale, $this->all);
    }
}
