<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\User;
use App\Services\Analytics\PageAnalytics;
use App\Services\CommunityWall;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** №288: перегляди, унікальні відвідувачі й джерела сторінки спільноти. */
class PageAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_views_uniques_and_sources_are_counted_without_owners_and_bots(): void
    {
        $this->withoutVite();
        $owner = User::factory()->create();
        $community = Community::query()->create(['slug' => 'stats-club', 'name' => 'Stats Club', 'type' => 'group', 'privacy' => 'open', 'owner_id' => $owner->id]);
        CommunityMember::query()->create(['community_id' => $community->id, 'user_id' => $owner->id, 'role' => CommunityMember::ROLE_OWNER, 'status' => CommunityMember::STATUS_ACTIVE]);
        [$anna, $bohdan] = User::factory()->count(2)->create();
        $url = '/c/'.$community->slug;

        $this->actingAs($anna)->get($url, ['Referer' => 'https://www.google.com/'])->assertOk();
        $this->actingAs($anna)->get($url, ['Referer' => config('app.url').'/feed'])->assertOk();
        $this->actingAs($bohdan)->get($url, ['Referer' => config('app.url').'/communities'])->assertOk();
        // Керівник і бот не рахуються.
        $this->actingAs($owner)->get($url)->assertOk();
        $this->actingAs($bohdan)->get($url, ['User-Agent' => 'Googlebot/2.1'])->assertOk();

        $report = app(PageAnalytics::class)->report('community', $community->id);
        $this->assertSame(3, $report['views']);
        $this->assertSame(2, $report['uniques']);
        $this->assertSame(['inside' => 1, 'search' => 1, 'outside' => 0], $report['sources']);
        $this->assertCount(30, $report['days']);
        $this->assertSame(3, app(CommunityWall::class)->stats($community)['page']['views']);
    }

    public function test_visitor_hashes_are_pruned(): void
    {
        DB::table('page_visitors')->insert(['subject_type' => 'community', 'subject_id' => 1, 'day' => now()->subDays(5)->toDateString(), 'visitor' => 'u1']);
        app(PageAnalytics::class)->prune();
        $this->assertSame(0, DB::table('page_visitors')->count());
    }
}
