<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\StickerPack;
use App\Models\User;
use App\Services\Messenger;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RichMessagesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('local');
    }

    private function chat(): array
    {
        [$anna, $boris] = User::factory()->count(2)->create();

        return [$anna, $boris, app(Messenger::class)->direct($anna, $boris)];
    }

    private function send(User $user, Conversation $conversation, array $data)
    {
        return $this->actingAs($user)->post(route('messages.store', $conversation), $data, ['Accept' => 'application/json']);
    }

    private function pack(bool $active = true): StickerPack
    {
        $pack = StickerPack::query()->create(['slug' => 'test', 'name' => 'Тест', 'is_active' => $active]);
        $pack->stickers()->create(['path' => 'stickers/test/a.png', 'emoji' => '😎']);

        return $pack;
    }

    public function test_sticker_message_is_sent_and_previewed(): void
    {
        [$anna, , $conversation] = $this->chat();
        $sticker = $this->pack()->stickers()->first();

        $this->send($anna, $conversation, ['sticker_id' => $sticker->id])
            ->assertCreated()
            ->assertJsonPath('message.type', Message::TYPE_STICKER)
            ->assertJsonPath('message.sticker.id', $sticker->id)
            ->assertJsonPath('message.preview', '😎 Стікер');

        $this->actingAs($anna)->getJson(route('messages.stickers'))
            ->assertOk()
            ->assertJsonPath('packs.0.stickers.0.id', $sticker->id);
    }

    public function test_inactive_sticker_pack_cannot_be_used(): void
    {
        [$anna, , $conversation] = $this->chat();
        $sticker = $this->pack(active: false)->stickers()->first();

        $this->send($anna, $conversation, ['sticker_id' => $sticker->id])->assertUnprocessable()->assertJsonValidationErrors('sticker_id');
        $this->actingAs($anna)->getJson(route('messages.stickers'))->assertJsonCount(0, 'packs');
    }

    public function test_voice_message_stores_duration_and_waveform(): void
    {
        [$anna, , $conversation] = $this->chat();

        $response = $this->send($anna, $conversation, [
            'voice' => UploadedFile::fake()->create('voice.webm', 40, 'audio/webm'),
            'voice_duration' => 7,
            'voice_waveform' => json_encode([10, 50, 120, -5, 'x', 80]),
        ])->assertCreated()
            ->assertJsonPath('message.type', Message::TYPE_VOICE)
            ->assertJsonPath('message.attachments.0.type', 'voice')
            ->assertJsonPath('message.attachments.0.duration', 7)
            ->assertJsonPath('message.attachments.0.waveform', [10, 50, 100, 0, 80])
            ->assertJsonPath('message.preview', 'Голосове повідомлення');

        Storage::disk('public')->assertExists(MessageAttachment::query()->sole()->path);
        $this->assertStringEndsWith('.webm', $response->json('message.attachments.0.url'));
    }

    public function test_voice_rejects_non_audio(): void
    {
        [$anna, , $conversation] = $this->chat();

        $this->send($anna, $conversation, [
            'voice' => UploadedFile::fake()->create('evil.php', 4, 'application/x-php'),
            'voice_duration' => 3,
        ])->assertUnprocessable()->assertJsonValidationErrors('voice');
    }

    public function test_files_are_private_and_downloadable_by_participants_only(): void
    {
        [$anna, $boris, $conversation] = $this->chat();
        $stranger = User::factory()->create();

        $this->send($anna, $conversation, [
            'body' => 'Регламент',
            'files' => [UploadedFile::fake()->create('Регламент турніру.pdf', 120, 'application/pdf')],
        ])->assertCreated()
            ->assertJsonPath('message.attachments.0.type', 'file')
            ->assertJsonPath('message.attachments.0.name', 'Регламент турніру.pdf');

        $attachment = MessageAttachment::query()->sole();
        $this->assertSame(MessageAttachment::PRIVATE_DISK, $attachment->disk);
        Storage::disk('local')->assertExists($attachment->path);

        $download = $this->actingAs($boris)->get(route('messages.attachments.download', $attachment))->assertOk();
        $this->assertStringContainsString(rawurlencode('Регламент турніру.pdf'), $download->headers->get('Content-Disposition'));
        $this->assertStringStartsWith('attachment', $download->headers->get('Content-Disposition'));
        $this->actingAs($stranger)->get(route('messages.attachments.download', $attachment))->assertNotFound();
    }

    public function test_file_only_message_preview_uses_file_name(): void
    {
        [$anna, , $conversation] = $this->chat();

        $this->send($anna, $conversation, ['files' => [UploadedFile::fake()->create('map.zip', 10)]])
            ->assertCreated()
            ->assertJsonPath('message.preview', 'Файл: map.zip');
    }

    public function test_file_size_limit_comes_from_settings(): void
    {
        [$anna, , $conversation] = $this->chat();
        app(SiteSettings::class)->put(['max_message_file_mb' => 1]);

        $this->send($anna, $conversation, ['files' => [UploadedFile::fake()->create('big.bin', 2048)]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('files.0');
    }

    public function test_contact_card_resolves_current_user_data(): void
    {
        [$anna, , $conversation] = $this->chat();
        $friend = User::factory()->create(['first_name' => 'Ігор', 'last_name' => 'Петренко']);

        $this->send($anna, $conversation, ['contact_id' => $friend->id])
            ->assertCreated()
            ->assertJsonPath('message.type', Message::TYPE_CONTACT)
            ->assertJsonPath('message.contact.username', $friend->username)
            ->assertJsonPath('message.preview', 'Контакт: Ігор Петренко');

        $friend->update(['first_name' => 'Ігор', 'last_name' => 'Новий']);

        $this->actingAs($anna)->getJson(route('messages.history', $conversation))
            ->assertJsonPath('messages.0.contact.name', 'Ігор Новий');
    }

    public function test_contact_search_covers_whole_site(): void
    {
        $anna = User::factory()->create();
        $stranger = User::factory()->create(['first_name' => 'Зірка', 'last_name' => 'Кіберспорту']);
        User::factory()->create(['first_name' => 'Зірка', 'last_name' => 'Забанена', 'banned_at' => now()]);

        $this->actingAs($anna)->getJson(route('messages.contacts', ['q' => 'Зірка']))->assertJsonCount(0, 'users');
        $this->actingAs($anna)->getJson(route('messages.contacts', ['q' => 'Зірка', 'scope' => 'site']))
            ->assertJsonCount(1, 'users')
            ->assertJsonPath('users.0.id', $stranger->id)
            ->assertJsonPath('users.0.is_friend', false);
    }

    public function test_special_messages_cannot_be_edited_but_can_be_deleted(): void
    {
        [$anna, , $conversation] = $this->chat();
        $sticker = $this->pack()->stickers()->first();
        $id = $this->send($anna, $conversation, ['sticker_id' => $sticker->id])->json('message.id');

        $this->actingAs($anna)->patchJson(route('messages.messages.update', [$conversation, $id]), ['body' => 'хак'])->assertForbidden();
        $this->actingAs($anna)->deleteJson(route('messages.messages.destroy', [$conversation, $id]))->assertOk();
        $this->assertSoftDeleted('messages', ['id' => $id]);
    }

    public function test_admin_manages_sticker_packs(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($admin)->post(route('admin.stickers.store'), ['name' => 'Котики'])->assertRedirect();
        $pack = StickerPack::query()->sole();
        $this->assertSame('kotiki', $pack->slug);

        $this->actingAs($admin)->post(route('admin.stickers.upload', $pack), [
            'stickers' => [UploadedFile::fake()->image('a.png', 512, 512), UploadedFile::fake()->image('b.webp', 256, 256)],
            'emoji' => '🐱',
        ])->assertRedirect();
        $this->assertSame(2, $pack->stickers()->count());

        $this->actingAs($admin)->post(route('admin.stickers.upload', $pack), [
            'stickers' => [UploadedFile::fake()->image('huge.png', 2000, 2000)],
        ])->assertSessionHasErrors('stickers.0');

        $this->actingAs($admin)->patch(route('admin.stickers.update', $pack), ['is_active' => false]);
        $this->assertFalse($pack->fresh()->is_active);

        $sticker = $pack->stickers()->first();
        $this->actingAs($admin)->delete(route('admin.stickers.items.destroy', [$pack, $sticker]));
        Storage::disk('public')->assertMissing($sticker->path);

        $this->actingAs($admin)->delete(route('admin.stickers.destroy', $pack));
        $this->assertSame(0, StickerPack::query()->count());

        $user = User::factory()->create();
        $this->actingAs($user)->get(route('admin.stickers.index'))->assertForbidden();
    }
}
