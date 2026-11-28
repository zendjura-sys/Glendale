<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\VideoBackground;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Адмінка → Дизайн → «Відеофони GameCon+»: завантаження, приховування, видалення. */
class VideoBackgroundsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_uploads_toggles_and_deletes_video_background(): void
    {
        Storage::fake('public');
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->post('/admin/design/videos', [
            'title' => 'Неонове місто',
            'mobile' => UploadedFile::fake()->create('m.mp4', 2000, 'video/mp4'),
            'desktop' => UploadedFile::fake()->create('d.mp4', 3000, 'video/mp4'),
        ])->assertSessionHasNoErrors();
        $video = VideoBackground::sole();
        Storage::disk('public')->assertExists([$video->mobile_path, $video->desktop_path]);

        $this->actingAs($admin)->post("/admin/design/videos/{$video->id}/toggle")->assertRedirect();
        $this->assertFalse($video->fresh()->is_active);

        $this->actingAs($admin)->delete("/admin/design/videos/{$video->id}")->assertRedirect();
        $this->assertDatabaseCount('video_backgrounds', 0);
        Storage::disk('public')->assertMissing($video->mobile_path);
    }

    public function test_video_file_is_required_and_admin_only(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->post('/admin/design/videos', ['title' => 'Порожньо'])->assertSessionHasErrors('mobile');
        $this->actingAs(User::factory()->create())->post('/admin/design/videos', ['title' => 'x'])->assertForbidden();
    }
}
