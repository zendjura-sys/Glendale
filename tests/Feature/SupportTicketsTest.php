<?php

namespace Tests\Feature;

use App\Models\SupportTicket;
use App\Models\User;
use App\Services\Support\SupportDesk;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SupportTicketsTest extends TestCase
{
    use RefreshDatabase;

    public function test_ticket_lifecycle_with_private_screenshots_and_internal_notes(): void
    {
        Storage::fake('public');
        Storage::fake('local');
        $user = User::factory()->create();
        $admin = User::factory()->admin()->create();
        $stranger = User::factory()->create();

        $this->actingAs($user)->post('/support', [
            'category' => 'payment',
            'subject' => 'Не прийшов GameCon+',
            'body' => 'Оплатив учора о 21:00, а підписка не активна.',
            'files' => [UploadedFile::fake()->image('screen.png', 400, 300)],
        ])->assertRedirect();
        $ticket = SupportTicket::query()->firstOrFail();
        $this->assertSame('high', $ticket->priority);
        $this->assertSame(1, $admin->notifications()->count());

        $file = $ticket->messages()->firstOrFail();
        $this->assertCount(1, $file->attachments ?? []);
        Storage::disk('local')->assertExists($file->attachments[0]);
        $this->actingAs($user)->get("/support/{$ticket->id}/files/{$file->id}/0")->assertOk();
        $this->actingAs($stranger)->get("/support/{$ticket->id}/files/{$file->id}/0")->assertNotFound();
        $this->actingAs($stranger)->get("/support/{$ticket->id}")->assertNotFound();

        // Нотатка персоналу людині не видна; відповідь — видна й зі сповіщенням.
        $this->actingAs($admin)->post("/admin/support/{$ticket->id}/reply", ['body' => 'Перевірити платіж у monobank', 'internal' => 1])->assertSessionHasNoErrors();
        $this->actingAs($admin)->post("/admin/support/{$ticket->id}/reply", ['body' => 'Знайшли оплату, доступ відновили.'])->assertSessionHasNoErrors();
        $ticket->refresh();
        $this->assertSame('answered', $ticket->status);
        $this->assertSame($admin->id, $ticket->assignee_id);
        $this->assertNotNull($ticket->first_response_at);
        $this->assertSame(1, $user->notifications()->count());
        $this->actingAs($user)->get("/support/{$ticket->id}")->assertInertia(fn (Assert $page) => $page
            ->component('support/show')->has('messages', 2)->where('messages.1.body', 'Знайшли оплату, доступ відновили.'));

        // Людина дописала — знову чекає на нас; закрила й оцінила.
        $this->actingAs($user)->post("/support/{$ticket->id}/reply", ['body' => 'Дякую, працює!']);
        $this->assertSame('open', $ticket->fresh()?->status);
        $this->actingAs($user)->post("/support/{$ticket->id}/close");
        $this->actingAs($user)->post("/support/{$ticket->id}/rate", ['rating' => 5])->assertSessionHasNoErrors();
        $this->assertSame(5, $ticket->fresh()?->rating);
    }

    public function test_staff_queue_permissions_and_auto_close(): void
    {
        $user = User::factory()->create();
        $moderator = User::factory()->create(['role' => 'moderator']);
        $ticket = app(SupportDesk::class)->open($user, ['category' => 'bug', 'subject' => 'Не вантажиться стрічка', 'body' => 'Біла сторінка після входу.']);

        $this->actingAs($user)->get('/admin/support')->assertForbidden();
        $this->actingAs($moderator)->get('/admin/support')->assertInertia(fn (Assert $page) => $page
            ->component('admin/support/index')->where('tickets.data.0.id', $ticket->id)->where('stats.open', 1));
        $this->actingAs($moderator)->patch("/admin/support/{$ticket->id}", ['priority' => 'urgent', 'assignee_id' => $moderator->id])->assertSessionHasNoErrors();
        $this->actingAs($moderator)->patch("/admin/support/{$ticket->id}", ['assignee_id' => $user->id])->assertStatus(422);
        $this->assertSame('urgent', $ticket->fresh()?->priority);

        app(SupportDesk::class)->reply($ticket->fresh() ?? $ticket, $moderator, 'Спробуйте очистити кеш.');
        SupportTicket::query()->whereKey($ticket->id)->update(['last_reply_at' => now()->subDays(8)]);
        $this->assertSame(1, app(SupportDesk::class)->autoClose());
        $this->assertSame('closed', $ticket->fresh()?->status);
    }

    public function test_open_ticket_limit(): void
    {
        $user = User::factory()->create();
        for ($i = 0; $i < SupportDesk::MAX_OPEN; $i++) {
            app(SupportDesk::class)->open($user, ['category' => 'other', 'subject' => "Питання {$i}", 'body' => 'Текст звернення тут.']);
        }
        $this->actingAs($user)->post('/support', ['category' => 'other', 'subject' => 'Ще одне', 'body' => 'Текст звернення тут.'])->assertStatus(422);
    }
}
