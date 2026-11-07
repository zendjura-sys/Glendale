<?php

namespace App\Http\Controllers;

use App\Models\GtaServer;
use App\Models\User;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/**
 * Віджети для чужих сайтів (без входу й без iframe): картка гравця й картка сервера
 * з онлайном. Код — <script src=".../card.js" async></script>.
 */
class EmbedWidgetController extends Controller
{
    public function user(User $user): JsonResponse
    {
        $this->ensureUser($user);

        return $this->json([
            'kind' => 'user',
            'name' => $user->name,
            'subtitle' => '@'.$user->username,
            'image' => $user->avatar_url,
            'lines' => array_values(array_filter([
                $user->status ? (string) $user->status : null,
                ($playing = $user->playing()) ? 'Грає: '.$playing['label'] : null,
            ])),
            'href' => url('/'.$user->username),
            'cta' => 'Додати в друзі на GameCon',
        ]);
    }

    public function server(GtaServer $server): JsonResponse
    {
        abort_unless(app(Plugins::class)->on('embed_widgets') && $server->status === GtaServer::STATUS_PUBLISHED, 404);
        $online = $server->players_online !== null
            ? 'Онлайн: '.$server->players_online.($server->players_max ? ' / '.$server->players_max : '')
            : null;

        return $this->json([
            'kind' => 'server',
            'name' => $server->name,
            'subtitle' => $server->tagline,
            'image' => $server->icon,
            'lines' => array_values(array_filter([$online, $server->connect ? 'Підключення: '.$server->connect : null])),
            'href' => url('/servers/'.$server->slug),
            'cta' => 'Сторінка сервера на GameCon',
        ]);
    }

    public function userScript(User $user): Response
    {
        $this->ensureUser($user);

        return $this->script(url('/widget/u/'.$user->username));
    }

    public function serverScript(GtaServer $server): Response
    {
        abort_unless(app(Plugins::class)->on('embed_widgets') && $server->status === GtaServer::STATUS_PUBLISHED, 404);

        return $this->script(url('/widget/s/'.$server->slug));
    }

    private function ensureUser(User $user): void
    {
        abort_unless(app(Plugins::class)->on('embed_widgets'), 404);
        abort_if($user->is_private || $user->isBanned() || $user->frozen_at !== null, 404);
    }

    /** @param  array<string, mixed>  $data */
    private function json(array $data): JsonResponse
    {
        return response()->json($data)->header('Access-Control-Allow-Origin', '*')->header('Cache-Control', 'public, max-age=120');
    }

    private function script(string $endpoint): Response
    {
        $url = json_encode($endpoint, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $script = <<<JS
(function () {
    var current = document.currentScript;
    if (!current || !current.parentNode) return;
    var box = document.createElement('a');
    box.style.cssText = 'display:flex;gap:12px;align-items:center;font:14px/1.4 system-ui,sans-serif;color:#f4f6ff;background:linear-gradient(135deg,#1a1f3a,#11152a);border-radius:18px;padding:14px 16px;max-width:360px;text-decoration:none;box-sizing:border-box';
    current.parentNode.insertBefore(box, current);
    fetch({$url}, { credentials: 'omit' }).then(function (response) {
        return response.json();
    }).then(function (data) {
        box.href = data.href;
        box.target = '_blank';
        box.rel = 'noopener';
        if (data.image) {
            var img = document.createElement('img');
            img.src = data.image;
            img.alt = '';
            img.style.cssText = 'width:52px;height:52px;border-radius:' + (data.kind === 'user' ? '50%' : '14px') + ';object-fit:cover;flex-shrink:0';
            box.appendChild(img);
        }
        var text = document.createElement('div');
        text.style.cssText = 'min-width:0';
        var title = document.createElement('div');
        title.textContent = data.name;
        title.style.cssText = 'font-weight:700;color:#fff';
        text.appendChild(title);
        if (data.subtitle) {
            var sub = document.createElement('div');
            sub.textContent = data.subtitle;
            sub.style.cssText = 'color:rgba(255,255,255,.55);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
            text.appendChild(sub);
        }
        (data.lines || []).forEach(function (value) {
            var line = document.createElement('div');
            line.textContent = value;
            line.style.cssText = 'margin-top:4px;color:rgba(255,255,255,.8);font-size:13px';
            text.appendChild(line);
        });
        var cta = document.createElement('div');
        cta.textContent = data.cta + ' →';
        cta.style.cssText = 'margin-top:6px;color:#8fb8ff;font-size:12px;font-weight:600';
        text.appendChild(cta);
        box.appendChild(text);
    }).catch(function () {
        box.remove();
    });
})();
JS;

        return response($script, 200, [
            'Content-Type' => 'application/javascript; charset=UTF-8',
            'Access-Control-Allow-Origin' => '*',
            'Cache-Control' => 'public, max-age=300',
        ]);
    }
}
