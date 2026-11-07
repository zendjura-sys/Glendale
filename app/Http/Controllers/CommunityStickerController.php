<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\Message;
use App\Models\Sticker;
use App\Models\StickerPack;
use App\Support\Plugins\Plugins;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/** Набір стікерів спільноти: керують адміністратори й модератори, надсилати можуть усі учасники. */
class CommunityStickerController extends Controller
{
    public const MAX_STICKERS = 60;

    public function show(Request $request, Community $community): Response
    {
        app(Plugins::class)->ensure('community_stickers');
        $membership = $community->membershipFor($request->user());
        abort_unless($membership !== null && $membership->isActive(), 403, 'Набір бачать учасники спільноти.');
        $pack = StickerPack::query()->with('stickers')->where('community_id', $community->id)->first();

        return Inertia::render('communities/stickers', [
            'community' => $community->toCard(),
            'pack' => $pack === null ? null : [
                'id' => $pack->id,
                'name' => $pack->name,
                'stickers' => array_values($pack->stickers->map->toCard()->all()),
            ],
            'can_manage' => $this->manages($request, $community),
            'limit' => self::MAX_STICKERS,
        ]);
    }

    public function upload(Request $request, Community $community): RedirectResponse
    {
        app(Plugins::class)->ensure('community_stickers');
        abort_unless($this->manages($request, $community), 403);
        $request->validate([
            'name' => ['nullable', 'string', 'min:2', 'max:60'],
            'stickers' => ['required', 'array', 'max:20'],
            'stickers.*' => ['image', 'mimes:png,webp,gif', 'max:512', 'dimensions:max_width=512,max_height=512'],
        ], [
            'stickers.*.dimensions' => 'Стікер має бути не більше 512×512 px.',
            'stickers.*.mimes' => 'Підтримуються PNG, WebP і GIF.',
        ]);
        $pack = StickerPack::query()->firstOrCreate(
            ['community_id' => $community->id],
            ['slug' => 'c'.$community->id.'_'.Str::lower(Str::random(6)), 'name' => $request->input('name') ?: $community->name, 'is_active' => true, 'is_plus' => false, 'position' => 1000],
        );
        $raw = $request->file('stickers', []);
        $files = is_array($raw) ? array_values($raw) : [$raw];
        abort_if($pack->stickers()->count() + count($files) > self::MAX_STICKERS, 422, 'У наборі спільноти може бути до '.self::MAX_STICKERS.' стікерів.');
        $position = (int) $pack->stickers()->max('position');
        foreach ($files as $file) {
            $extension = $file->getMimeType() === 'image/gif' ? 'gif' : ($file->getMimeType() === 'image/webp' ? 'webp' : 'png');
            $pack->stickers()->create([
                'path' => $file->storeAs("stickers/{$pack->slug}", Str::random(24).'.'.$extension, 'public'),
                'position' => ++$position,
            ]);
        }
        Log::info('community: stickers added', ['community' => $community->id, 'count' => count($files), 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Стікери додано — учасники вже можуть їх надсилати.']);

        return back();
    }

    public function destroy(Request $request, Community $community, Sticker $sticker): RedirectResponse
    {
        app(Plugins::class)->ensure('community_stickers');
        abort_unless($this->manages($request, $community), 403);
        abort_unless($sticker->pack?->community_id === $community->id, 404);
        $sticker->delete();
        // Файл лишається, якщо стікер уже надсилали: старі повідомлення не ламаються.
        if (! Message::query()->where('type', Message::TYPE_STICKER)->where('meta->sticker->id', $sticker->id)->exists()) {
            Storage::disk('public')->delete($sticker->path);
        }
        Log::info('community: sticker removed', ['community' => $community->id, 'sticker' => $sticker->id, 'by' => $request->user()->id]);

        return back();
    }

    private function manages(Request $request, Community $community): bool
    {
        $membership = $community->membershipFor($request->user());

        return ($membership !== null && $membership->isManager()) || (bool) $request->user()?->isStaff();
    }
}
