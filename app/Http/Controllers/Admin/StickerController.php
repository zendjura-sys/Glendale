<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\Sticker;
use App\Models\StickerPack;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class StickerController extends Controller
{
    public const MAX_PER_PACK = 120;

    public function index(): Response
    {
        $usage = Message::query()
            ->where('type', Message::TYPE_STICKER)
            ->count();

        return Inertia::render('admin/stickers', [
            'packs' => StickerPack::query()
                ->with('stickers')
                ->orderBy('position')
                ->orderBy('id')
                ->get()
                ->map(fn (StickerPack $pack) => [
                    'id' => $pack->id,
                    'slug' => $pack->slug,
                    'name' => $pack->name,
                    'author' => $pack->author,
                    'is_active' => $pack->is_active,
                    'is_plus' => $pack->is_plus,
                    'position' => $pack->position,
                    'stickers' => $pack->stickers->map->toCard()->all(),
                ]),
            'stats' => [
                'packs' => StickerPack::query()->count(),
                'stickers' => Sticker::query()->count(),
                'sent' => $usage,
            ],
            'limits' => ['per_pack' => self::MAX_PER_PACK],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'author' => ['nullable', 'string', 'max:80'],
        ]);

        $base = Str::slug(Str::transliterate($data['name']), '_') ?: 'pack';
        $slug = $base;
        for ($i = 2; StickerPack::query()->where('slug', $slug)->exists(); $i++) {
            $slug = $base.'_'.$i;
        }

        StickerPack::query()->create([
            ...$data,
            'slug' => Str::limit($slug, 40, ''),
            'position' => (int) StickerPack::query()->max('position') + 1,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Набір створено. Додайте стікери.']);

        return back();
    }

    public function update(Request $request, StickerPack $pack): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:80'],
            'author' => ['sometimes', 'nullable', 'string', 'max:80'],
            'is_active' => ['sometimes', 'boolean'],
            'is_plus' => ['sometimes', 'boolean'],
            'move' => ['sometimes', Rule::in(['up', 'down'])],
        ]);

        if (isset($data['move'])) {
            $this->move($pack, $data['move']);
            unset($data['move']);
        }

        $pack->update($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Набір оновлено.']);

        return back();
    }

    public function destroy(StickerPack $pack): RedirectResponse
    {
        $pack->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Набір видалено. Уже надіслані стікери залишаться в чатах.']);

        return back();
    }

    public function upload(Request $request, StickerPack $pack): RedirectResponse
    {
        $request->validate([
            'stickers' => ['required', 'array', 'max:40'],
            'stickers.*' => ['image', 'mimes:png,webp,gif', 'max:1024', 'dimensions:max_width=1024,max_height=1024'],
            'emoji' => ['nullable', 'string', 'max:16'],
        ], [
            'stickers.*.dimensions' => 'Стікер має бути не більше 1024×1024 px.',
            'stickers.*.mimes' => 'Підтримуються PNG, WebP і GIF.',
        ]);

        $files = $request->file('stickers', []);
        abort_if($pack->stickers()->count() + count($files) > self::MAX_PER_PACK, 422, 'У наборі може бути до '.self::MAX_PER_PACK.' стікерів.');

        $position = (int) $pack->stickers()->max('position');

        foreach ($files as $file) {
            $extension = $file->getMimeType() === 'image/gif' ? 'gif' : ($file->getMimeType() === 'image/webp' ? 'webp' : 'png');

            $pack->stickers()->create([
                'path' => $file->storeAs("stickers/{$pack->slug}", Str::random(24).'.'.$extension, 'public'),
                'emoji' => $request->input('emoji'),
                'position' => ++$position,
            ]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Стікери додано.']);

        return back();
    }

    public function destroySticker(StickerPack $pack, Sticker $sticker): RedirectResponse
    {
        $sticker->delete();

        if (! Message::query()->where('type', Message::TYPE_STICKER)->where('meta->sticker->id', $sticker->id)->exists()) {
            Storage::disk('public')->delete($sticker->path);
        }

        return back();
    }

    private function move(StickerPack $pack, string $direction): void
    {
        $ordered = StickerPack::query()->orderBy('position')->orderBy('id')->get()->values();
        $index = $ordered->search(fn (StickerPack $p) => $p->is($pack));
        $swap = $direction === 'up' ? $index - 1 : $index + 1;

        if ($index === false || ! isset($ordered[$swap])) {
            return;
        }

        $ordered->each(fn (StickerPack $p, int $i) => $p->position = $i);
        [$ordered[$index]->position, $ordered[$swap]->position] = [$ordered[$swap]->position, $ordered[$index]->position];
        $ordered->each->save();
    }
}
