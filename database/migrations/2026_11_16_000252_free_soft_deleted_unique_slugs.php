<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * М’яко видалені сім’ї/клани/спільноти тримали slug і tag у унікальних індексах —
 * нову сутність з тим самим тегом створити було неможливо. Звільняємо ідентифікатори.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (DB::table('families')->whereNotNull('deleted_at')->get(['id', 'slug', 'tag']) as $row) {
            DB::table('families')->where('id', $row->id)->update([
                'slug' => $this->freeSlug((string) $row->slug, (int) $row->id, 60),
                'tag' => $this->freeTag((string) $row->tag, (int) $row->id),
            ]);
        }
        foreach (DB::table('clans')->whereNotNull('deleted_at')->get(['id', 'slug', 'tag']) as $row) {
            DB::table('clans')->where('id', $row->id)->update([
                'slug' => $this->freeSlug((string) $row->slug, (int) $row->id, 80),
                'tag' => $this->freeTag((string) $row->tag, (int) $row->id),
            ]);
        }
        foreach (DB::table('communities')->whereNotNull('deleted_at')->get(['id', 'slug']) as $row) {
            DB::table('communities')->where('id', $row->id)->update([
                'slug' => $this->freeSlug((string) $row->slug, (int) $row->id, 32),
            ]);
        }
    }

    public function down(): void
    {
        // Ідентифікатори вже змінені — відкат не відновлює попередні slug/tag.
    }

    private function freeSlug(string $slug, int $id, int $max): string
    {
        $suffix = '-d'.$id;
        if (str_ends_with($slug, $suffix)) {
            return $slug;
        }

        return Str::limit($slug, max(1, $max - strlen($suffix)), '').$suffix;
    }

    private function freeTag(string $tag, int $id): string
    {
        if (preg_match('/\AD\d+\z/', $tag) === 1) {
            return $tag;
        }

        return Str::upper(Str::substr('D'.$id, 0, 8));
    }
};
