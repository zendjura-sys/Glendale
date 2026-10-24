<?php

namespace App\Services\I18n;

use App\Support\Settings\SiteSettings;

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

    /** Перемикачі в Адмінці → Мови: вимкнений перекладач пропускаємо (вичерпаний ліміт вимикає сам, до нового місяця). */
    public const SWITCHES = [self::DEEPL => 'translate_deepl', self::AZURE => 'translate_azure', self::LIBRE => 'translate_libre'];

    /** Чому не переклав кожен перекладач в останній спробі (для повідомлення адміну). */
    /** @var array<string, string> */
    private array $failures = [];

    public function __construct(private readonly DeepL $deepl, private readonly AzureTranslator $azure, private readonly LibreTranslate $libre, private readonly SiteSettings $settings) {}

    /** Чи увімкнено перекладач перемикачем адміна. */
    public function enabled(string $engine): bool
    {
        return $this->settings->get(self::SWITCHES[$engine] ?? '', true) !== false;
    }

    /** DeepL можна використовувати: увімкнено, ключ є й позначки «вичерпано» немає. */
    public function deeplReady(bool $check = false): bool
    {
        return $this->enabled(self::DEEPL) && $this->deepl->configured() && ! $this->deepl->exhausted($check);
    }

    private function azureReady(): bool
    {
        return $this->enabled(self::AZURE) && $this->azure->available();
    }

    private function libreReady(): bool
    {
        return $this->enabled(self::LIBRE) && $this->libre->available();
    }

    /** Чи є хоч один робочий перекладач (кнопка «Перекласти», автопереклад мов). */
    public function available(): bool
    {
        return $this->deeplReady() || $this->azureReady() || $this->libreReady();
    }

    /** Чи вміє хоч один перекладач цю мову. */
    public function supports(string $locale): bool
    {
        return ($this->deeplReady() && $this->deepl->target($locale) !== null)
            || ($this->azureReady() && $this->azure->target($locale) !== null)
            || ($this->libreReady() && $this->libre->target($locale) !== null);
    }

    /** Чому останній переклад не вдався: «DeepL — вимкнено; Azure — …; LibreTranslate — …». */
    public function lastError(): string
    {
        $names = [self::DEEPL => 'DeepL', self::AZURE => 'Azure', self::LIBRE => 'LibreTranslate'];
        $parts = [];
        foreach ($this->failures as $engine => $reason) {
            $parts[] = $names[$engine].' — '.$reason;
        }

        return $parts === [] ? 'жоден перекладач не відповів' : implode('; ', $parts);
    }

    /** Причина, з якої перекладач пропущено (null — можна пробувати). */
    private function skip(string $engine, bool $check = false): ?string
    {
        if (! $this->enabled($engine)) {
            return 'вимкнено';
        }

        return match ($engine) {
            self::DEEPL => ! $this->deepl->configured() ? 'немає ключа' : ($this->deepl->exhausted($check) ? 'вичерпано ліміт' : null),
            self::AZURE => ! $this->azure->configured() ? 'немає ключа' : ($this->azure->exhausted() ? 'вичерпано ліміт' : null),
            default => ! $this->libre->configured() ? 'не налаштовано' : (! $this->libre->available() ? 'не відповідає' : null),
        };
    }

    /**
     * Текст користувача → мова інтерфейсу людини.
     *
     * @return array{text: string, source: string, engine: string}|null
     */
    public function content(string $text, string $locale): ?array
    {
        $this->failures = [];
        foreach ([self::DEEPL, self::AZURE, self::LIBRE] as $engine) {
            $result = $this->attempt($engine, $locale, false, fn (string $target) => match ($engine) {
                self::DEEPL => $this->deepl->content($text, $target),
                self::AZURE => $this->azure->content($text, $target),
                default => $this->libre->content($text, $target),
            });
            if ($result !== null) {
                return [...$result, 'engine' => $engine];
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
        $this->failures = [];
        foreach ([self::DEEPL, self::AZURE, self::LIBRE] as $engine) {
            // Автопереклад мови — сотні запитів, тож перед DeepL дивимося свіжий лічильник.
            $result = $this->attempt($engine, $locale, true, fn (string $target) => match ($engine) {
                self::DEEPL => $this->deepl->interface($texts, $target),
                self::AZURE => $this->azure->interface($texts, $target),
                default => $this->libre->interface($texts, $target),
            });
            if ($result !== null) {
                return ['texts' => $result, 'engine' => $engine];
            }
        }

        return null;
    }

    /**
     * Спроба одним перекладачем; невдача — причина в $failures.
     *
     * @template T
     *
     * @param  callable(string): (T|null)  $run
     * @return T|null
     */
    private function attempt(string $engine, string $locale, bool $check, callable $run): mixed
    {
        if (($reason = $this->skip($engine, $check)) !== null) {
            $this->failures[$engine] = $reason;

            return null;
        }
        $target = match ($engine) {
            self::DEEPL => $this->deepl->target($locale),
            self::AZURE => $this->azure->target($locale),
            default => $this->libre->target($locale),
        };
        if ($target === null) {
            $this->failures[$engine] = 'не знає цієї мови';

            return null;
        }
        $result = $run($target);
        if ($result === null) {
            $this->failures[$engine] = match ($engine) {
                self::AZURE => $this->azure->lastError ?? 'не відповів',
                self::DEEPL => $this->deepl->exhausted() ? 'вичерпано ліміт' : 'не відповів',
                default => 'не відповів',
            };
        }

        return $result;
    }

    /**
     * Стан для Адмінки → Мови / Інтеграції.
     *
     * @return array{active: string|null, enabled: array<string, bool>, deepl: array{configured: bool, usage: array{used: int, limit: int}|null, exhausted: bool, exhausted_at: string|null}, azure: array{configured: bool, region: string|null, exhausted: bool, usage: array{used: int, limit: int, resets_at: string}}, libretranslate: array{configured: bool, url: string|null, up: bool, languages: list<string>}}
     */
    public function status(): array
    {
        $usage = $this->deepl->quota();
        $deeplReady = $this->deeplReady();
        $azureReady = $this->azureReady();
        $libreUp = $this->libre->available();

        return [
            'active' => $deeplReady ? self::DEEPL : ($azureReady ? self::AZURE : ($libreUp && $this->enabled(self::LIBRE) ? self::LIBRE : null)),
            'enabled' => array_map(fn (string $engine) => $this->enabled($engine), array_combine(array_keys(self::SWITCHES), array_keys(self::SWITCHES))),
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
                'usage' => $this->azure->usage(),
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
