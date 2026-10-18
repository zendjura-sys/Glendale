<?php

namespace Tests\Feature;

use App\Models\Comment;
use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\Post;
use App\Models\User;
use App\Notifications\CommunityActivity;
use App\Services\CommunityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CommunityExtrasTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{Community, User, User}
     */
    private function setUpCommunity(array $data = []): array
    {
        [$owner, $member] = User::factory()->count(2)->create();
        $community = app(CommunityService::class)->create($owner, [
            'name' => 'Рейдери',
            'type' => Community::TYPE_GROUP,
            'privacy' => Community::PRIVACY_OPEN,
            'wall' => Community::WALL_OPEN,
            'category' => 'games',
        ]);
        $community->update($data);
        app(CommunityService::class)->join($community, $member);

        return [$community->fresh(), $owner, $member];
    }

    private function rules(array $overrides = []): array
    {
        return [
            'rules' => "# Загальне\nПоважайте одне одного.",
            'handbook' => "# Старт\nЯк вступити в рейд.",
            'welcome' => 'Вітаємо! Прочитайте правила.',
            'banned_words' => "спойлер\nчит",
            'post_tags' => "Новини\nГайди\nНовини",
            'slow_mode' => 0,
            'premoderation' => false,
            ...$overrides,
        ];
    }

    public function test_admin_saves_rules_and_members_see_rules_and_handbook_pages(): void
    {
        [$community, $owner, $member] = $this->setUpCommunity();

        $this->actingAs($member)->patch(route('communities.rules.update', $community), $this->rules())->assertForbidden();
        $this->actingAs($owner)->patch(route('communities.rules.update', $community), $this->rules())->assertRedirect();

        $community->refresh();
        $this->assertSame(['спойлер', 'чит'], $community->banned_words);
        $this->assertSame(['Новини', 'Гайди'], $community->post_tags, 'Дублікати міток прибрано');

        $this->actingAs($member)->get(route('communities.rules', $community))
            ->assertInertia(fn (Assert $page) => $page->component('communities/page')->where('page', 'rules')->where('other', true));
        $this->actingAs($member)->get(route('communities.handbook', $community))
            ->assertInertia(fn (Assert $page) => $page->where('page', 'handbook')->where('text', "# Старт\nЯк вступити в рейд."));

        $community->update(['handbook' => null]);
        $this->actingAs($member)->get(route('communities.handbook', $community))->assertNotFound();
    }

    public function test_new_member_gets_the_welcome_message(): void
    {
        Notification::fake();
        [$community] = $this->setUpCommunity(['welcome' => 'Ласкаво просимо до рейдерів!']);
        $newcomer = User::factory()->create();

        $this->actingAs($newcomer)->post(route('communities.join', $community))->assertRedirect();

        Notification::assertSentTo($newcomer, CommunityActivity::class, fn (CommunityActivity $n) => $n->kind === CommunityActivity::WELCOME
            && str_contains($n->toArray($newcomer)['text'], 'Ласкаво просимо до рейдерів!'));
    }

    public function test_banned_words_block_member_posts_and_comments_but_not_managers(): void
    {
        [$community, $owner, $member] = $this->setUpCommunity(['banned_words' => ['чит']]);

        $this->actingAs($member)->post(route('posts.store'), ['body' => 'Продаю чит на гру', 'visibility' => 'public', 'community' => $community->slug])
            ->assertSessionHasErrors('body');
        $this->actingAs($member)->post(route('posts.store'), ['body' => 'Читаємо гайд', 'visibility' => 'public', 'community' => $community->slug])
            ->assertSessionHasNoErrors();
        $this->actingAs($owner)->post(route('posts.store'), ['body' => 'Про чит — бан', 'visibility' => 'public', 'community' => $community->slug])
            ->assertSessionHasNoErrors();

        $post = Post::query()->where('body', 'Читаємо гайд')->sole();
        $this->actingAs($member)->postJson(route('comments.store', $post), ['body' => 'є чит?'])->assertUnprocessable();
        $this->assertSame(0, Comment::query()->count());
    }

    public function test_slow_mode_limits_member_posts(): void
    {
        [$community, $owner, $member] = $this->setUpCommunity(['slow_mode' => 300]);
        $post = fn (User $user, string $body) => $this->actingAs($user)->post(route('posts.store'), ['body' => $body, 'visibility' => 'public', 'community' => $community->slug]);

        $post($member, 'Перший')->assertSessionHasNoErrors();
        $post($member, 'Другий')->assertSessionHasErrors('body');
        $post($owner, 'Від керівника')->assertSessionHasNoErrors();
        $post($owner, 'І ще')->assertSessionHasNoErrors();

        $this->travel(6)->minutes();
        $post($member, 'Третій')->assertSessionHasNoErrors();
    }

    public function test_premoderation_queues_member_posts_until_a_manager_approves(): void
    {
        Notification::fake();
        [$community, $owner, $member] = $this->setUpCommunity(['premoderation' => true]);
        $outsider = User::factory()->create();

        $this->actingAs($member)->post(route('posts.store'), ['body' => 'На перевірку', 'visibility' => 'public', 'community' => $community->slug])
            ->assertSessionHasNoErrors();
        $post = Post::query()->sole();
        $this->assertTrue($post->is_pending);
        Notification::assertSentTo($owner, CommunityActivity::class, fn (CommunityActivity $n) => $n->kind === CommunityActivity::POST_PENDING);

        $this->actingAs($outsider)->get(route('posts.show', $post))->assertNotFound();
        $this->actingAs($outsider)->get(route('communities.show', $community))
            ->assertInertia(fn (Assert $page) => $page->where('queue', [])->where('stats.posts', 0));
        $this->actingAs($member)->get(route('communities.show', $community))
            ->assertInertia(fn (Assert $page) => $page->where('my_pending', 1)->where('queue', []));
        $this->actingAs($owner)->get(route('communities.show', $community))
            ->assertInertia(fn (Assert $page) => $page->has('queue', 1)->where('queue.0.pending', true));

        $this->actingAs($member)->post(route('communities.queue.approve', [$community, $post]))->assertForbidden();
        $this->actingAs($owner)->post(route('communities.queue.approve', [$community, $post]))->assertRedirect();
        $this->assertFalse($post->fresh()->is_pending);
        Notification::assertSentTo($member, CommunityActivity::class, fn (CommunityActivity $n) => $n->kind === CommunityActivity::POST_APPROVED);
        $this->actingAs($outsider)->get(route('posts.show', $post))->assertOk();

        $this->actingAs($member)->post(route('posts.store'), ['body' => 'Другий', 'visibility' => 'public', 'community' => $community->slug]);
        $second = Post::query()->where('body', 'Другий')->sole();
        $this->actingAs($owner)->delete(route('communities.queue.reject', [$community, $second]))->assertRedirect();
        $this->assertSoftDeleted($second);
        Notification::assertSentTo($member, CommunityActivity::class, fn (CommunityActivity $n) => $n->kind === CommunityActivity::POST_REJECTED);

        $this->actingAs($owner)->post(route('posts.store'), ['body' => 'Новина', 'visibility' => 'public', 'community' => $community->slug]);
        $this->assertFalse(Post::query()->where('body', 'Новина')->sole()->is_pending, 'Керівники публікують одразу');
    }

    public function test_post_tags_are_limited_to_the_community_list_and_filter_the_wall(): void
    {
        [$community, , $member] = $this->setUpCommunity(['post_tags' => ['Гайди', 'Новини']]);
        $send = fn (array $data) => $this->actingAs($member)->post(route('posts.store'), ['visibility' => 'public', 'community' => $community->slug, ...$data]);

        $send(['body' => 'Не та мітка', 'tag' => 'Мемы'])->assertSessionHasErrors('tag');
        $send(['body' => 'Гайд по рейду', 'tag' => 'Гайди'])->assertSessionHasNoErrors();
        $send(['body' => 'Без мітки'])->assertSessionHasNoErrors();

        $this->actingAs($member)->get(route('communities.show', [$community, 'tag' => 'Гайди']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('tag', 'Гайди')
                ->where('tags', ['Гайди', 'Новини'])
                ->has('posts.data', 1)
                ->where('posts.data.0.tag.name', 'Гайди'));
    }

    public function test_role_title_with_color_shows_on_posts(): void
    {
        [$community, $owner, $member] = $this->setUpCommunity();

        $this->actingAs($member)->patch(route('communities.members.title', [$community, $member]), ['title' => 'Ветеран', 'color' => 'amber'])->assertForbidden();
        $this->actingAs($owner)->patch(route('communities.members.title', [$community, $member]), ['title' => 'Ветеран', 'color' => 'pink'])->assertSessionHasErrors('color');
        $this->actingAs($owner)->patch(route('communities.members.title', [$community, $member]), ['title' => 'Ветеран', 'color' => 'amber'])->assertRedirect();

        $this->actingAs($member)->post(route('posts.store'), ['body' => 'Привіт', 'visibility' => 'public', 'community' => $community->slug]);
        $this->actingAs($owner)->get(route('communities.show', $community))
            ->assertInertia(fn (Assert $page) => $page->where('posts.data.0.badge', ['title' => 'Ветеран', 'color' => 'amber']));
        $this->actingAs($owner)->get(route('communities.members', $community))
            ->assertInertia(fn (Assert $page) => $page->where('members.data.1.title', 'Ветеран'));

        $this->actingAs($owner)->patch(route('communities.members.title', [$community, $member]), ['title' => ''])->assertRedirect();
        $this->assertNull(CommunityMember::query()->where('user_id', $member->id)->value('title'));
    }

    public function test_admin_stats_count_newcomers_and_writers(): void
    {
        [$community, $owner, $member] = $this->setUpCommunity();
        User::factory()->count(2)->create()->each(fn (User $u) => app(CommunityService::class)->join($community, $u));
        $this->actingAs($member)->post(route('posts.store'), ['body' => 'Пишу', 'visibility' => 'public', 'community' => $community->slug]);

        $this->actingAs($member)->get(route('communities.edit', $community))->assertForbidden();
        $this->actingAs($owner)->get(route('communities.edit', $community))
            ->assertInertia(fn (Assert $page) => $page
                ->where('extras.premoderation', false)
                ->missing('stats')
                ->loadDeferredProps(fn (Assert $reload) => $reload
                    ->where('stats.joined', 4)
                    ->where('stats.authors', 1)
                    ->where('stats.posts', 1)
                    ->where('stats.active_share', 25)
                    ->has('stats.weeks', 8)));
    }
}
