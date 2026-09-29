<?php

namespace Tests\Feature\Cinema;

use App\Cinema\Kodik\KodikApiException;
use App\Cinema\Kodik\KodikClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class KodikClientTest extends TestCase
{
    private const TOKEN = 'super-secret-kodik-token';

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
    }

    public function test_search_returns_a_valid_page_and_sends_the_token(): void
    {
        Http::fake([
            'kodikapi.com/search*' => Http::response([
                'total' => 1,
                'results' => [['id' => 'serial-1', 'link' => '//kodik.info/serial/1']],
                'next_page' => 'cursor-2',
            ]),
        ]);

        $page = (new KodikClient(self::TOKEN))->search(['title' => 'Bleach']);

        $this->assertSame(1, $page->total);
        $this->assertSame('cursor-2', $page->nextPage);
        $this->assertSame('serial-1', $page->results[0]['id']);
        Http::assertSent(function ($request): bool {
            parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);

            return ($query['token'] ?? null) === self::TOKEN
                && ($query['title'] ?? null) === 'Bleach';
        });
    }

    public function test_list_accepts_a_valid_empty_result(): void
    {
        Http::fake([
            'kodikapi.com/list*' => Http::response(['total' => 0, 'results' => [], 'next_page' => null]),
        ]);

        $page = (new KodikClient(self::TOKEN))->list(['limit' => 100]);

        $this->assertSame([], $page->results);
        $this->assertSame(0, $page->total);
        $this->assertNull($page->nextPage);
    }

    public static function authenticationStatuses(): array
    {
        return [[401], [403]];
    }

    #[DataProvider('authenticationStatuses')]
    public function test_authentication_errors_are_terminal_and_redacted(int $status): void
    {
        Http::fake(['kodikapi.com/search*' => Http::response(['error' => 'bad token'], $status)]);

        try {
            (new KodikClient(self::TOKEN))->search(['title' => 'Bleach']);
            $this->fail('KodikApiException was not thrown.');
        } catch (KodikApiException $exception) {
            $this->assertSame('auth', $exception->kind());
            $this->assertFalse($exception->retryable());
            $this->assertStringNotContainsString(self::TOKEN, $exception->getMessage());
            $this->assertStringNotContainsString(self::TOKEN, json_encode($exception->context(), JSON_THROW_ON_ERROR));
        }

        Http::assertSentCount(1);
    }

    public function test_rate_limit_is_retried_then_reported(): void
    {
        Http::fake(['kodikapi.com/list*' => Http::response(['error' => 'slow down'], 429)]);

        try {
            (new KodikClient(self::TOKEN))->list([]);
            $this->fail('KodikApiException was not thrown.');
        } catch (KodikApiException $exception) {
            $this->assertSame('rate_limit', $exception->kind());
            $this->assertTrue($exception->retryable());
        }

        Http::assertSentCount(3);
    }

    public function test_server_error_is_retried_then_reported(): void
    {
        Http::fake(['kodikapi.com/search*' => Http::response('unavailable', 503)]);

        try {
            (new KodikClient(self::TOKEN))->search([]);
            $this->fail('KodikApiException was not thrown.');
        } catch (KodikApiException $exception) {
            $this->assertSame('server', $exception->kind());
            $this->assertTrue($exception->retryable());
        }

        Http::assertSentCount(3);
    }

    public function test_connection_error_is_retried_then_reported(): void
    {
        $attempts = 0;
        Http::fake(function () use (&$attempts) {
            $attempts++;
            throw new ConnectionException('connection failed');
        });

        try {
            (new KodikClient(self::TOKEN))->search([]);
            $this->fail('KodikApiException was not thrown.');
        } catch (KodikApiException $exception) {
            $this->assertSame('transport', $exception->kind());
            $this->assertTrue($exception->retryable());
            $this->assertStringNotContainsString(self::TOKEN, $exception->getMessage());
        }

        $this->assertSame(3, $attempts);
    }

    public function test_invalid_json_is_a_terminal_contract_error(): void
    {
        Http::fake(['kodikapi.com/search*' => Http::response('{broken', 200, ['Content-Type' => 'application/json'])]);

        $this->expectException(KodikApiException::class);
        $this->expectExceptionMessage('contract');

        (new KodikClient(self::TOKEN))->search([]);
    }

    public function test_missing_results_is_a_terminal_contract_error(): void
    {
        Http::fake(['kodikapi.com/list*' => Http::response(['total' => 1], 200)]);

        try {
            (new KodikClient(self::TOKEN))->list([]);
            $this->fail('KodikApiException was not thrown.');
        } catch (KodikApiException $exception) {
            $this->assertSame('contract', $exception->kind());
            $this->assertFalse($exception->retryable());
        }

        Http::assertSentCount(1);
    }
}
