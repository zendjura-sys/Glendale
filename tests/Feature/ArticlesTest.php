<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Статті: чернетка й публікація, зміст, безпечний HTML, права на редагування й видалення. */
class ArticlesTest extends TestCase
{
    use RefreshDatabase;

    private const BODY = "## Вступ\n\nДовгий текст про гру, щоб стаття пройшла перевірку довжини. <script>alert(1)</script>\n\n### Деталі\n\n- пункт\n- ще пункт\n\n## Висновок\n\n![x](https://evil.example/x.png)";

    public function test_draft_publish_and_read(): void
    {
        Storage::fake('public');
        [$author, $reader] = User::factory()->count(2)->create();

        $this->actingAs($author)->post('/articles', ['title' => 'Як пройти рейд', 'excerpt' => 'Гайд', 'body' => self::BODY, 'publish' => false])->assertRedirect('/articles/iak-proiti-reid');
        $article = Article::query()->sole();
        $this->assertFalse($article->is_published);
        $this->actingAs($reader)->get('/articles/'.$article->slug)->assertNotFound();
        $this->actingAs($author)->get('/articles')->assertInertia(fn ($page) => $page->has('drafts', 1)->has('articles.data', 0));

        $this->actingAs($author)->post('/articles/'.$article->slug, ['title' => 'Як пройти рейд', 'body' => self::BODY, 'publish' => true, 'cover' => UploadedFile::fake()->image('c.jpg', 1200, 600)])->assertRedirect();
        $article->refresh();
        $this->assertTrue($article->is_published);
        $this->assertNotNull($article->published_at);
        $this->assertNotNull($article->cover_path);

        $this->actingAs($reader)->get('/articles/'.$article->slug)->assertInertia(fn ($page) => $page
            ->component('articles/show')
            ->where('article.toc.0.text', 'Вступ')->where('article.toc.1.level', 3)->has('article.toc', 3)
            ->where('article.html', fn (string $html) => ! str_contains($html, '<script') && ! str_contains($html, 'evil.example') && str_contains($html, 'id="vstup"'))
            ->where('can_edit', false));
        $this->assertSame(1, $article->fresh()->views_count);
        $this->actingAs($reader)->get('/articles')->assertInertia(fn ($page) => $page->has('articles.data', 1));
    }

    public function test_only_author_edits_and_staff_can_delete(): void
    {
        [$author, $other] = User::factory()->count(2)->create();
        $admin = User::factory()->admin()->create();
        $this->actingAs($author)->post('/articles', ['title' => 'Огляд', 'body' => self::BODY, 'publish' => true]);
        $article = Article::query()->sole();

        $this->actingAs($other)->get('/articles/'.$article->slug.'/edit')->assertForbidden();
        $this->actingAs($other)->post('/articles/'.$article->slug, ['title' => 'Злам', 'body' => self::BODY, 'publish' => true])->assertForbidden();
        $this->actingAs($other)->delete('/articles/'.$article->slug)->assertForbidden();
        $this->actingAs($admin)->delete('/articles/'.$article->slug)->assertRedirect('/articles');
        $this->assertDatabaseCount('articles', 0);
    }

    public function test_short_body_is_rejected_and_image_upload_returns_url(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();
        $this->actingAs($user)->post('/articles', ['title' => 'Коротко', 'body' => 'мало', 'publish' => true])->assertSessionHasErrors('body');
        $this->actingAs($user)->postJson('/articles/images', ['image' => UploadedFile::fake()->image('a.png', 800, 600)])
            ->assertOk()->assertJsonPath('url', fn (string $url) => str_contains($url, '/storage/articles/'));
    }
}
