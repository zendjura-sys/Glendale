<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Services\Search\SiteSearch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/** №233: глобальний пошук — усі розділи разом, записи з урахуванням видимості, розкладка. */
class GlobalSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_layout_is_swapped_both_ways(): void
    {
        $this->assertSame('привіт', SiteSearch::swapLayout('ghbdsn'));
        $this->assertSame('gamecon', SiteSearch::swapLayout('пфьусщт'));
        $this->assertNull(SiteSearch::swapLayout('мікс mix'));
    }

    public function test_posts_are_found_only_when_visible(): void
    {
        $author = User::factory()->create();
        $viewer = User::factory()->create(['username' => 'viewer']);
        Post::query()->create(['author_id' => $author->id, 'wall_type' => 'user', 'wall_id' => $author->id, 'body' => 'Шукаю тіммейтів у Valorant на вечір', 'visibility' => Post::VISIBILITY_PUBLIC]);
        Post::query()->create(['author_id' => $author->id, 'wall_type' => 'user', 'wall_id' => $author->id, 'body' => 'Таємний Valorant лише для друзів', 'visibility' => Post::VISIBILITY_FRIENDS]);

        $this->actingAs($viewer)->getJson('/search?q=Valorant&type=post')->assertOk()
            ->assertJsonCount(1, 'hits')
            ->assertJsonPath('hits.0.kind', 'post')
            ->assertJsonPath('hits.0.href', '/posts/'.Post::query()->where('visibility', 'public')->value('id'));
    }

    public function test_search_page_lists_all_sections_at_once(): void
    {
        $viewer = User::factory()->create(['username' => 'viewer', 'first_name' => 'Віра']);
        User::factory()->create(['username' => 'valorant_fan', 'first_name' => 'Олег']);
        $author = User::factory()->create();
        Post::query()->create(['author_id' => $author->id, 'wall_type' => 'user', 'wall_id' => $author->id, 'body' => 'Хто в valorant сьогодні?', 'visibility' => Post::VISIBILITY_PUBLIC]);

        $this->actingAs($viewer)->get('/search?q=valorant')->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('search/index')
                ->where('kinds', ['user', 'post'])
                ->where('type', null)
                ->has('hits', 2));
    }
}
