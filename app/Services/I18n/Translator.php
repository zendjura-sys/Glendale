<?php

namespace App\Services\I18n;

/**
 * Вибір перекладача: DeepL, поки є ключ і не вичерпано місячний ліміт символів
 * (Free — 500 000 символів на місяць, рахуються й пробіли та розділові знаки), далі — Azure Translator
 * (F0 — 2 000 000 на місяць, хмара), останнім — власний LibreTranslate без ліміту. Хто не відповів —
 * пробуємо наступного. Усі недоступні — null, і викликач показує звичне повідомлення про помилку.
 */
class Translator
{
    public const DEEPL = 'deepl';

    public const AZURE = 'azure';

    public const LIBRE = 'libretranslate';

    public function __construct(private readonly DeepL $deepl, private readonly AzureTranslator $azure, private readonly LibreTranslate $libre) {}

    /** DeepL можна використовувати: ключ є й позначки «вичерпано» немає. */
    public function deeplReady(bool $check = false): bool
    {
        return $this->deepl->configured() && ! $this->deepl->exhausted($check);
    }

    /** Чи є хоч один робочий перекладач (кнопка «Перекласти», автопереклад мов). */
    public function available(): bool
    {
        return $this->deeplReady() || $this->azure->available() || $this->libre->available();
    }

    /** Чи вміє хоч один перекладач цю мову. */
    public function supports(string $locale): bool
    {
        return ($this->deeplReady() && $this->deepl->target($locale) !== null)
            || ($this->azure->available() && $this->azure->target($locale) !== null)
            || ($this->libre->available() && $this->libre->target($locale) !== null);
    }

    /**
     * Текст користувача → мова інтерфейсу людини.
     *
     * @return array{text: string, source: string, engine: string}|null
     */
    public function content(string $text, string $locale): ?array
    {
        if ($this->deeplReady() && ($target = $this->deepl->target($locale)) !== null) {
            $result = $this->deepl->content($text, $target);
            if ($result !== null) {
                return [...$result, 'engine' => self::DEEPL];
            }
        }
        if ($this->azure->available() && ($target = $this->azure->target($locale)) !== null) {
            $result = $this->azure->content($text, $target);
            if ($result !== null) {
                return [...$result, 'engine' => self::AZURE];
            }
        }
        if ($this->libre->available() && ($target = $this->libre->target($locale)) !== null) {
            $result = $this->libre->content($text, $target);
            if ($result !== null) {
                return [...$result, 'engine' => self::LIBRE];
            }
        }

        return null;
    }

    /**
     * Рядки інтерфейсу з української (порядок і кількість — як у вхідному списку).
     *
     * @param  list<string>  $texts
     * @return array{texts: list<string>, engine: string}|null
     */
    public function interface(array $texts, string $locale): ?array
    {
        // Автопереклад мови — сотні запитів, тож перед ним дивимося свіжий лічильник DeepL.
        if ($this->deeplReady(true) && ($target = $this->deepl->target($locale)) !== null) {
            $result = $this->deepl->interface($texts, $target);
            if ($result !== null) {
                return ['texts' => $result, 'engine' => self::DEEPL];
            }
        }
        if ($this->azure->available() && ($target = $this->azure->target($locale)) !== null) {
            $result = $this->azure->interface($texts, $target);
            if ($result !== null) {
                return ['texts' => $result, 'engine' => self::AZURE];
            }
        }
        if ($this->libre->available() && ($target = $this->libre->target($locale)) !== null) {
            $result = $this->libre->interface($texts, $target);
            if ($result !== null) {
                return ['texts' => $result, 'engine' => self::LIBRE];
            }
        }

        return null;
    }

    /**
     * Стан для Адмінки → Мови / Інтеграції.
     *
     * @return array{active: string|null, deepl: array{configured: bool, usage: array{used: int, limit: int}|null, exhausted: bool, exhausted_at: string|null}, azure: array{configured: bool, region: string|null, exhausted: bool}, libretranslate: array{configured: bool, url: string|null, up: bool, languages: list<string>}}
     */
    public function status(): array
    {
        $usage = $this->deepl->quota();
        $deeplReady = $this->deeplReady();
        $azureReady = $this->azure->available();
        $libreUp = $this->libre->available();

        return [
            'active' => $deeplReady ? self::DEEPL : ($azureReady ? self::AZURE : ($libreUp ? self::LIBRE : null)),
            'deepl' => [
                'configured' => $this->deepl->configured(),
                'usage' => $usage,
                'exhausted' => $this->deepl->exhausted(),
                'exhausted_at' => $this->deepl->exhaustedAt(),
            ],
            'azure' => [
                'configured' => $this->azure->configured(),
                'region' => $this->azure->region(),
                'exhausted' => $this->azure->exhausted(),
            ],
            'libretranslate' => [
                'configured' => $this->libre->configured(),
                'url' => $this->libre->url(),
                'up' => $libreUp,
                'languages' => $libreUp ? $this->libre->languages() : [],
            ],
        ];
    }
}
