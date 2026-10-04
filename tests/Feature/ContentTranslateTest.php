<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\Post;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Messenger;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ContentTranslateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        app(SiteSettings::class)->putSecret('deepl_key', '0123456789abcdef0123456789abcdef0123:fx');
        Http::preventStrayRequests();
        Http::fake([
            'api-free.deepl.com/v2/languages*' => Http::response([['language' => 'UK'], ['language' => 'EN-US']]),
            'api-free.deepl.com/v2/translate' => fn (Request $r) => Http::response(['translations' => [[
                'detected_source_language' => str_contains($r['text'][0], 'Привіт') ? 'UK' : 'EN',
                'text' => 'Переклад: '.$r['text'][0],
            ]]]),
        ]);
    }

    private function makePost(User $author, string $body, string $visibility = 'public'): Post
    {
        return Post::query()->create(['author_id' => $author->id, 'wall_type' => 'user', 'wall_id' => $author->id, 'body' => $body, 'visibility' => $visibility]);
    }

    public function test_post_is_translated_once_and_cached_and_private_posts_are_refused(): void
    {
        $author = User::factory()->create();
        $reader = User::factory()->create();
        $post = $this->makePost($author, 'Hello world');

        $this->actingAs($reader)->get('/feed')->assertInertia(fn ($page) => $page->where('site.translate', true));
        $this->actingAs($reader)->postJson('/translate', ['type' => 'post', 'id' => $post->id])
            ->assertOk()->assertJsonPath('translation', 'Переклад: Hello world')->assertJsonPath('same', false);
        $this->actingAs($reader)->postJson('/translate', ['type' => 'post', 'id' => $post->id])->assertOk();
        Http::assertSentCount(2); // мови DeepL + один переклад

        // Текст уже українською.
        $uk = $this->makePost($author, 'Привіт усім');
        $this->actingAs($reader)->postJson('/translate', ['type' => 'post', 'id' => $uk->id])->assertJsonPath('same', true);

        $hidden = $this->makePost($author, 'Only friends', 'friends');
        $this->actingAs($reader)->postJson('/translate', ['type' => 'post', 'id' => $hidden->id])->assertNotFound();

        app(SiteSettings::class)->put(['content_translation' => false]);
        $this->actingAs($reader)->postJson('/translate', ['type' => 'post', 'id' => $post->id])->assertNotFound();
    }

    public function test_only_chat_participants_translate_messages(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();
        $friendships = app(FriendshipService::class);
        $friendships->request($alice, $bob);
        $friendships->accept($bob, $alice);
        $chat = app(Messenger::class)->direct($alice, $bob);
        $this->actingAs($alice)->postJson(route('messages.store', $chat), ['body' => 'See you tonight'])->assertCreated();
        $message = Message::query()->latest('id')->sole();

        $this->actingAs($bob)->postJson('/translate', ['type' => 'message', 'id' => $message->id])->assertJsonPath('translation', 'Переклад: See you tonight');
        $this->actingAs(User::factory()->create())->postJson('/translate', ['type' => 'message', 'id' => $message->id])->assertNotFound();
    }
}
