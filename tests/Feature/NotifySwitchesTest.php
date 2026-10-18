<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Notifications\EventReminder;
use App\Notifications\FriendPlaying;
use App\Notifications\Mention;
use App\Notifications\PostInteraction;
use App\Services\Push\PushNotifier;
use App\Support\NotifyPrefs;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Tests\TestCase;

class NotifySwitchesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'mail.default' => 'array',
            'mail.from.address' => 'no-reply@gamecon.online',
            'mail.from.name' => 'GameCon',
            'mail.updates.address' => null,
            'mail.social.address' => null,
        ]);
    }

    public function test_type_switches_channels_and_reaction_batch(): void
    {
        $author = User::factory()->create();
        $post = Post::factory()->create([
            'author_id' => $author->id,
            'wall_type' => 'user',
            'wall_id' => $author->id,
        ]);

        $author->mergePref(['notify' => [
            'likes' => false,
            'comments' => true,
            'mentions' => false,
            'events' => false,
            'playing' => false,
            'site' => true,
            'email' => true,
            'push' => true,
        ]]);

        $this->actingAs(User::factory()->create())->postJson(route('posts.like', $post))->assertOk();
        $this->assertSame(0, $author->notifications()->count());
        $this->assertSame([], $this->messages());

        $author->notify(new PostInteraction(PostInteraction::COMMENT, User::factory()->create(), $post, 'гарно'));
        $this->assertSame(1, $author->notifications()->count());
        $this->assertCount(1, $this->messages());

        $author->notify(new Mention(User::factory()->create(), '/posts/'.$post->id, 'гей'));
        $author->notify(new FriendPlaying(User::factory()->create()));
        $author->notify(new EventReminder('рейд', '/events', null));
        $this->assertSame(1, $author->fresh()->notifications()->count());

        $author->mergePref(['notify' => array_merge(NotifyPrefs::for($author), [
            'likes' => true,
            'site' => false,
            'email' => true,
            'push' => false,
        ])]);
        $pushes = $this->pushProbe();
        $this->actingAs(User::factory()->create())->postJson(route('posts.like', $post))->assertOk();
        $hidden = $author->notifications()->where('data->kind', 'post_like')->first();
        $this->assertInstanceOf(DatabaseNotification::class, $hidden);
        $this->assertTrue($hidden->data['hidden']);
        $this->assertSame(1, NotifyPrefs::unreadCount($author));
        $this->assertSame(0, $pushes->sent);
        $this->assertCount(2, $this->messages());

        $author->mergePref(['notify' => array_merge(NotifyPrefs::for($author), [
            'likes' => true,
            'site' => true,
            'email' => true,
            'push' => true,
        ])]);
        $author->notifications()->delete();
        $mails = count($this->messages());
        $pushes = $this->pushProbe();
        foreach (range(1, 5) as $_) {
            $this->actingAs(User::factory()->create())->postJson(route('posts.like', $post))->assertOk();
        }
        $batch = $author->notifications()->first();
        $this->assertSame(1, $author->notifications()->count());
        $this->assertSame(5, $batch->data['count']);
        $this->assertSame('5 людей поставили реакцію', $batch->data['text']);
        $this->assertFalse($batch->data['hidden'] ?? false);
        $this->assertSame(1, NotifyPrefs::unreadCount($author));
        $this->assertSame(1, $pushes->sent);
        $this->assertCount($mails + 1, $this->messages());

        $this->actingAs($author)->put('/settings/appearance', [
            'palette' => 'ocean',
            'quiet_enabled' => false,
            'quiet_from' => '23:00',
            'quiet_to' => '08:00',
            'languages' => [],
            'looking_for_group' => false,
            'notify' => [
                'likes' => false,
                'comments' => true,
                'mentions' => true,
                'events' => true,
                'playing' => true,
                'site' => true,
                'email' => false,
                'push' => true,
            ],
        ])->assertRedirect();
        $saved = $author->fresh()->pref('notify');
        $this->assertFalse($saved['likes']);
        $this->assertFalse($saved['email']);
        $this->assertTrue($saved['push']);
        $this->assertTrue($saved['comments']);
    }

    /**
     * @return list<object>
     */
    private function messages(): array
    {
        return app('mail.manager')->mailer('array')->getSymfonyTransport()->messages()->toArray();
    }

    private function pushProbe(): object
    {
        $probe = new class extends PushNotifier
        {
            public int $sent = 0;

            public function __construct() {}

            public function notification(object $notifiable, DatabaseNotification $notification): void
            {
                $this->sent++;
            }
        };
        $this->app->instance(PushNotifier::class, $probe);

        return $probe;
    }
}
