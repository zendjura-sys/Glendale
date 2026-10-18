<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

/** Відкритий блок спільноти для сайту сервера: без входу і без iframe. */
class CommunityWidgetController extends Controller
{
    public function show(Community $community): JsonResponse
    {
        $this->open($community);

        $posts = Post::query()
            ->with('author')
            ->where('wall_type', $community->getMorphClass())
            ->where('wall_id', $community->id)
            ->visibleTo(null)
            ->latest('id')
            ->limit(3)
            ->get()
            ->map(fn (Post $post) => [
                'text' => $post->spoiler ? 'Спойлер' : Str::limit(trim((string) $post->body), 140),
                'author' => $post->author?->name,
                'href' => url('/posts/'.$post->id),
            ])
            ->filter(fn (array $post) => $post['text'] !== '')
            ->values();

        return response()->json([
            'name' => $community->name,
            'members' => $community->members_count,
            'members_label' => $community->members_count.' учасників',
            'href' => url('/c/'.$community->slug),
            'posts' => $posts,
        ])->header('Access-Control-Allow-Origin', '*');
    }

    public function script(Community $community): Response
    {
        $this->open($community);
        $url = json_encode(url('/widget/'.$community->slug), JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $script = <<<JS
(function () {
    var current = document.currentScript;
    if (!current || !current.parentNode) return;
    var box = document.createElement('div');
    box.style.cssText = 'font:14px/1.4 system-ui,sans-serif;color:#f4f6ff;background:#12162a;border-radius:16px;padding:16px;max-width:360px';
    current.parentNode.insertBefore(box, current);
    fetch({$url}, { credentials: 'omit' }).then(function (response) {
        return response.json();
    }).then(function (data) {
        var title = document.createElement('a');
        title.href = data.href;
        title.textContent = data.name;
        title.style.cssText = 'color:#fff;font-weight:700;text-decoration:none';
        box.appendChild(title);
        var meta = document.createElement('div');
        meta.textContent = data.members_label || '';
        meta.style.cssText = 'margin-top:4px;color:rgba(255,255,255,.55);font-size:12px';
        box.appendChild(meta);
        (data.posts || []).forEach(function (post) {
            var line = document.createElement('a');
            line.href = post.href;
            line.textContent = post.text;
            line.style.cssText = 'display:block;margin-top:10px;color:rgba(255,255,255,.8);text-decoration:none';
            box.appendChild(line);
        });
    }).catch(function () {
        box.textContent = '';
    });
})();
JS;

        return response($script, 200, [
            'Content-Type' => 'application/javascript; charset=UTF-8',
            'Access-Control-Allow-Origin' => '*',
            'Cache-Control' => 'public, max-age=300',
        ]);
    }

    private function open(Community $community): void
    {
        abort_if($community->isClosed(), 404);
    }
}
