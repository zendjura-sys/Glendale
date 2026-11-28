<?php

namespace App\Services\Account;

use App\Models\Comment;
use App\Models\CommunityMember;
use App\Models\DataExport;
use App\Models\GameBacklog;
use App\Models\GameReview;
use App\Models\LoginEvent;
use App\Models\Message;
use App\Models\MovieList;
use App\Models\MovieReview;
use App\Models\Photo;
use App\Models\Playlist;
use App\Models\Post;
use App\Models\Track;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\FriendshipService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use ZipArchive;

/**
 * Повний архів «Мої дані» (GDPR, ст. 15 і 20): усі розділи окремими JSON-файлами у ZIP
 * плюс власні файли — аватар, обкладинка, фото, картинки записів, завантажені треки.
 * Чужі дані (повідомлення співрозмовників, чужі коментарі) в архів не потрапляють.
 */
class DataExporter
{
    /** Скільки медіа класти в архів (решта — посиланнями в media.json). */
    public const MEDIA_LIMIT_BYTES = 1_500_000_000;

    public function __construct(private readonly FriendshipService $friendships) {}

    public function build(DataExport $export): void
    {
        $user = $export->user ?? throw new RuntimeException('Немає власника архіву');
        $dir = 'exports';
        Storage::disk('local')->makeDirectory($dir);
        $rel = $dir.'/gamecon-'.$user->id.'-'.$export->id.'-'.bin2hex(random_bytes(8)).'.zip';
        $full = Storage::disk('local')->path($rel);

        $zip = new ZipArchive;
        if ($zip->open($full, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Не вдалося створити архів');
        }
        $zip->addFromString('README.txt', $this->readme($user));
        foreach ($this->sections($user) as $name => $rows) {
            $zip->addFromString("data/{$name}.json", (string) json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
        }
        $skipped = $this->media($zip, $user);
        if ($skipped !== []) {
            $zip->addFromString('media/not-included.json', (string) json_encode($skipped, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
        }
        $zip->close();

        $export->update([
            'status' => 'ready',
            'path' => $rel,
            'size' => (int) filesize($full),
            'ready_at' => now(),
            'expires_at' => now()->addDays(DataExport::DAYS),
        ]);
    }

    /** Прибрати прострочені архіви (це копії, самі дані людини лишаються). */
    public function prune(): int
    {
        $count = 0;
        DataExport::query()->whereNotNull('path')->where('expires_at', '<', now())->each(function (DataExport $e) use (&$count) {
            Storage::disk('local')->delete((string) $e->path);
            $e->update(['path' => null]);
            $count++;
        });

        return $count;
    }

    /**
     * @return array<string, mixed>
     */
    private function sections(User $user): array
    {
        $iso = fn ($d) => $d?->toIso8601String();

        return [
            'profile' => [
                'username' => $user->username,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'about' => $user->about,
                'city' => $user->city,
                'country' => $user->country,
                'birthday' => $user->birthday?->toDateString(),
                'website' => $user->website,
                'locale' => $user->locale,
                'created_at' => $iso($user->created_at),
                'preferences' => $user->getAttribute('preferences'),
            ],
            'friends' => User::query()->whereIn('id', $this->friendships->friendIds($user))->pluck('username')->values(),
            'communities' => CommunityMember::query()->with('community')->where('user_id', $user->id)->get()
                ->map(fn (CommunityMember $m) => ['community' => $m->community?->slug, 'role' => $m->role, 'joined_at' => $iso($m->created_at)])->values(),
            'posts' => Post::query()->with('attachments')->where('author_id', $user->id)->orderBy('id')->get()
                ->map(fn (Post $p) => ['id' => $p->id, 'body' => $p->body, 'visibility' => $p->visibility, 'images' => $p->attachments->pluck('path')->map(fn ($x) => 'media/posts/'.basename((string) $x))->all(), 'created_at' => $iso($p->created_at)])->values(),
            'comments' => Comment::query()->where('user_id', $user->id)->orderBy('id')->get()
                ->map(fn (Comment $c) => ['post_id' => $c->post_id, 'body' => $c->body, 'created_at' => $iso($c->created_at)])->values(),
            'messages_sent' => Message::query()->where('user_id', $user->id)->orderBy('id')->get()
                ->map(fn (Message $m) => ['conversation_id' => $m->conversation_id, 'body' => $m->body, 'created_at' => $iso($m->created_at)])->values(),
            'photos' => Photo::query()->where('user_id', $user->id)->orderBy('id')->get()
                ->map(fn (Photo $p) => ['file' => 'media/photos/'.basename($p->path), 'caption' => $p->caption, 'created_at' => $iso($p->created_at)])->values(),
            'game_backlog' => GameBacklog::query()->with('game')->where('user_id', $user->id)->get()
                ->map(fn (GameBacklog $b) => ['game' => $b->game?->name, 'status' => $b->status, 'updated_at' => $iso($b->updated_at)])->values(),
            'game_reviews' => GameReview::query()->with('game')->where('user_id', $user->id)->get()
                ->map(fn (GameReview $r) => ['game' => $r->game?->name, 'score' => $r->score, 'body' => $r->body, 'created_at' => $iso($r->created_at)])->values(),
            'movie_reviews' => MovieReview::query()->with('movie')->where('user_id', $user->id)->get()
                ->map(fn (MovieReview $r) => ['movie' => $r->movie?->title, 'score' => $r->score, 'body' => $r->body, 'created_at' => $iso($r->created_at)])->values(),
            'movie_history' => DB::table('movie_user')->join('movies', 'movies.id', '=', 'movie_user.movie_id')->where('movie_user.user_id', $user->id)
                ->get(['movies.title', 'movie_user.status', 'movie_user.rating', 'movie_user.watched_at', 'movie_user.updated_at']),
            'movie_lists' => MovieList::query()->with('movies')->where('user_id', $user->id)->get()
                ->map(fn (MovieList $l) => ['title' => $l->title, 'description' => $l->description, 'public' => $l->is_public, 'movies' => $l->movies->pluck('title')->all()])->values(),
            'music_uploads' => Track::query()->where('user_id', $user->id)->get()
                ->map(fn (Track $t) => ['title' => $t->title, 'artist' => $t->artist, 'album' => $t->album, 'file' => 'media/tracks/'.basename($t->path)])->values(),
            'playlists' => Playlist::query()->with('tracks')->where('user_id', $user->id)->get()
                ->map(fn (Playlist $p) => ['title' => $p->title, 'tracks' => $p->tracks->map(fn (Track $t) => $t->artist.' — '.$t->title)->all()])->values(),
            'wallet' => WalletTransaction::query()->where('user_id', $user->id)->orderBy('id')->get()
                ->map(fn (WalletTransaction $w) => ['type' => $w->type, 'amount' => $w->amount, 'balance_after' => $w->balance_after, 'description' => $w->description, 'created_at' => $iso($w->created_at)])->values(),
            'login_history' => LoginEvent::query()->where('user_id', $user->id)->latest('id')->limit(500)->get()
                ->map(fn (LoginEvent $e) => ['method' => $e->method, 'success' => $e->success, 'ip' => $e->ip, 'user_agent' => $e->user_agent, 'at' => $iso($e->created_at)])->values(),
        ];
    }

    /**
     * Власні файли в media/…; що не влізло в ліміт — список у not-included.json.
     *
     * @return list<array{file: string, reason: string}>
     */
    private function media(ZipArchive $zip, User $user): array
    {
        $disk = Storage::disk('public');
        $budget = self::MEDIA_LIMIT_BYTES;
        $skipped = [];
        $add = function (?string $path, string $folder) use ($zip, $disk, &$budget, &$skipped) {
            if (! $path || ! $disk->exists($path)) {
                return;
            }
            $size = (int) $disk->size($path);
            if ($size > $budget) {
                $skipped[] = ['file' => $disk->url($path), 'reason' => 'Архів завеликий — завантажте окремо за посиланням'];

                return;
            }
            $budget -= $size;
            $zip->addFile($disk->path($path), "media/{$folder}/".basename($path));
        };

        $add($user->avatar_path, 'profile');
        $add($user->cover_path, 'profile');
        Photo::query()->where('user_id', $user->id)->orderBy('id')->each(fn (Photo $p) => $add($p->path, 'photos'));
        DB::table('post_attachments')->join('posts', 'posts.id', '=', 'post_attachments.post_id')
            ->where('posts.author_id', $user->id)->orderBy('post_attachments.id')->pluck('post_attachments.path')
            ->each(fn ($path) => $add((string) $path, 'posts'));
        Track::query()->where('user_id', $user->id)->orderBy('id')->each(function (Track $t) use ($add) {
            $add($t->path, 'tracks');
            $add($t->cover_path, 'tracks');
        });

        return $skipped;
    }

    private function readme(User $user): string
    {
        return "Архів даних GameCon для @{$user->username}\n"
            .'Створено: '.now('Europe/Kyiv')->format('d.m.Y H:i')." (Київ)\n\n"
            ."data/*.json — ваш профіль, друзі, записи, коментарі, надіслані повідомлення, фото, ігри,\n"
            ."кіно, музика, гаманець і журнал входів.\n"
            ."media/ — ваші файли: аватар, обкладинка, фото, картинки записів, завантажені треки.\n\n"
            ."Повідомлення співрозмовників і чужі коментарі не включено — це їхні дані.\n";
    }
}
