<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class QuoteSortStickersTest extends TestCase
{
    use RefreshDatabase;

    public function test_quote_comment_order_and_stickers(): void
    {
        $author = User::factory()->create([
            'username' => 'olena',
            'first_name' => 'Олена',
            'last_name' => 'Коваль',
        ]);
        $viewer = User::factory()->create(['username' => 'taras']);

        $this->actingAs($author)->post(route('posts.store'), [
            'body' => 'Оригінал для цитати',
            'visibility' => 'public',
        ])->assertRedirect();
        $original = Post::query()->where('body', 'Оригінал для цитати')->sole();

        $this->actingAs($author)->post(route('posts.store'), [
            'body' => 'Чернетка',
            'visibility' => 'public',
            'draft' => 1,
        ])->assertRedirect();
        $draft = Post::query()->where('body', 'Чернетка')->sole();
        $this->actingAs($author)->post(route('posts.quote', $draft), ['body' => 'Не вийде'])->assertStatus(422);

        $this->actingAs($viewer)->post(route('posts.quote', $original), ['body' => ''])->assertSessionHasErrors('body');
        $this->actingAs($viewer)->post(route('posts.quote', $original), [
            'body' => 'Саме так і є',
        ])->assertRedirect();

        $quote = Post::query()->where('author_id', $viewer->id)->sole();
        $this->assertSame($original->id, $quote->quoted_post_id);
        $this->assertSame('Саме так і є', $quote->body);
        $this->assertTrue($author->fresh()->notifications->contains(
            fn ($note) => ($note->data['kind'] ?? null) === 'post_quote' && ($note->data['excerpt'] ?? null) === 'Саме так і є',
        ));

        $this->withoutVite()->actingAs($viewer)->get(route('profile.show', $viewer))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('posts.data.0.quoted.name', 'Олена Коваль')
                ->where('posts.data.0.quoted.body', 'Оригінал для цитати'));

        $this->actingAs($viewer)->post(route('comments.store', $original), ['body' => 'Перший'])->assertCreated();
        $this->actingAs($viewer)->post(route('comments.store', $original), ['body' => 'Другий'])->assertCreated();
        $this->actingAs($author)->post(route('comments.store', $original), ['body' => 'Третій'])->assertCreated();

        $old = $this->actingAs($viewer)->getJson(route('comments.index', ['post' => $original, 'sort' => 'old']))
            ->assertOk()
            ->json('comments');
        $this->assertSame(['Перший', 'Другий', 'Третій'], collect($old)->pluck('body')->all());

        $new = $this->actingAs($viewer)->getJson(route('comments.index', ['post' => $original, 'sort' => 'new']))->json('comments');
        $this->assertSame(['Третій', 'Другий', 'Перший'], collect($new)->pluck('body')->all());

        $firstId = collect($old)->first()['id'];
        $this->actingAs($author)->post(route('comments.like', $firstId))->assertOk();
        $reactions = $this->actingAs($viewer)->getJson(route('comments.index', ['post' => $original, 'sort' => 'reactions']))->json('comments');
        $this->assertSame('Перший', $reactions[0]['body']);

        $pinnedId = collect($old)->last()['id'];
        $this->actingAs($author)->post(route('comments.pin', $pinnedId))->assertOk();
        $pinnedFirst = $this->actingAs($viewer)->getJson(route('comments.index', ['post' => $original, 'sort' => 'reactions']))->json('comments');
        $this->assertSame(['Третій', 'Перший', 'Другий'], collect($pinnedFirst)->pluck('body')->all());

        $this->actingAs($viewer)->post(route('posts.store'), [
            'visibility' => 'public',
            'sticker' => 'gg',
        ])->assertRedirect();
        $stickerPost = Post::query()->where('author_id', $viewer->id)->where('sticker', 'gg')->sole();
        $this->assertNull($stickerPost->body);
        $this->withoutVite()->actingAs($viewer)->get(route('posts.show', $stickerPost))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('post.sticker', '🏆'));

        $this->actingAs($viewer)->post(route('posts.store'), [
            'visibility' => 'public',
            'sticker' => 'nope',
        ])->assertSessionHasErrors('sticker');

        $this->actingAs($viewer)->postJson(route('comments.store', $original), [
            'sticker' => 'fire',
        ])->assertCreated()->assertJsonPath('comment.sticker', '🔥');

        $this->actingAs($viewer)->postJson(route('comments.store', $original), [])
            ->assertStatus(422);
    }
}
