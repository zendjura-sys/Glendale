<?php

namespace App\Http\Controllers;

use App\Models\Clan;
use App\Models\GtaServer;
use App\Models\Movie;
use App\Support\PageSeo;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as BaseResponse;

/**
 * Сторінки тайтлу кіно, сервера й клану за одним адресом для всіх: учасник бачить звичайну сторінку,
 * гість і пошуковик — легку картку з назвою, описом, фактами й розміткою schema.org (і кнопку «Увійти»).
 */
class PublicPageController extends Controller
{
    public function movie(Request $request, Movie $movie): BaseResponse|Response|JsonResponse
    {
        if ($request->user()) {
            return $this->member($request, fn () => app()->call([app(CinemaController::class), 'show'], ['movie' => $movie]));
        }
        abort_unless($movie->is_published, 404);
        $card = $movie->toCard();
        $facts = array_values(array_filter([
            ['label' => 'Тип', 'value' => $card['type_label']],
            $movie->year ? ['label' => 'Рік', 'value' => (string) $movie->year] : null,
            $card['genres'] ? ['label' => 'Жанри', 'value' => implode(', ', $card['genres'])] : null,
            $card['rating'] ? ['label' => 'Рейтинг', 'value' => number_format((float) $card['rating'], 1)] : null,
            $movie->age_rating ? ['label' => 'Вік', 'value' => (string) $movie->age_rating] : null,
            $movie->episodes_count && $movie->type !== 'movie' ? ['label' => 'Серій', 'value' => (string) $movie->episodes_count] : null,
        ]));

        return $this->guest($request, [
            'kind' => 'movie',
            'title' => $movie->title,
            'subtitle' => $movie->title_original,
            'image' => $card['poster'],
            'cover' => $card['backdrop'],
            'description' => $movie->description,
            'facts' => $facts,
            'cta' => 'Увійдіть, щоб дивитися разом із друзями, ставити оцінки й складати списки.',
        ], PageSeo::movie($movie));
    }

    public function server(Request $request, GtaServer $server): BaseResponse|Response|JsonResponse
    {
        if ($request->user()) {
            return $this->member($request, fn () => app()->call([app(ServerController::class), 'show'], ['server' => $server]));
        }
        abort_unless($server->status === GtaServer::STATUS_PUBLISHED, 404);
        $card = $server->toCard();
        $facts = array_values(array_filter([
            ['label' => 'Платформа', 'value' => $card['platform_label']],
            $card['multiplayer_label'] ? ['label' => 'Мультиплеєр', 'value' => (string) $card['multiplayer_label']] : null,
            $server->players_online !== null ? ['label' => 'Онлайн', 'value' => $server->players_online.($server->players_max ? ' / '.$server->players_max : '')] : null,
            $server->discord_members ? ['label' => 'Discord', 'value' => (string) $server->discord_members] : null,
        ]));

        return $this->guest($request, [
            'kind' => 'server',
            'title' => $server->name,
            'subtitle' => $server->tagline,
            'image' => $card['icon'],
            'cover' => null,
            'description' => $server->description,
            'facts' => $facts,
            'cta' => 'Увійдіть, щоб знайти сім’ю на сервері, голосувати й залишати відгуки.',
        ], PageSeo::server($server));
    }

    public function clan(Request $request, Clan $clan): BaseResponse|Response|JsonResponse
    {
        if ($request->user()) {
            return $this->member($request, fn () => app()->call([app(ClanController::class), 'show'], ['clan' => $clan]));
        }
        $clan->loadMissing('game');
        $card = $clan->toCard();
        $facts = array_values(array_filter([
            ['label' => 'Тип', 'value' => $card['type_label']],
            $clan->tag ? ['label' => 'Тег', 'value' => '['.$clan->tag.']'] : null,
            ['label' => 'Учасників', 'value' => (string) $clan->members_count],
            $clan->game ? ['label' => 'Гра', 'value' => $clan->game->name] : null,
            ['label' => 'Набір', 'value' => $card['is_recruiting'] ? 'Відкритий' : 'Закритий'],
        ]));

        return $this->guest($request, [
            'kind' => 'clan',
            'title' => $clan->name,
            'subtitle' => $clan->tag ? '['.$clan->tag.']' : null,
            'image' => $card['logo_url'],
            'cover' => null,
            'description' => $clan->description,
            'facts' => $facts,
            'cta' => 'Увійдіть, щоб вступити в клан, бачити події й матчі.',
        ], PageSeo::clan($clan));
    }

    /** Учасник: ті самі вимоги, що й для решти сайту (підтверджена пошта, якщо ввімкнено). */
    private function member(Request $request, callable $show): BaseResponse|Response|JsonResponse
    {
        if (app(SiteSettings::class)->get('email_verification') && ! $request->user()?->hasVerifiedEmail()) {
            return redirect()->route('verification.notice');
        }

        return $show();
    }

    /**
     * @param  array<string, mixed>  $entity
     * @param  array<string, mixed>  $seo
     */
    private function guest(Request $request, array $entity, array $seo): Response|RedirectResponse
    {
        // Після входу — назад на цю сторінку.
        $request->session()->put('url.intended', $request->url());

        return Inertia::render('public/entity', ['entity' => $entity])->withViewData($seo);
    }
}
