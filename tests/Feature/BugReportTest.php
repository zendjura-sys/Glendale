<?php

namespace Tests\Feature;

use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** №286: баг-репорт струсом — звернення «Помилка» зі знімком екрана й даними пристрою. */
class BugReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_bug_report_keeps_device_and_screenshot(): void
    {
        Storage::fake();
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/support', [
            'category' => 'bug',
            'subject' => 'Помилка в застосунку: /feed',
            'body' => 'Натиснув «Опублікувати» — нічого не сталося.',
            'url' => '/feed',
            'device' => "GameCon 1.2611.0.9 · android 14\n· 412×915 · /feed",
            'files' => [UploadedFile::fake()->image('screenshot.png', 400, 800)],
        ])->assertCreated();

        $ticket = SupportTicket::query()->sole();
        $this->assertSame('bug', $ticket->category);
        $this->assertSame('/feed', $ticket->url);
        $message = SupportMessage::query()->sole();
        $this->assertStringContainsString('— Пристрій: GameCon 1.2611.0.9 · android 14 · 412×915 · /feed', $message->body);
        $this->assertCount(1, $message->attachments ?? []);
    }
}
