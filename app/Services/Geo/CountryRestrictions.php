<?php

namespace App\Services\Geo;

use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\Request;
use WeakMap;

/**
 * Обмеження за країнами: для відвідувачів із вибраної країни вимкнені окремі розділи (модулі)
 * й функції (плагіни). Зберігається в налаштуваннях сайту (geo_restrictions):
 * {"RU": {"modules": ["cinema"], "plugins": ["polls"], "note": "…"}}.
 * Адміністрацію не обмежуємо; країну не визначено — обмежень немає.
 *
 * @phpstan-type Entry array{modules: list<string>, plugins: list<string>, note: string}
 */
class CountryRestrictions
{
    public const SETTING = 'geo_restrictions';

    public const MESSAGE = 'Цей розділ недоступний у вашій країні.';

    /** @var WeakMap<Request, string|null> */
    private WeakMap $countries;

    private mixed $raw = null;

    /** @var array<string, Entry>|null */
    private ?array $memo = null;

    public function __construct(private readonly SiteSettings $settings, private readonly VisitorCountry $visitor)
    {
        $this->countries = new WeakMap;
    }

    /**
     * @return array<string, Entry>
     */
    public function all(): array
    {
        $stored = $this->settings->get(self::SETTING);
        if ($this->memo !== null && $stored === $this->raw) {
            return $this->memo;
        }
        $out = [];
        foreach (is_array($stored) ? $stored : [] as $code => $entry) {
            if (is_string($code) && preg_match('/^[A-Z]{2}$/', $code) === 1 && is_array($entry)) {
                $normalized = $this->normalize($entry);
                if ($normalized['modules'] !== [] || $normalized['plugins'] !== []) {
                    $out[$code] = $normalized;
                }
            }
        }
        ksort($out);
        $this->raw = $stored;

        return $this->memo = $out;
    }

    /**
     * @return Entry
     */
    public function for(string $country): array
    {
        return $this->all()[$country] ?? ['modules' => [], 'plugins' => [], 'note' => ''];
    }

    /**
     * Порожній набір прибирає країну зі списку.
     *
     * @param  list<string>  $modules
     * @param  list<string>  $plugins
     */
    public function save(string $country, array $modules, array $plugins, string $note): void
    {
        $all = $this->all();
        $entry = $this->normalize(['modules' => $modules, 'plugins' => $plugins, 'note' => $note]);
        if ($entry['modules'] === [] && $entry['plugins'] === []) {
            unset($all[$country]);
        } else {
            $all[$country] = $entry;
        }
        $this->settings->put([self::SETTING => $all]);
    }

    public function moduleBlocked(string $key): bool
    {
        return in_array($key, $this->current()['modules'] ?? [], true);
    }

    public function pluginBlocked(string $key): bool
    {
        return in_array($key, $this->current()['plugins'] ?? [], true);
    }

    /** Країна поточного відвідувача, якщо для неї є обмеження (адміністрація — завжди null). */
    public function restrictedCountry(): ?string
    {
        $request = $this->request();
        if ($request === null || $this->settings->get(self::SETTING) === null) {
            return null;
        }
        $user = $request->user();
        if ($user instanceof User && $user->isStaff()) {
            return null;
        }
        if (! $this->countries->offsetExists($request)) {
            $this->countries[$request] = $this->visitor->of($request);
        }
        $country = $this->countries[$request];

        return $country !== null && array_key_exists($country, $this->all()) ? $country : null;
    }

    /**
     * Рекомендації для країни: функції з ознаками, які правила радять обмежити.
     *
     * @return array{modules: list<string>, plugins: list<string>, reasons: list<array{id: string, label: string, tags: list<string>}>}
     */
    public function recommendations(string $country): array
    {
        $reasons = [];
        $tags = [];
        foreach ($this->rules() as $rule) {
            if (in_array($country, $rule['countries'], true)) {
                $reasons[] = ['id' => $rule['id'], 'label' => $rule['label'], 'tags' => $rule['tags']];
                $tags = [...$tags, ...$rule['tags']];
            }
        }
        $pick = fn (array $map): array => array_keys(array_filter($map, fn (array $featureTags) => array_intersect($featureTags, $tags) !== []));

        return [
            'modules' => $pick($this->featureTags('modules')),
            'plugins' => $pick($this->featureTags('plugins')),
            'reasons' => $reasons,
        ];
    }

    /**
     * Ознаки функцій із config/country_restrictions.php.
     *
     * @return array<string, list<string>>
     */
    public function featureTags(string $kind): array
    {
        $map = config("country_restrictions.{$kind}");
        $out = [];
        foreach (is_array($map) ? $map : [] as $key => $tags) {
            if (is_string($key) && is_array($tags)) {
                $out[$key] = array_values(array_filter($tags, 'is_string'));
            }
        }

        return $out;
    }

    /**
     * @return array<string, string>
     */
    public function tagLabels(): array
    {
        $tags = config('country_restrictions.tags');

        return is_array($tags) ? array_filter($tags, fn ($label, $key) => is_string($key) && is_string($label), ARRAY_FILTER_USE_BOTH) : [];
    }

    /**
     * @return list<array{id: string, label: string, countries: list<string>, tags: list<string>}>
     */
    public function rules(): array
    {
        $rules = config('country_restrictions.rules');
        $out = [];
        foreach (is_array($rules) ? $rules : [] as $rule) {
            if (is_array($rule) && is_string($rule['id'] ?? null) && is_string($rule['label'] ?? null) && is_array($rule['countries'] ?? null) && is_array($rule['tags'] ?? null)) {
                $out[] = [
                    'id' => $rule['id'],
                    'label' => $rule['label'],
                    'countries' => array_values(array_filter($rule['countries'], 'is_string')),
                    'tags' => array_values(array_filter($rule['tags'], 'is_string')),
                ];
            }
        }

        return $out;
    }

    /**
     * @return Entry|null
     */
    private function current(): ?array
    {
        $country = $this->restrictedCountry();

        return $country === null ? null : $this->all()[$country];
    }

    private function request(): ?Request
    {
        return app()->bound('request') ? app(Request::class) : null;
    }

    /**
     * @param  array<mixed>  $entry
     * @return Entry
     */
    private function normalize(array $entry): array
    {
        $list = fn (mixed $value): array => is_array($value) ? array_values(array_unique(array_filter($value, fn ($v) => is_string($v) && $v !== ''))) : [];
        $note = $entry['note'] ?? '';

        return [
            'modules' => $list($entry['modules'] ?? null),
            'plugins' => $list($entry['plugins'] ?? null),
            'note' => is_string($note) ? mb_substr($note, 0, 500) : '',
        ];
    }
}
