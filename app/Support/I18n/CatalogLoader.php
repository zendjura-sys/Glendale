<?php

namespace App\Support\I18n;

use Illuminate\Contracts\Translation\Loader;

/**
 * Повідомлення Laravel (валідація, вхід, паролі) для мов без власних файлів:
 * беремо українські з lang/uk і підставляємо переклади з каталогу. Чого немає — Laravel
 * візьме з запасної мови (англійської).
 */
class CatalogLoader implements Loader
{
    public function __construct(private readonly Loader $inner) {}

    /**
     * @return array<array-key, mixed>
     */
    public function load($locale, $group, $namespace = null): array
    {
        $lines = $this->inner->load($locale, $group, $namespace);
        if ($lines !== [] || $group === '*' || ($namespace !== null && $namespace !== '*') || in_array($locale, [Locales::SOURCE, 'en'], true)) {
            return $lines;
        }
        $source = $this->inner->load(Locales::SOURCE, $group, $namespace);

        return $source === [] ? [] : $this->map($source, (string) $locale);
    }

    /**
     * @param  array<array-key, mixed>  $lines
     * @return array<array-key, mixed>
     */
    private function map(array $lines, string $locale): array
    {
        $translations = app(Translations::class);
        $out = [];
        foreach ($lines as $key => $value) {
            if (is_array($value)) {
                $nested = $this->map($value, $locale);
                if ($nested !== []) {
                    $out[$key] = $nested;
                }
            } elseif (is_string($value)) {
                $translated = $translations->line($value, $locale);
                if ($translated !== $value) {
                    $out[$key] = $translated;
                }
            }
        }

        return $out;
    }

    public function addNamespace($namespace, $hint): void
    {
        $this->inner->addNamespace($namespace, $hint);
    }

    public function addJsonPath($path): void
    {
        $this->inner->addJsonPath($path);
    }

    /**
     * @return array<string, string>
     */
    public function namespaces(): array
    {
        return $this->inner->namespaces();
    }
}
