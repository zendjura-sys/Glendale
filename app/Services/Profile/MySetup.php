<?php

namespace App\Services\Profile;

use App\Models\User;

/**
 * «Мій сетап» на сторінці людини: ПК (з «Чи потягне мій ПК») і периферія — мишка, клавіатура,
 * навушники, монітор, мікрофон, геймпад, крісло. Зберігається в налаштуваннях людини.
 */
class MySetup
{
    public const FIELDS = ['monitor', 'mouse', 'keyboard', 'headset', 'mic', 'controller', 'chair', 'other'];

    /**
     * @return array{public: bool, pc: array{cpu: string|null, gpu: string|null, ram: int|null}, gear: array<string, string|null>}
     */
    public function of(User $user): array
    {
        $pc = is_array($pc = $user->pref('pc')) ? $pc : [];
        $gear = is_array($gear = $user->pref('setup')) ? $gear : [];

        return [
            'public' => (bool) $user->pref('setup_public', true),
            'pc' => [
                'cpu' => is_string($pc['cpu'] ?? null) ? $pc['cpu'] : null,
                'gpu' => is_string($pc['gpu'] ?? null) ? $pc['gpu'] : null,
                'ram' => is_numeric($pc['ram'] ?? null) ? (int) $pc['ram'] : null,
            ],
            'gear' => collect(self::FIELDS)->mapWithKeys(fn (string $f) => [$f => is_string($gear[$f] ?? null) && $gear[$f] !== '' ? $gear[$f] : null])->all(),
        ];
    }

    /**
     * Для чужих — лише якщо відкрито й щось заповнено.
     *
     * @return array{public: bool, pc: array{cpu: string|null, gpu: string|null, ram: int|null}, gear: array<string, string|null>}|null
     */
    public function visibleFor(User $owner, ?User $viewer): ?array
    {
        $setup = $this->of($owner);
        $self = $viewer !== null && $viewer->id === $owner->id;
        $filled = array_filter($setup['pc']) !== [] || array_filter($setup['gear']) !== [];

        return $self || ($setup['public'] && $filled) ? $setup : null;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function save(User $user, array $data): void
    {
        $gear = [];
        foreach (self::FIELDS as $field) {
            $value = trim((string) ($data[$field] ?? ''));
            $gear[$field] = $value !== '' ? mb_substr($value, 0, 80) : null;
        }
        $pc = [
            'cpu' => trim((string) ($data['cpu'] ?? '')) ?: null,
            'gpu' => trim((string) ($data['gpu'] ?? '')) ?: null,
            'ram' => isset($data['ram']) && is_numeric($data['ram']) ? (int) $data['ram'] : null,
        ];
        $user->mergePref(['setup' => $gear, 'pc' => $pc, 'setup_public' => (bool) ($data['public'] ?? true)]);
    }
}
