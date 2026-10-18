<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Messenger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ChatFoldersScheduleTest extends TestCase
{
    use RefreshDatabase;

    public function test_pins_folders_schedule_and_disappearing_messages(): void
    {
        $this->withoutVite();
        $viewer = User::factory()->create(['username' => 'viewer']);
        $friend = User::factory()->create(['username' => 'friend']);
        $other = User::factory()->create(['username' => 'other']);
        $friendships = app(FriendshipService::class);
        foreach ([$friend, $other] as $person) {
            $friendships->request($viewer, $person);
            $friendships->accept($person, $viewer);
        }
        $messenger = app(Messenger::class);
        $older = $messenger->direct($viewer, $friend);
        $newer = $messenger->direct($viewer, $other);
        $messenger->send($older, $viewer, 'Старший чат');
        $messenger->send($newer, $viewer, 'Новіший чат');

        $this->actingAs($viewer)->post(route('messages.pin', $older))->assertRedirect();
        $this->actingAs($viewer)->put(route('messages.folder', $older), ['folder' => 'Рейд'])->assertRedirect();

        $this->actingAs($viewer)->get(route('messages.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('conversations.0.id', $older->id)
                ->where('conversations.0.pinned', true)
                ->where('conversations.0.folder', 'Рейд')
                ->where('conversations.1.pinned', false)
                ->where('conversations.1.folder', null));

        $this->actingAs($friend)->get(route('messages.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('conversations.0.pinned', false)
                ->where('conversations.0.folder', null));

        $this->actingAs($viewer)->post(route('messages.pin', $older))->assertRedirect();
        $older->participants()->where('user_id', $viewer->id)->firstOrFail()->refresh();
        $this->assertNull($older->participants()->where('user_id', $viewer->id)->firstOrFail()->pinned_at);

        $live = $messenger->send($older, $viewer, 'Живе');
        $this->actingAs($viewer)->patchJson(route('messages.messages.update', [$older, $live]), [
            'body' => 'Змінено',
        ])->assertOk()->assertJsonPath('message.body', 'Змінено');

        $when = now()->addDay()->format('Y-m-d H:i');
        $this->actingAs($viewer)->postJson(route('messages.store', $older), [
            'body' => 'Побачимось завтра',
            'publish_at' => $when,
        ])->assertCreated()->assertJsonPath('message.body', 'Побачимось завтра');

        $this->actingAs($friend)->get(route('messages.show', $older))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('history.messages', fn ($rows) => collect($rows)->contains('body', 'Побачимось завтра') === false));

        $this->actingAs($viewer)->get(route('messages.show', $older))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('history.messages', fn ($rows) => collect($rows)->contains(
                fn ($row) => $row['body'] === 'Побачимось завтра' && $row['publish_at'] !== null,
            )));

        Carbon::setTestNow(now()->addDays(2));
        $this->artisan('messages:tick')->assertSuccessful();
        Carbon::setTestNow();

        $this->actingAs($friend)->get(route('messages.show', $older))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('history.messages', fn ($rows) => collect($rows)->contains('body', 'Побачимось завтра')));
        $this->assertNull(Message::query()->where('body', 'Побачимось завтра')->firstOrFail()->publish_at);

        $this->actingAs($viewer)->postJson(route('messages.store', $older), [
            'body' => 'Секрет на добу',
            'disappear' => true,
        ])->assertCreated();
        $secret = Message::query()->where('body', 'Секрет на добу')->firstOrFail();
        $this->assertNotNull($secret->expires_at);

        Carbon::setTestNow(now()->addDays(2));
        $this->artisan('messages:tick')->assertSuccessful();
        Carbon::setTestNow();

        $this->assertTrue($secret->fresh()->trashed());
        $this->actingAs($friend)->get(route('messages.show', $older))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('history.messages', fn ($rows) => collect($rows)->contains('body', 'Секрет на добу') === false));
    }
}
