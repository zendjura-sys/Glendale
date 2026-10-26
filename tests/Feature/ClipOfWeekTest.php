<?php

namespace Tests\Feature;

use App\Models\Moment;
use App\Models\MomentLike;
use App\Models\User;
use App\Notifications\ClipOfWeekNotice;
use App\Services\Achievements;
use App\Support\Plugins\Plugins;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** «Кліп тижня»: лідер за вподобаннями тижня, переможець щопонеділка, архів, бейдж. */
class ClipOfWeekTest extends TestCase
{
    use RefreshDatabase;

    private function moment(User $author, string $title): Moment
    {
        return Moment::query()->create([
            'user_id' => $author->id, 'provider' => 'youtube', 'external_id' => md5($title), 'url' => 'https://youtu.be/'.md5($title),
            'embed_url' => null, 'title' => $title, 'thumbnail' => null,
        ]);
    }

    private function likes(Moment $moment, int $count, CarbonImmutable $at): void
    {
        for ($i = 0; $i < $count; $i++) {
            $fan = User::factory()->create();
            MomentLike::query()->forceCreate(['moment_id' => $moment->id, 'user_id' => $fan->id, 'created_at' => $at]);
        }
    }

    public function test_monday_crowns_last_week_winner_once_and_page_shows_it(): void
    {
        Notification::fake();
        $this->travelTo(CarbonImmutable::parse('2026-10-21 12:00', 'Europe/Kyiv'));
        $author = User::factory()->create();
        $rival = User::factory()->create();
        $ace = $this->moment($author, 'Ейс на Міражі');
        $other = $this->moment($rival, 'Смішний фейл');
        $this->likes($ace, 3, CarbonImmutable::now());
        $this->likes($other, 2, CarbonImmutable::now());
        // Вподобання до початку тижня не рахуються.
        $this->likes($other, 5, CarbonImmutable::parse('2026-10-18 12:00', 'Europe/Kyiv'));

        $this->actingAs($author)->get('/moments')->assertInertia(fn (Assert $page) => $page
            ->where('clip_of_week.leader.moment.id', $ace->id)->where('clip_of_week.leader.likes', 3)->where('clip_of_week.winner', null));

        $this->travelTo(CarbonImmutable::parse('2026-10-26 10:10', 'Europe/Kyiv'));
        $this->artisan('moments:clip-of-week')->assertSuccessful();
        $this->artisan('moments:clip-of-week')->assertSuccessful();
        $this->assertDatabaseCount('moment_weekly', 1);
        $this->assertDatabaseHas('moment_weekly', ['week' => '2026-10-19', 'moment_id' => $ace->id, 'likes' => 3]);
        Notification::assertSentToTimes($author, ClipOfWeekNotice::class, 1);

        $this->actingAs($rival)->get('/moments')->assertInertia(fn (Assert $page) => $page
            ->where('clip_of_week.winner.moment.id', $ace->id)->where('clip_of_week.winner.week', '2026-10-19'));

        Cache::flush();
        $badge = collect(app(Achievements::class)->for($author)['badges'])->firstWhere('key', 'clip_of_week');
        $this->assertTrue($badge['earned']);
    }

    public function test_self_likes_do_not_count_and_plugin_switch(): void
    {
        $author = User::factory()->create();
        $moment = $this->moment($author, 'Сам собі');
        MomentLike::query()->forceCreate(['moment_id' => $moment->id, 'user_id' => $author->id, 'created_at' => now()]);

        $this->actingAs($author)->get('/moments')->assertInertia(fn (Assert $page) => $page->where('clip_of_week', null));

        app(Plugins::class)->set('clip_of_week', false);
        $this->likes($moment, 2, CarbonImmutable::now());
        $this->actingAs($author)->get('/moments')->assertInertia(fn (Assert $page) => $page->where('clip_of_week', null));
        $this->artisan('moments:clip-of-week')->assertSuccessful();
        $this->assertDatabaseCount('moment_weekly', 0);
    }
}
