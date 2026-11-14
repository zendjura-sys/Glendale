<?php

namespace App\Services\System;

use App\Services\Cinema\CinemaException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Журнал помилок для адмінки: справжні збої (5xx), згруповані за місцем у коді.
 * Очікувані відмови (404, 403, валідація, сесія) сюди не потрапляють; запис не має права зламати відповідь.
 */
class ErrorJournal
{
    /** @var list<class-string> */
    private const IGNORED = [
        ValidationException::class,
        AuthenticationException::class,
        AuthorizationException::class,
        ModelNotFoundException::class,
        TokenMismatchException::class,
        // Плеєр балансера не відповів — це збій чужого сервісу, глядач уже бачить повідомлення.
        CinemaException::class,
    ];

    public function record(Throwable $e): void
    {
        foreach (self::IGNORED as $class) {
            if ($e instanceof $class) {
                return;
            }
        }
        if ($e instanceof HttpExceptionInterface && $e->getStatusCode() < 500) {
            return;
        }

        rescue(function () use ($e) {
            $file = Str::after($e->getFile(), base_path().DIRECTORY_SEPARATOR);
            $fingerprint = sha1($e::class.'|'.$file.'|'.$e->getLine());
            $request = app()->runningInConsole() ? null : request();
            $now = now();
            $updated = DB::table('error_logs')->where('fingerprint', $fingerprint)->update([
                'count' => DB::raw('count + 1'),
                'last_seen_at' => $now,
                'message' => Str::limit($e->getMessage(), 2000),
                // Повторилася після «вирішено» — знову відкрита.
                'resolved_at' => null,
            ]);
            if ($updated === 0) {
                $inserted = DB::table('error_logs')->insertOrIgnore([
                    'fingerprint' => $fingerprint,
                    'class' => Str::limit($e::class, 200, ''),
                    'message' => Str::limit($e->getMessage(), 2000),
                    'file' => Str::limit($file, 300, ''),
                    'line' => $e->getLine(),
                    'url' => $request ? Str::limit($request->fullUrl(), 500, '') : 'console',
                    'method' => $request?->method(),
                    'user_id' => $request?->user()?->id,
                    'count' => 1,
                    'first_seen_at' => $now,
                    'last_seen_at' => $now,
                ]);
                // Нова група помилок — алерт адміністраторам у Telegram.
                if ($inserted > 0) {
                    app(AdminAlerts::class)->newError($e::class, $e->getMessage(), $file, $e->getLine(), $request ? $request->fullUrl() : 'console');
                }
            }
        }, report: false);
    }
}
