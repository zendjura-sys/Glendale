<?php

namespace Tests\Feature;

use App\Services\Cinema\KodikClient;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Kodik: наступні сторінки за next_page не гублять токен і курсор (раніше — хибне «Kodik відхилив токен»). */
class KodikPagingTest extends TestCase
{
    use RefreshDatabase;

    public function test_next_page_keeps_its_query_string(): void
    {
        config(['services.kodik.api_url' => 'https://kodik-api.com', 'services.kodik.token' => null]);
        app(SiteSettings::class)->putSecret('kodik_token', 'kodik-token-123');

        $item = fn (string $id) => ['id' => 'movie-'.$id, 'type' => 'foreign-movie', 'link' => '//kodik.info/video/'.$id.'/hash/720p', 'title' => 'Фільм '.$id, 'year' => 2024, 'kinopoisk_id' => $id, 'translation' => ['id' => 1, 'title' => 'Дубляж', 'type' => 'voice']];
        Http::fake(function (HttpRequest $request) use ($item) {
            parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);
            if (($query['token'] ?? null) !== 'kodik-token-123') {
                return Http::response(['error' => 'Отсутствует или неверный токен'], 500);
            }

            return isset($query['next'])
                ? Http::response(['results' => [$item('2')]])
                : Http::response(['results' => [$item('1')], 'next_page' => 'https://kodik-api.com/list?token=kodik-token-123&limit=100&next=abc']);
        });

        $pages = iterator_to_array(app(KodikClient::class)->updates(null, 3), false);

        $this->assertCount(2, $pages);
        Http::assertSent(fn (HttpRequest $r) => str_contains($r->url(), 'next=abc') && str_contains($r->url(), 'token=kodik-token-123'));
    }
}
