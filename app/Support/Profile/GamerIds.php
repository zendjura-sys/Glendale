<?php

namespace App\Support\Profile;

use App\Models\User;

/**
 * Ігрові ID у профілі: PSN, Xbox, Nintendo, Epic, Riot, Battle.net, EA, Ubisoft — з кнопкою «Копіювати».
 * Зберігаються в налаштуваннях людини (ключі xbox і playstation — ті самі, що й раніше).
 */
class GamerIds
{
    /** @var array<string, array{label: string, rule: string, max: int, placeholder: string}> */
    public const FIELDS = [
        'playstation' => ['label' => 'PlayStation', 'rule' => '/^[A-Za-z0-9_-]*$/', 'max' => 16, 'placeholder' => 'PSN ID'],
        'xbox' => ['label' => 'Xbox', 'rule' => '/^[A-Za-z0-9 ]*$/', 'max' => 16, 'placeholder' => 'Gamertag'],
        'nintendo' => ['label' => 'Nintendo Switch', 'rule' => '/^(SW-)?[0-9]{4}-?[0-9]{4}-?[0-9]{4}$|^$/i', 'max' => 17, 'placeholder' => 'SW-0000-0000-0000'],
        'epic' => ['label' => 'Epic Games', 'rule' => '/^[\p{L}\p{N} ._-]*$/u', 'max' => 32, 'placeholder' => 'Epic ID'],
        'riot' => ['label' => 'Riot ID', 'rule' => '/^[^#]{3,16}#[\p{L}\p{N}]{2,5}$|^$/u', 'max' => 22, 'placeholder' => 'Нік#TAG'],
        'battlenet' => ['label' => 'Battle.net', 'rule' => '/^[\p{L}\p{N}]{2,12}#[0-9]{4,6}$|^$/u', 'max' => 20, 'placeholder' => 'BattleTag#1234'],
        'ea' => ['label' => 'EA', 'rule' => '/^[A-Za-z0-9_.-]*$/', 'max' => 32, 'placeholder' => 'EA ID'],
        'ubisoft' => ['label' => 'Ubisoft Connect', 'rule' => '/^[A-Za-z0-9_.-]*$/', 'max' => 32, 'placeholder' => 'Ubisoft ID'],
    ];

    /** @return array<string, array<int, string>> */
    public static function rules(): array
    {
        return collect(self::FIELDS)->map(fn (array $f) => ['sometimes', 'nullable', 'string', 'max:'.$f['max'], 'regex:'.$f['rule']])->all();
    }

    /** @return array<string, string> */
    public static function messages(): array
    {
        return collect(self::FIELDS)->mapWithKeys(fn (array $f, string $key) => [$key.'.regex' => 'Перевірте '.$f['label'].': наприклад, '.$f['placeholder'].'.'])->all();
    }

    /**
     * Зберегти лише надіслані поля (старі клієнти шлють тільки Xbox і PlayStation).
     *
     * @param  array<string, mixed>  $data
     */
    public static function save(User $user, array $data): void
    {
        $patch = [];
        foreach (array_keys(self::FIELDS) as $key) {
            if (array_key_exists($key, $data)) {
                $value = trim((string) $data[$key]);
                $patch[$key] = $value !== '' ? $value : null;
            }
        }
        if ($patch !== []) {
            $user->mergePref($patch);
        }
    }

    /**
     * Заповнені ID для профілю.
     *
     * @return list<array{key: string, label: string, value: string, url: string|null}>
     */
    public static function of(User $user): array
    {
        $out = [];
        foreach (self::FIELDS as $key => $field) {
            $value = $user->pref($key);
            if (! is_string($value) || $value === '') {
                continue;
            }
            $out[] = ['key' => $key, 'label' => $field['label'], 'value' => $value, 'url' => match ($key) {
                'playstation' => 'https://psnprofiles.com/'.rawurlencode($value),
                'xbox' => 'https://www.xbox.com/play/user/'.rawurlencode($value),
                default => null,
            }];
        }

        return $out;
    }

    /**
     * Усі поля для редактора.
     *
     * @return list<array{key: string, label: string, placeholder: string, value: string}>
     */
    public static function form(User $user): array
    {
        return array_values(collect(self::FIELDS)->map(fn (array $f, string $key) => [
            'key' => $key,
            'label' => $f['label'],
            'placeholder' => $f['placeholder'],
            'value' => is_string($v = $user->pref($key)) ? $v : '',
        ])->all());
    }
}
