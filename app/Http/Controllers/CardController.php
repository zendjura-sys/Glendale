<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Cards\CardCollection;
use App\Services\Cards\CardDrops;
use App\Services\FriendshipService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Колекційні картки: альбом, щоденний набір і зароблені картки (з кристалами для кращого шансу),
 * розщеплення на кристали, створення, подарунок дубліката другові, вітрина профілю.
 */
class CardController extends Controller
{
    public function __construct(private readonly CardCollection $cards, private readonly CardDrops $drops) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('cards/index', [
            ...$this->cards->album($user),
            'drops' => $this->drops->pending($user),
            'friends' => Inertia::defer(fn () => User::query()->whereIn('id', app(FriendshipService::class)->friendIds($user))
                ->orderBy('first_name')->limit(200)->get()->map(fn (User $u) => $u->toCard())->values()),
        ]);
    }

    /** Шанс рангу R+ для обраної кількості кристалів (повзунок). */
    public function chance(Request $request): JsonResponse
    {
        $crystals = (int) $request->validate(['crystals' => ['required', 'integer', 'min:0', 'max:'.CardCollection::BOOST_CAP]])['crystals'];

        return response()->json(['high' => $this->cards->highChance($crystals)]);
    }

    public function open(Request $request): JsonResponse
    {
        $crystals = $this->crystals($request);

        return response()->json(['cards' => $this->cards->openPack($request->user(), $crystals)]);
    }

    public function openDrop(Request $request, int $drop): JsonResponse
    {
        return response()->json(['cards' => [$this->drops->open($request->user(), $drop, $this->crystals($request))]]);
    }

    public function split(Request $request, string $card): JsonResponse
    {
        $count = (int) $request->validate(['count' => ['nullable', 'integer', 'min:1', 'max:1000']])['count'] ?: 1;

        return response()->json(['crystals' => $this->cards->split($request->user(), $card, $count)]);
    }

    public function gift(Request $request, string $card): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validate(['user_id' => ['required', 'integer']]);
        abort_unless(in_array((int) $data['user_id'], app(FriendshipService::class)->friendIds($user), true), 403, 'Дарувати можна лише друзям.');
        $this->cards->gift($user, $card, User::query()->findOrFail($data['user_id']));

        return back()->with('success', 'Картку подаровано.');
    }

    public function dust(Request $request): RedirectResponse
    {
        $gain = $this->cards->dustDuplicates($request->user());

        return back()->with('success', $gain > 0 ? "Отримано кристалів: {$gain}." : 'Дублікатів немає.');
    }

    public function craft(Request $request, string $card): RedirectResponse
    {
        $this->cards->craft($request->user(), $card);

        return back()->with('success', 'Картку створено.');
    }

    public function showcase(Request $request, string $card): RedirectResponse
    {
        $this->cards->toggleShowcase($request->user(), $card);

        return back();
    }

    private function crystals(Request $request): int
    {
        return (int) ($request->validate(['crystals' => ['nullable', 'integer', 'min:0', 'max:'.CardCollection::BOOST_CAP]])['crystals'] ?? 0);
    }
}
