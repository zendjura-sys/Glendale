<?php

namespace App\Http\Controllers;

use App\Models\GtaServer;
use App\Models\User;
use App\Services\Servers\ServerFamilyRanking;
use App\Services\Servers\ServerVotes;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

    /** Дані розширеного віджета сервера: онлайн, топ сімей, голоси місяця, Discord. */
    public function serverData(GtaServer $server): JsonResponse
    {
        $this->ensureServer($server);
        $families = array_slice(app(ServerFamilyRanking::class)->rows($server, 'month'), 0, 3);
        $votes = app(Plugins::class)->on('server_votes') ? (app(ServerVotes::class)->monthCounts()[$server->id] ?? 0) : 0;

        return $this->json([
            'name' => $server->name,
            'tagline' => $server->tagline,
            'icon' => $server->icon,
            'verified' => $server->verified_at !== null,
            'online' => $server->players_online,
            'max' => $server->players_max,
            'peak' => $server->players_peak,
            'families' => array_map(fn (array $f) => ['name' => (string) $f['name'], 'points' => (int) $f['points']], $families),
            'votes' => (int) $votes,
            'discord' => $server->discordUrl(),
            'href' => url('/servers/'.$server->slug),
            'vote_url' => url('/servers/'.$server->slug.'#vote'),
            // Підписи українською (віджет — частина інтерфейсу GameCon).
            'labels' => ['online' => 'Онлайн', 'peak' => 'пік', 'families' => 'Топ сімей місяця', 'points' => 'очок', 'vote' => 'Голосувати', 'on_gamecon' => 'Сервер на GameCon'],
        ]);
    }

    /** Скрипт розширеного віджета: статичний файл + адреса даних цього сервера. */
    public function serverWidget(GtaServer $server): Response
    {
        $this->ensureServer($server);
        $endpoint = json_encode(url('/widget/s/'.$server->slug.'/data'), JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $code = (string) file_get_contents(public_path('widgets/server-widget.js'));
        // Адресу даних підставляємо в document.currentScript, щоб власнику вистачило одного тегу.
        $code = str_replace("var endpoint = current.getAttribute('data-endpoint');", "var endpoint = current.getAttribute('data-endpoint') || {$endpoint};", $code);

        return response($code, 200, [
            'Content-Type' => 'application/javascript; charset=UTF-8',
            'Access-Control-Allow-Origin' => '*',
            'Cache-Control' => 'public, max-age=300',
        ]);
    }

    /** Попередній перегляд для конструктора (той самий скрипт з обраними параметрами). */
    public function serverPreview(Request $request, GtaServer $server): Response
    {
        $this->ensureServer($server);
        $theme = $request->query('theme') === 'light' ? 'light' : 'dark';
        $show = implode(',', array_intersect(explode(',', (string) $request->query('show', 'online,families,vote,discord')), ['online', 'families', 'vote', 'discord']));
        $accent = preg_match('/^#[0-9a-f]{6}$/i', (string) $request->query('accent')) === 1 ? (string) $request->query('accent') : '#6366f1';
        $src = e(url('/widget/s/'.$server->slug.'/widget.js'));
        $bg = $theme === 'light' ? '#eef2f7' : '#05080f';

        return response("<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><style>body{margin:0;padding:16px;background:{$bg}}</style></head><body><script src=\"{$src}\" data-theme=\"{$theme}\" data-show=\"".e($show).'" data-accent="'.e($accent).'"></script></body></html>', 200, ['Content-Type' => 'text/html; charset=UTF-8']);
    }

    private function ensureServer(GtaServer $server): void
    {
        abort_unless(app(Plugins::class)->on('embed_widgets') && $server->status === GtaServer::STATUS_PUBLISHED, 404);
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
