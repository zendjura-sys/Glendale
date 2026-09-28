<?php

namespace App\Http\Controllers\Api\V2;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Social\Presenter;
use App\Social\Social;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Фото, сповіщення, пошук, скарги. */
class MiscController extends Controller
{
    public const REPORT_CATEGORIES = [
        'spam' => 'Спам',
        'abuse' => 'Образи',
        'inappropriate' => 'Неприйнятний вміст',
        'fake' => 'Фейк або шахрайство',
        'copyright' => 'Порушення авторських прав',
        'other' => 'Інше',
    ];

    public function uploadPhotos(Request $request): JsonResponse
    {
        $request->validate([
            'images' => ['required', 'array', 'min:1', 'max:10'],
            'images.*' => Social::IMAGE_RULES,
        ]);
        $me = $request->user()->id;

        $photos = [];
        foreach ($request->file('images') as $file) {
            $id = DB::table('social_photos')->insertGetId([
                'user_id' => $me,
                'path' => Social::storeImage($file, 'photos'),
                'album' => 'uploaded',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $photos[] = Presenter::photo(DB::table('social_photos')->find($id));
        }

        return response()->json($photos, 201);
    }

    public function destroyPhoto(Request $request, int $id): JsonResponse
    {
        $deleted = DB::table('social_photos')->where('id', $id)->where('user_id', $request->user()->id)->delete();
        if (! $deleted) {
            Social::fail(404, 'Фотографію не знайдено');
        }

        return response()->json(['ok' => true]);
    }

    public function notifications(Request $request): JsonResponse
    {
        $rows = DB::table('social_notifications')->where('user_id', $request->user()->id)
            ->where('id', '<', Social::before($request))->orderByDesc('id')->limit(Social::PAGE)->get()->all();

        return response()->json(Social::page(Presenter::notifications($rows)));
    }

    public function readNotifications(Request $request): JsonResponse
    {
        DB::table('social_notifications')->where('user_id', $request->user()->id)->where('is_read', false)->update(['is_read' => true]);

        return response()->json(['ok' => true]);
    }

    public function search(Request $request): JsonResponse
    {
        $search = Social::str($request->query('q'), 100);
        if ($search === '') {
            return response()->json(['users' => [], 'groups' => [], 'posts' => [], 'tracks' => [], 'titles' => [], 'families' => []]);
        }
        $me = $request->user();
        $like = '%'.$search.'%';

        $users = User::query()->where('is_shadow', false)
            ->where(fn ($q) => $q->where('name', 'like', $like)
                ->orWhere('first_name', 'like', $like)
                ->orWhere('last_name', 'like', $like)
                ->orWhere('city', 'like', $like))
            ->orderByDesc('last_seen_at')->limit(30)->get();
        $groups = DB::table('social_groups')->where(fn ($q) => $q->where('name', 'like', $like)->orWhere('description', 'like', $like))
            ->limit(20)->get()->all();
        $postQuery = DB::table('social_posts')->where('text', 'like', $like);
        $posts = Social::visiblePosts($postQuery, $me->id)->orderByDesc('id')->limit(20)->get()->all();
        // Один пошук на весь сайт: і фільми кінопорталу, і родини.
        $titles = \App\Cinema\Title::query()->published()->with('genres')
            ->where(fn ($q) => $q->where('name', 'like', $like)->orWhere('original_name', 'like', $like)->orWhere('alt_names', 'like', $like))
            ->orderByDesc('popularity')->limit(20)->get();
        $families = DB::table('families')->where('status', 'verified')
            ->where(fn ($q) => $q->where('name', 'like', $like)->orWhere('tag', 'like', $like))->limit(20)->get()->all();

        return response()->json([
            'users' => $users->map(fn ($u) => [...Presenter::userShort($u), 'city' => (string) $u->city, 'friendship' => Social::friendship($me->id, $u->id)])->values(),
            'groups' => Presenter::groups($groups, $me->id),
            'posts' => Presenter::posts($posts, $me),
            'tracks' => [],
            'titles' => \App\Cinema\CinemaPresenter::cards($titles),
            'families' => \App\Social\Families::presentMany($families, $me),
        ]);
    }

    public function report(Request $request): JsonResponse
    {
        $type = Social::str($request->input('targetType'), 20);
        $id = (int) $request->input('targetId');
        $category = Social::str($request->input('category'), 30);

        $tables = ['post' => 'social_posts', 'comment' => 'social_comments', 'user' => 'users', 'group' => 'social_groups'];
        if (! isset($tables[$type]) || $id < 1 || ! DB::table($tables[$type])->where('id', $id)->exists()) {
            Social::fail(404, "Об'єкт скарги не знайдено");
        }
        if (! isset(self::REPORT_CATEGORIES[$category])) {
            Social::fail(400, 'Оберіть причину скарги');
        }
        $duplicate = DB::table('social_reports')->where('reporter_id', $request->user()->id)
            ->where('target_type', $type)->where('target_id', $id)->where('status', 'open')->exists();
        if ($duplicate) {
            Social::fail(409, 'Ви вже поскаржилися на це');
        }

        DB::table('social_reports')->insert([
            'reporter_id' => $request->user()->id,
            'target_type' => $type,
            'target_id' => $id,
            'category' => $category,
            'description' => Social::str($request->input('description'), 1000),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['ok' => true], 201);
    }
}
