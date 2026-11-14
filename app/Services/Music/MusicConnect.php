<?php

namespace App\Services\Music;

use App\Events\Music\ConnectCommand;
use App\Events\Music\ConnectUpdated;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * GameCon Connect (як Spotify Connect): пристрої користувача — вкладки сайту й застосунок — бачать,
 * що грає на іншому, керують ним і перекидають відтворення. Усе живе в кеші: пристрої, активний
 * пристрій і черги команд для кожного. Сайт дізнається про зміни через Reverb, застосунок — з heartbeat.
 *
 * @phpstan-type State array{track: array<string, mixed>|null, playing: bool, position: float, duration: float, volume: float, shuffle: bool, repeat: string, updated_at: string}
 * @phpstan-type Command array{id: string, action: string, value: mixed, from_device_id: string|null, created_at: string}
 * @phpstan-type Device array{id: string, name: string, kind: string, last_seen: int, state: State|null, queue: list<array<string, mixed>>|null, index: int|null}
 * @phpstan-type Record array{devices: array<string, Device>, active: string|null, commands: array<string, list<Command>>}
 */
class MusicConnect
{
    /** Пристрій без heartbeat довше — прихований. */
    public const STALE_SECONDS = 30;

    /** Скільки команда чекає на пристрій. */
    public const COMMAND_TTL = 60;

    public const ACTIONS = ['toggle', 'play', 'pause', 'next', 'prev', 'seek', 'volume', 'transfer'];

    /** Запис цілком забувається, якщо жоден пристрій не озивався годину. */
    private const RECORD_TTL = 3600;

    /**
     * @param  array{id: string, name: string, kind: string}  $device
     * @param  State|null  $state  null — пристрій нічого не грає (стан стерто)
     * @param  bool  $hasState  false — стан не надіслано (вкладка, що не грає): лишається попередній
     * @param  list<array<string, mixed>>|null  $queue
     * @return array{devices: list<array<string, mixed>>, active_device_id: string|null, commands: list<Command>}
     */
    public function heartbeat(User $user, array $device, bool $hasState, ?array $state, ?array $queue = null, ?int $index = null): array
    {
        $id = $device['id'];
        $now = now();
        $outbox = [];
        $changed = false;
        $commands = [];

        $record = $this->locked($user, function (array $record) use ($id, $device, $hasState, $state, $queue, $index, $now, &$outbox, &$changed, &$commands): array {
            $previous = $record['devices'][$id] ?? null;
            $changed = $previous === null || ! $this->fresh($previous, $now)
                || $previous['name'] !== $device['name'] || $previous['kind'] !== $device['kind'];

            $entry = $previous ?? ['id' => $id, 'name' => $device['name'], 'kind' => $device['kind'], 'last_seen' => 0, 'state' => null, 'queue' => null, 'index' => null];
            $entry['name'] = $device['name'];
            $entry['kind'] = $device['kind'];
            $entry['last_seen'] = $now->getTimestamp();

            if ($hasState) {
                if ($state !== null) {
                    // Час оновлення — годинник сервера: інакше розбіжність годинників телефона й ПК зсуває прогрес.
                    $state['updated_at'] = $now->toIso8601ZuluString('millisecond');
                    $state['position'] = max(0.0, $state['duration'] > 0 ? min($state['position'], $state['duration']) : $state['position']);
                }
                $changed = $changed || $this->differs($previous['state'] ?? null, $state, $now);
                $entry['state'] = $state;
                if ($state === null || $queue !== null) {
                    $entry['queue'] = $queue;
                    $entry['index'] = $index;
                }
            }
            $record['devices'][$id] = $entry;

            // Почав грати тут — пристрій стає активним, а попередній активний ставить паузу (як у Spotify).
            // Якщо цей пристрій ще не отримав свою «паузу» (щойно перекинули відтворення) — це старий стан.
            $pausePending = in_array('pause', array_column($record['commands'][$id] ?? [], 'action'), true);
            if ($hasState && ($state['playing'] ?? false) && $record['active'] !== $id && ! $pausePending) {
                $old = $record['active'] !== null ? ($record['devices'][$record['active']] ?? null) : null;
                if ($old !== null && $this->fresh($old, $now)) {
                    $outbox[] = $this->push($record, $old['id'], 'pause', null, $id, $now);
                }
                $record['active'] = $id;
                $changed = true;
            }

            $commands = $record['commands'][$id] ?? [];
            unset($record['commands'][$id]);

            return $record;
        });

        $this->dispatch($user, $outbox);
        if ($changed || $outbox !== []) {
            $this->announce($user, $record, $now);
        }

        return [...$this->snapshot($record, $now), 'commands' => $commands];
    }

    /**
     * Команда іншому пристрою. false — такого пристрою немає серед живих пристроїв користувача.
     */
    public function command(User $user, string $target, string $action, ?float $value, ?string $from = null): bool
    {
        $now = now();
        $outbox = [];
        $found = true;

        $record = $this->locked($user, function (array $record) use ($target, $action, $value, $from, $now, &$outbox, &$found): array {
            $device = $record['devices'][$target] ?? null;
            if ($device === null || ! $this->fresh($device, $now)) {
                $found = false;

                return $record;
            }

            if ($action !== 'transfer') {
                $outbox[] = $this->push($record, $target, $action, $value, $from, $now);
                $this->optimistic($record, $target, $action, $value, $now);

                return $record;
            }

            $source = $record['active'] !== null ? ($record['devices'][$record['active']] ?? null) : null;
            $state = $source !== null && $this->fresh($source, $now) ? $source['state'] : null;
            if ($source === null || $state === null || $state['track'] === null) {
                throw ValidationException::withMessages(['target_device_id' => 'Зараз нічого не грає — нема що перемикати.']);
            }
            if ($source['id'] === $target) {
                return $record;
            }

            $payload = [
                'track' => $state['track'],
                'position' => round($this->position($state, $now), 2),
                'playing' => $state['playing'],
            ];
            if ($source['queue'] !== null) {
                $payload['queue'] = $source['queue'];
                $payload['index'] = $source['index'];
            }
            $outbox[] = $this->push($record, $target, 'transfer', $payload, $from, $now);
            if ($state['playing']) {
                $outbox[] = $this->push($record, $source['id'], 'pause', null, $from, $now);
                $state['playing'] = false;
                $state['position'] = $payload['position'];
                $state['updated_at'] = $now->toIso8601ZuluString('millisecond');
                $source['state'] = $state;
                $record['devices'][$source['id']] = $source;
            }
            $record['active'] = $target;

            return $record;
        });

        if (! $found) {
            return false;
        }

        $this->dispatch($user, $outbox);
        $this->announce($user, $record, $now);

        return true;
    }

    /**
     * Живі пристрої без зміни стану (для першого показу).
     *
     * @return array{devices: list<array<string, mixed>>, active_device_id: string|null}
     */
    public function devices(User $user): array
    {
        return $this->snapshot($this->load($user), now());
    }

    /**
     * @param  Record  $record
     * @return array{devices: list<array<string, mixed>>, active_device_id: string|null}
     */
    private function snapshot(array $record, CarbonInterface $now): array
    {
        $active = $record['active'];
        $live = array_filter($record['devices'], fn (array $d) => $this->fresh($d, $now));
        if ($active !== null && ! isset($live[$active])) {
            $active = null;
        }
        uasort($live, fn (array $a, array $b) => [$b['id'] === $active, $b['last_seen']] <=> [$a['id'] === $active, $a['last_seen']]);

        return [
            'devices' => array_values(array_map(fn (array $d) => [
                'id' => $d['id'],
                'name' => $d['name'],
                'kind' => $d['kind'],
                'last_seen' => Carbon::createFromTimestamp($d['last_seen'])->toIso8601ZuluString(),
                'is_active' => $d['id'] === $active,
                'state' => $d['state'],
            ], $live)),
            'active_device_id' => $active,
        ];
    }

    /**
     * Команда стає в чергу пристрою (до COMMAND_TTL секунд).
     *
     * @param  Record  $record
     * @return array{target: string, command: Command}
     */
    private function push(array &$record, string $target, string $action, mixed $value, ?string $from, CarbonInterface $now): array
    {
        $command = [
            'id' => (string) Str::uuid(),
            'action' => $action,
            'value' => $value,
            'from_device_id' => $from,
            'created_at' => $now->toIso8601ZuluString('millisecond'),
        ];
        $record['commands'][$target] = [...($record['commands'][$target] ?? []), $command];

        return ['target' => $target, 'command' => $command];
    }

    /**
     * Поки пристрій не відзвітував, інші бачать очікуваний результат (пауза, гучність, перемотка).
     *
     * @param  Record  $record
     */
    private function optimistic(array &$record, string $target, string $action, ?float $value, CarbonInterface $now): void
    {
        $device = $record['devices'][$target];
        $state = $device['state'];
        if ($state === null) {
            return;
        }
        $state['position'] = $this->position($state, $now);
        match ($action) {
            'toggle' => $state['playing'] = ! $state['playing'],
            'play' => $state['playing'] = true,
            'pause' => $state['playing'] = false,
            'seek' => $state['position'] = max(0.0, (float) $value),
            'volume' => $state['volume'] = max(0.0, min(1.0, (float) $value)),
            default => null,
        };
        $state['updated_at'] = $now->toIso8601ZuluString('millisecond');
        $device['state'] = $state;
        $record['devices'][$target] = $device;
    }

    /**
     * Позиція зараз: остання відома плюс скільки минуло, якщо грає.
     *
     * @param  State  $state
     */
    private function position(array $state, CarbonInterface $now): float
    {
        $position = $state['position'];
        if ($state['playing']) {
            $position += max(0.0, ($now->getPreciseTimestamp(3) - Carbon::parse($state['updated_at'])->getPreciseTimestamp(3)) / 1000);
        }

        return $state['duration'] > 0 ? min($position, $state['duration']) : $position;
    }

    /**
     * Чи варто розсилати оновлення: інший трек, пауза, гучність, режими або перемотка (а не просто хід часу).
     *
     * @param  State|null  $before
     * @param  State|null  $after
     */
    private function differs(?array $before, ?array $after, CarbonInterface $now): bool
    {
        if ($before === null || $after === null) {
            return $before !== $after;
        }
        $key = fn (array $s) => [($s['track']['key'] ?? null), $s['playing'], round($s['volume'], 2), $s['shuffle'], $s['repeat']];
        if ($key($before) !== $key($after)) {
            return true;
        }

        return abs($this->position($before, $now) - $after['position']) > 3;
    }

    /**
     * @param  array<string, mixed>  $device
     */
    private function fresh(array $device, CarbonInterface $now): bool
    {
        return (int) $device['last_seen'] >= $now->getTimestamp() - self::STALE_SECONDS;
    }

    /**
     * Зміна запису під блокуванням: heartbeat кількох пристроїв не перезаписують одне одного.
     *
     * @param  callable(Record): Record  $change
     * @return Record
     */
    private function locked(User $user, callable $change): array
    {
        return Cache::lock($this->key($user).':lock', 5)->block(3, function () use ($user, $change) {
            $record = $change($this->load($user));
            Cache::put($this->key($user), $record, self::RECORD_TTL);

            return $record;
        });
    }

    /**
     * Запис без давно мовчазних пристроїв і прострочених команд.
     *
     * @return Record
     */
    private function load(User $user): array
    {
        $record = Cache::get($this->key($user));
        if (! is_array($record) || ! isset($record['devices'])) {
            $record = ['devices' => [], 'active' => null, 'commands' => []];
        }
        $now = now();
        $record['devices'] = array_filter($record['devices'], fn (array $d) => $d['last_seen'] >= $now->getTimestamp() - self::RECORD_TTL);
        foreach ($record['commands'] as $device => $list) {
            $list = array_values(array_filter($list, fn (array $c) => Carbon::parse($c['created_at'])->getTimestamp() >= $now->getTimestamp() - self::COMMAND_TTL));
            if ($list === []) {
                unset($record['commands'][$device]);
            } else {
                $record['commands'][$device] = $list;
            }
        }

        /** @var Record $record */
        return $record;
    }

    /**
     * @param  list<array{target: string, command: Command}>  $outbox
     */
    private function dispatch(User $user, array $outbox): void
    {
        foreach ($outbox as $item) {
            rescue(fn () => broadcast(new ConnectCommand($user->id, $item['target'], $item['command'])), report: false);
        }
    }

    /**
     * @param  Record  $record
     */
    private function announce(User $user, array $record, CarbonInterface $now): void
    {
        $snapshot = $this->snapshot($record, $now);
        rescue(fn () => broadcast(new ConnectUpdated($user->id, $snapshot['devices'], $snapshot['active_device_id'])), report: false);
    }

    private function key(User $user): string
    {
        return "music.connect.{$user->id}";
    }
}
