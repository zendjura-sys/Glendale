<?php

namespace App\Http\Controllers\Developer;

use App\Http\Controllers\Controller;
use App\Models\DeveloperApp;
use App\Models\DeveloperToken;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Набір для сайтів і плагінів: /embed.js (картка профілю, «Поділитися в GameCon», віджет сервера,
 * дзвіночок сповіщень, значок «GameCon»), сторінка /share і лічильник дзвіночка за токеном.
 */
class EmbedKitController extends Controller
{
    public function script(): Response
    {
        $js = str_replace('__BASE__', rtrim(url('/'), '/'), (string) file_get_contents(resource_path('embed/embed.js')));

        return response($js, 200, [
            'Content-Type' => 'application/javascript; charset=utf-8',
            'Cache-Control' => 'public, max-age=3600',
            'Access-Control-Allow-Origin' => '*',
        ]);
    }

    /** «Поділитися в GameCon»: чернетка запису з назвою й посиланням — і в стрічку. */
    public function share(Request $request): Response
    {
        $url = (string) $request->query('url', '');
        $url = preg_match('#^https?://#i', $url) && filter_var($url, FILTER_VALIDATE_URL) ? $url : '';
        $title = mb_substr(trim(strip_tags((string) $request->query('title', ''))), 0, 200);
        $text = trim($title."\n".$url);

        return response()->view('share', ['draft' => $text, 'feed' => url('/feed')]);
    }

    /** Токен дзвіночка: лише кількість непрочитаних, діє, поки застосунок підключений. */
    public static function bellToken(User $user, DeveloperApp $app): string
    {
        $payload = $user->id.'.'.$app->id;

        return rtrim(strtr(base64_encode($payload.'.'.hash_hmac('sha256', 'bell|'.$payload, (string) config('app.key'))), '+/', '-_'), '=');
    }

    public function bell(Request $request): JsonResponse
    {
        $headers = ['Access-Control-Allow-Origin' => '*', 'Cache-Control' => 'private, max-age=30'];
        $raw = base64_decode(strtr((string) $request->query('t', ''), '-_', '+/'), true);
        $parts = is_string($raw) ? explode('.', $raw) : [];
        if (count($parts) !== 3 || ! hash_equals(hash_hmac('sha256', 'bell|'.$parts[0].'.'.$parts[1], (string) config('app.key')), $parts[2])) {
            return response()->json(['count' => null], 404, $headers);
        }
        [$userId, $appId] = [(int) $parts[0], (int) $parts[1]];
        $connected = DeveloperToken::query()->where('user_id', $userId)->where('developer_app_id', $appId)->whereNull('revoked_at')->exists()
            && DeveloperApp::query()->whereKey($appId)->whereNull('blocked_at')->exists();
        $user = $connected ? User::query()->find($userId) : null;
        if ($user === null) {
            return response()->json(['count' => null], 404, $headers);
        }

        return response()->json(['count' => $user->unreadNotifications()->count(), 'url' => url('/notifications')], 200, $headers);
    }
}
