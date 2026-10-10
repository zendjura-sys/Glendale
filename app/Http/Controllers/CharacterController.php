<?php

namespace App\Http\Controllers;

use App\Models\FamilyMember;
use App\Models\GtaServer;
use App\Models\RpCharacter;
use App\Models\User;
use App\Models\UserBlock;
use App\Services\ImageStorage;
use App\Support\Plugins\Plugins;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Персонажі RP: кілька ролей у гравця, у кожної — сервер, сім’я, біографія, історія й фото. */
class CharacterController extends Controller implements HasMiddleware
{
    public function __construct(private readonly ImageStorage $images) {}

    public static function middleware(): array
    {
        return [function (Request $request, Closure $next) {
            app(Plugins::class)->ensure('rp_characters');

            return $next($request);
        }];
    }

    public function show(Request $request, RpCharacter $character): Response
    {
        $viewer = $request->user();
        $character->loadMissing(['user', 'server', 'family']);
        abort_if(UserBlock::between($character->user, $viewer), 404);

        return Inertia::render('characters/show', [
            'character' => [
                ...$character->toCard(),
                'story' => $character->story,
                'photos' => $this->photoUrls($character),
                'created_at' => $character->created_at->toIso8601String(),
            ],
            'others' => array_values(RpCharacter::query()->with(['user', 'server', 'family'])
                ->where('user_id', $character->user_id)->whereKeyNot($character->id)
                ->orderByDesc('is_main')->latest('updated_at')->limit(8)->get()
                ->map(fn (RpCharacter $other) => $other->toCard())->all()),
            'can_edit' => $character->user_id === $viewer->id,
            'photo_limit' => RpCharacter::PHOTOS,
        ]);
    }

    public function create(Request $request): Response
    {
        $server = is_string($request->query('server')) ? GtaServer::query()->published()->where('slug', $request->query('server'))->first() : null;

        return Inertia::render('characters/edit', [
            'character' => null,
            'server' => $server?->slug,
            ...$this->options($request->user()),
        ]);
    }

    public function edit(Request $request, RpCharacter $character): Response
    {
        $this->own($request, $character);
        $character->loadMissing(['server', 'family']);

        return Inertia::render('characters/edit', [
            'character' => [
                'id' => $character->id,
                'name' => $character->name,
                'age' => $character->age,
                'occupation' => $character->occupation,
                'bio' => $character->bio,
                'story' => $character->story,
                'status' => $character->status,
                'is_main' => $character->is_main,
                'family_id' => $character->family_id,
                'portrait_url' => $character->portrait_url,
            ],
            'server' => $character->server->slug,
            ...$this->options($request->user()),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();
        abort_if(RpCharacter::query()->where('user_id', $user->id)->count() >= RpCharacter::LIMIT, 422, 'Можна мати до 10 персонажів.');
        $data = $this->validated($request, $user);
        $character = RpCharacter::query()->create(['user_id' => $user->id, ...$data]);
        $this->portrait($request, $character);
        $this->onlyMain($character);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Персонажа створено.']);

        return redirect('/characters/'.$character->id);
    }

    public function update(Request $request, RpCharacter $character): RedirectResponse
    {
        $this->own($request, $character);
        $character->update($this->validated($request, $request->user()));
        $this->portrait($request, $character);
        $this->onlyMain($character);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Персонажа збережено.']);

        return redirect('/characters/'.$character->id);
    }

    public function destroy(Request $request, RpCharacter $character): RedirectResponse
    {
        $this->own($request, $character);
        $this->images->delete($character->portrait_path);
        foreach ($character->photos ?? [] as $path) {
            $this->images->delete($path);
        }
        $character->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Персонажа видалено.']);

        return redirect('/'.$request->user()->username);
    }

    public function addPhoto(Request $request, RpCharacter $character): RedirectResponse
    {
        $this->own($request, $character);
        $photos = $character->photos ?? [];
        abort_if(count($photos) >= RpCharacter::PHOTOS, 422, 'У галереї персонажа до 6 фото.');
        $request->validate(['photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:15360']]);
        $stored = $this->images->store($request->file('photo'), 'characters/photos', 1920);
        $character->update(['photos' => [...$photos, $stored['path']]]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Фото додано.']);

        return back();
    }

    public function removePhoto(Request $request, RpCharacter $character, int $index): RedirectResponse
    {
        $this->own($request, $character);
        $photos = $character->photos ?? [];
        abort_unless(isset($photos[$index]), 404);
        $this->images->delete($photos[$index]);
        array_splice($photos, $index, 1);
        $character->update(['photos' => $photos === [] ? null : $photos]);

        return back();
    }

    /**
     * Персонажі для профілю або сервера.
     *
     * @return list<array<string, mixed>>
     */
    public static function cards(?User $player = null, ?GtaServer $server = null, int $limit = 12): array
    {
        if (! app(Plugins::class)->on('rp_characters')) {
            return [];
        }

        return array_values(RpCharacter::query()->with(['user', 'server', 'family'])
            ->when($player, fn ($query, User $user) => $query->where('user_id', $user->id)->orderByDesc('is_main'))
            ->when($server, fn ($query, GtaServer $s) => $query->where('gta_server_id', $s->id)->where('status', '!=', 'dead'))
            ->latest('updated_at')->limit($limit)->get()
            ->map(fn (RpCharacter $character) => $character->toCard())->all());
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, User $user): array
    {
        $data = $request->validate([
            'server' => ['required', 'string', 'max:80'],
            'name' => ['required', 'string', 'max:60'],
            'age' => ['nullable', 'integer', 'min:1', 'max:150'],
            'occupation' => ['nullable', 'string', 'max:60'],
            'bio' => ['nullable', 'string', 'max:600'],
            'story' => ['nullable', 'string', 'max:5000'],
            'status' => ['required', Rule::in(array_keys(RpCharacter::STATUSES))],
            'is_main' => ['boolean'],
            'family_id' => ['nullable', 'integer'],
            'portrait' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:15360'],
        ]);
        $server = GtaServer::query()->published()->where('slug', $data['server'])->first();
        abort_unless($server instanceof GtaServer, 422, 'Оберіть сервер з каталогу.');

        // Сім’я — лише та, де гравець зараз у складі, і на тому самому сервері.
        $familyId = null;
        if (! empty($data['family_id'])) {
            $familyId = FamilyMember::query()
                ->where('user_id', $user->id)
                ->where('status', FamilyMember::STATUS_ACTIVE)
                ->where('family_id', (int) $data['family_id'])
                ->whereHas('family', fn ($query) => $query->where('server_id', $server->id))
                ->value('family_id');
            abort_if($familyId === null, 422, 'Сім’я має бути на тому самому сервері, і ви маєте бути в її складі.');
        }

        $clean = fn (?string $value) => ($value = trim((string) $value)) === '' ? null : $value;

        return [
            'gta_server_id' => $server->id,
            'family_id' => $familyId,
            'name' => trim($data['name']),
            'age' => $data['age'] ?? null,
            'occupation' => $clean($data['occupation'] ?? null),
            'bio' => $clean($data['bio'] ?? null),
            'story' => $clean($data['story'] ?? null),
            'status' => $data['status'],
            'is_main' => (bool) ($data['is_main'] ?? false),
        ];
    }

    private function portrait(Request $request, RpCharacter $character): void
    {
        if (! $request->hasFile('portrait')) {
            return;
        }
        $stored = $this->images->store($request->file('portrait'), 'characters/portraits', cover: [720, 900]);
        $this->images->delete($character->portrait_path);
        $character->update(['portrait_path' => $stored['path']]);
    }

    /** Головний персонаж — один на сервер у гравця. */
    private function onlyMain(RpCharacter $character): void
    {
        if ($character->is_main) {
            RpCharacter::query()->where('user_id', $character->user_id)->where('gta_server_id', $character->gta_server_id)
                ->whereKeyNot($character->id)->update(['is_main' => false]);
        }
    }

    private function own(Request $request, RpCharacter $character): void
    {
        abort_unless($character->user_id === $request->user()->id, 403);
    }

    /**
     * @return list<string>
     */
    private function photoUrls(RpCharacter $character): array
    {
        return array_map(fn (string $path) => Storage::disk('public')->url($path), $character->photos ?? []);
    }

    /**
     * @return array{servers: list<array{slug: string, name: string}>, families: list<array{id: int, name: string, tag: string, server: string}>, statuses: array<string, string>}
     */
    private function options(User $user): array
    {
        return [
            'servers' => array_values(GtaServer::query()->published()->orderBy('name')->limit(300)->get(['slug', 'name'])
                ->map(fn (GtaServer $server) => ['slug' => $server->slug, 'name' => $server->name])->all()),
            'families' => array_values(FamilyMember::query()->with('family.server')
                ->where('user_id', $user->id)->where('status', FamilyMember::STATUS_ACTIVE)->get()
                ->filter(fn (FamilyMember $member) => $member->family->server !== null)
                ->map(fn (FamilyMember $member) => [
                    'id' => $member->family->id,
                    'name' => $member->family->name,
                    'tag' => $member->family->tag,
                    'server' => $member->family->server->slug,
                ])->all()),
            'statuses' => RpCharacter::STATUSES,
        ];
    }
}
