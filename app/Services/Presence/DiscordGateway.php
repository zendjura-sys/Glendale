<?php

namespace App\Services\Presence;

use RuntimeException;

/**
 * Мінімальний клієнт шлюзу Discord (WebSocket поверх TLS): Hello → Identify → heartbeat,
 * з подій беремо лише присутність (GUILD_CREATE.presences і PRESENCE_UPDATE).
 * Без сторонніх бібліотек: кадри WebSocket збираємо й розбираємо тут.
 */
class DiscordGateway
{
    /** GUILDS | GUILD_MEMBERS | GUILD_PRESENCES. */
    public const INTENTS = 1 | 2 | 256;

    /** @var resource|null */
    private $socket = null;

    private string $buffer = '';

    private ?int $sequence = null;

    private float $heartbeatEvery = 41.25;

    private float $nextHeartbeat = 0;

    /** @var list<string> Шматки фрагментованого повідомлення. */
    private array $fragments = [];

    public function __construct(private readonly DiscordPresence $presence) {}

    /**
     * Слухати шлюз до $seconds секунд (потім команда завершується, планувальник запускає знову).
     *
     * @param  callable(string): void|null  $log
     * @return int скільки подій присутності оброблено
     */
    public function run(int $seconds, ?callable $log = null): int
    {
        $token = $this->presence->token();
        if ($token === null) {
            return 0;
        }
        $deadline = microtime(true) + $seconds;
        $handled = 0;
        $this->connect((string) config('services.discord.gateway', 'wss://gateway.discord.gg/?v=10&encoding=json'));

        try {
            while (microtime(true) < $deadline) {
                foreach ($this->read(1.0) as $payload) {
                    $handled += $this->dispatch($payload, $token, $log);
                }
                if ($this->nextHeartbeat > 0 && microtime(true) >= $this->nextHeartbeat) {
                    $this->send(['op' => 1, 'd' => $this->sequence]);
                    $this->nextHeartbeat = microtime(true) + $this->heartbeatEvery;
                }
            }
        } finally {
            $this->close();
        }

        return $handled;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  callable(string): void|null  $log
     */
    private function dispatch(array $payload, string $token, ?callable $log): int
    {
        if (isset($payload['s']) && is_int($payload['s'])) {
            $this->sequence = $payload['s'];
        }
        $data = is_array($payload['d'] ?? null) ? $payload['d'] : [];

        switch ((int) ($payload['op'] ?? -1)) {
            case 10: // Hello: інтервал серцебиття, потім Identify.
                $this->heartbeatEvery = max(5.0, (float) ($data['heartbeat_interval'] ?? 41250) / 1000);
                $this->nextHeartbeat = microtime(true) + $this->heartbeatEvery * (mt_rand(1, 100) / 100);
                $this->send(['op' => 2, 'd' => [
                    'token' => $token,
                    'intents' => self::INTENTS,
                    'properties' => ['os' => 'linux', 'browser' => 'gamecon', 'device' => 'gamecon'],
                ]]);

                return 0;
            case 1: // Discord просить серцебиття негайно.
                $this->send(['op' => 1, 'd' => $this->sequence]);

                return 0;
            case 7: // Reconnect
            case 9: // Invalid Session
                throw new RuntimeException('Discord попросив перепідключитися.');
            case 0:
                return $this->event((string) ($payload['t'] ?? ''), $data, $log);
        }

        return 0;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  callable(string): void|null  $log
     */
    private function event(string $type, array $data, ?callable $log): int
    {
        if ($type === 'READY' && $log) {
            $log('Бот підключився до Discord.');
        }
        if ($type === 'GUILD_CREATE') {
            $count = 0;
            foreach (is_array($data['presences'] ?? null) ? $data['presences'] : [] as $presence) {
                if (is_array($presence)) {
                    $presence['guild_id'] = $data['id'] ?? null;
                    $count += $this->presence->handle($presence) ? 1 : 0;
                }
            }

            return $count;
        }
        if ($type === 'PRESENCE_UPDATE') {
            return $this->presence->handle($data) ? 1 : 0;
        }

        return 0;
    }

    private function connect(string $url): void
    {
        $parts = parse_url($url);
        $host = is_array($parts) ? (string) ($parts['host'] ?? '') : '';
        if ($host === '') {
            throw new RuntimeException('Невірна адреса шлюзу Discord.');
        }
        $path = ($parts['path'] ?? '/').(isset($parts['query']) ? '?'.$parts['query'] : '');
        $socket = @stream_socket_client('tls://'.$host.':443', $errno, $error, 15, STREAM_CLIENT_CONNECT, stream_context_create(['ssl' => ['SNI_enabled' => true, 'peer_name' => $host]]));
        if ($socket === false) {
            throw new RuntimeException("Не вдалося з’єднатися з Discord: {$error}");
        }
        $this->socket = $socket;
        $key = base64_encode(random_bytes(16));
        $this->write("GET {$path} HTTP/1.1\r\nHost: {$host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {$key}\r\nSec-WebSocket-Version: 13\r\nUser-Agent: GameCon\r\n\r\n");

        $response = '';
        $until = microtime(true) + 15;
        while (! str_contains($response, "\r\n\r\n") && microtime(true) < $until) {
            $chunk = fread($socket, 4096);
            if ($chunk === false || ($chunk === '' && feof($socket))) {
                break;
            }
            $response .= $chunk;
        }
        [$head, $rest] = array_pad(explode("\r\n\r\n", $response, 2), 2, '');
        if (! str_starts_with($head, 'HTTP/1.1 101')) {
            throw new RuntimeException('Discord не прийняв WebSocket: '.strtok($head, "\r\n"));
        }
        $this->buffer = $rest;
        stream_set_blocking($socket, false);
    }

    /**
     * Прочитати й розібрати все, що прийшло за $timeout секунд.
     *
     * @return list<array<string, mixed>>
     */
    private function read(float $timeout): array
    {
        $socket = $this->socket;
        if ($socket === null) {
            throw new RuntimeException('Немає з’єднання з Discord.');
        }
        $read = [$socket];
        $write = $except = null;
        if (@stream_select($read, $write, $except, (int) $timeout, (int) (($timeout - floor($timeout)) * 1_000_000)) > 0) {
            $chunk = fread($socket, 65536);
            if ($chunk === false || ($chunk === '' && feof($socket))) {
                throw new RuntimeException('Discord закрив з’єднання.');
            }
            $this->buffer .= $chunk;
        }

        $messages = [];
        while (($frame = $this->frame()) !== null) {
            [$fin, $opcode, $data] = $frame;
            if ($opcode === 0x8) {
                throw new RuntimeException('Discord закрив з’єднання (код '.(strlen($data) >= 2 ? self::int('n', substr($data, 0, 2)) : 0).').');
            }
            if ($opcode === 0x9) {
                $this->writeFrame($data, 0xA);

                continue;
            }
            if ($opcode === 0x1 || $opcode === 0x0) {
                $this->fragments[] = $data;
                if ($fin) {
                    $decoded = json_decode(implode('', $this->fragments), true);
                    $this->fragments = [];
                    if (is_array($decoded)) {
                        $messages[] = $decoded;
                    }
                }
            }
        }

        return $messages;
    }

    /**
     * Один кадр із буфера (сервер кадри не маскує).
     *
     * @return array{0: bool, 1: int, 2: string}|null
     */
    private function frame(): ?array
    {
        if (strlen($this->buffer) < 2) {
            return null;
        }
        $first = ord($this->buffer[0]);
        $second = ord($this->buffer[1]);
        $length = $second & 0x7F;
        $offset = 2;
        if ($length === 126) {
            if (strlen($this->buffer) < 4) {
                return null;
            }
            $length = self::int('n', substr($this->buffer, 2, 2));
            $offset = 4;
        } elseif ($length === 127) {
            if (strlen($this->buffer) < 10) {
                return null;
            }
            $length = self::int('J', substr($this->buffer, 2, 8));
            $offset = 10;
        }
        $masked = ($second & 0x80) !== 0;
        $maskKey = $masked ? substr($this->buffer, $offset, 4) : '';
        $offset += $masked ? 4 : 0;
        if (strlen($this->buffer) < $offset + $length) {
            return null;
        }
        $data = substr($this->buffer, $offset, $length);
        if ($masked) {
            $data = $data ^ str_repeat($maskKey, intdiv($length, 4) + 1);
            $data = substr($data, 0, $length);
        }
        $this->buffer = substr($this->buffer, $offset + $length);

        return [($first & 0x80) !== 0, $first & 0x0F, $data];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function send(array $payload): void
    {
        $this->writeFrame((string) json_encode($payload), 0x1);
    }

    /** Кадр від клієнта завжди маскований (вимога WebSocket). */
    private function writeFrame(string $data, int $opcode): void
    {
        $length = strlen($data);
        $header = chr(0x80 | $opcode);
        if ($length < 126) {
            $header .= chr(0x80 | $length);
        } elseif ($length < 65536) {
            $header .= chr(0x80 | 126).pack('n', $length);
        } else {
            $header .= chr(0x80 | 127).pack('J', $length);
        }
        $mask = random_bytes(4);
        $masked = substr($data ^ str_repeat($mask, intdiv($length, 4) + 1), 0, $length);
        $this->write($header.$mask.$masked);
    }

    private function write(string $bytes): void
    {
        $socket = $this->socket;
        if ($socket === null) {
            throw new RuntimeException('Немає з’єднання з Discord.');
        }
        $until = microtime(true) + 10;
        while ($bytes !== '' && microtime(true) < $until) {
            $written = @fwrite($socket, $bytes);
            if ($written === false) {
                throw new RuntimeException('Не вдалося надіслати дані в Discord.');
            }
            $bytes = substr($bytes, $written);
            if ($bytes !== '') {
                usleep(10_000);
            }
        }
    }

    private static function int(string $format, string $bytes): int
    {
        $value = unpack($format, $bytes);

        return is_array($value) && isset($value[1]) && is_int($value[1]) ? $value[1] : 0;
    }

    private function close(): void
    {
        if ($this->socket !== null) {
            @fclose($this->socket);
            $this->socket = null;
        }
        $this->buffer = '';
        $this->fragments = [];
        $this->nextHeartbeat = 0;
    }
}
