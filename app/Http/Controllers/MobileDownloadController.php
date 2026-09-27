<?php

namespace App\Http\Controllers;

use App\Support\MobileRelease;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Мобільний застосунок раніше качав APK напряму з github.com/releases на
 * телефон — і в частини користувачів це стабільно провалювалось (GitHub
 * недоступний чи обрізається на мобільній мережі/операторі), хоча сам
 * сервер сайту до GitHub достукується без проблем. Тому тепер телефон
 * качає з нашого власного домену, а цей контролер лише проксіює запит
 * до того самого GitHub Release на бекенді — без локального кешу на
 * диску, щоб файл завжди був актуальним одразу після нової CI-збірки.
 */
class MobileDownloadController extends Controller
{
    public function apk(): StreamedResponse
    {
        return $this->proxy(MobileRelease::source('monsory-connect.apk'), 'monsory-connect.apk', 'application/vnd.android.package-archive');
    }

    public function build(): HttpResponse
    {
        $body = MobileRelease::fetch('build.txt', 10);

        return response($body ?? '', $body === null ? 502 : 200)
            ->header('Content-Type', 'text/plain');
    }

    /** @param  array{url: string, headers: array<string, string>}  $src */
    private function proxy(array $src, string $filename, string $contentType): StreamedResponse
    {
        $upstream = Http::timeout(60)->withHeaders($src['headers'])->withOptions(['stream' => true])->get($src['url']);
        $body = $upstream->toPsrResponse()->getBody();

        return response()->stream(function () use ($body) {
            while (! $body->eof()) {
                echo $body->read(1024 * 64);
                flush();
            }
        }, $upstream->status(), [
            'Content-Type' => $contentType,
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Content-Length' => $upstream->header('Content-Length'),
        ]);
    }
}
