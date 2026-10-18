<?php

namespace App\Http\Controllers;

use App\Models\Call;
use App\Models\CallParticipant;
use App\Models\Conversation;
use App\Models\PhoneNumber;
use App\Models\PhoneOffer;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Messenger;
use App\Services\Phones\PhoneNumbers;
use App\Services\Phones\PhoneTiers;
use App\Services\Voice\Calls;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * «Телефон»: свій внутрішній номер (випадковий безкоштовний або куплений), набирач номера,
 * дзвінок і повідомлення за номером, історія дзвінків, приватність номера.
 */
class PhoneController extends Controller
{
    public function __construct(private readonly PhoneNumbers $phones) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('phone/index', [
            ...$this->pickerProps($user),
            'privacy' => (string) $user->pref('phone_privacy', 'everyone'),
            'visible' => $this->phones->visibleOnProfile($user),
            'history' => $this->history($user),
            ...$this->offersProps($user),
        ]);
    }

    /** Передати свій куплений номер другові (друг має прийняти). */
    public function transfer(Request $request): RedirectResponse
    {
        $to = $this->friend($request);
        $this->phones->transfer($request->user(), $to);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Пропозицію надіслано — номер перейде, щойно '.$to->first_name.' прийме.']);

        return back();
    }

    public function accept(Request $request, PhoneOffer $offer): RedirectResponse
    {
        $number = $this->phones->accept($offer, $request->user());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Тепер ваш номер — '.$number->formatted().'.']);

        return back();
    }

    public function decline(Request $request, PhoneOffer $offer): RedirectResponse
    {
        $this->phones->decline($offer, $request->user());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Ви відмовилися від номера.']);

        return back();
    }

    public function cancel(Request $request, PhoneOffer $offer): RedirectResponse
    {
        $this->phones->cancel($offer, $request->user());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Пропозицію скасовано.']);

        return back();
    }

    /** Невикористаний подарунок (друг відмовився): подарувати іншому другові. */
    public function regift(Request $request, PhoneNumber $number): RedirectResponse
    {
        $to = $this->friend($request);
        $this->phones->regift($number, $request->user(), $to);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Подарунок надіслано '.$to->first_name.'.']);

        return back();
    }

    /** Невикористаний подарунок — залишити собі. */
    public function claim(Request $request, PhoneNumber $number): RedirectResponse
    {
        $this->phones->claim($number, $request->user());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Тепер ваш номер — '.$number->formatted().'.']);

        return back();
    }

    /** Дані вибору номера для вікна «Отримайте номер». */
    public function picker(Request $request): JsonResponse
    {
        return response()->json($this->pickerProps($request->user()));
    }

    /** Безкоштовний випадковий номер (+555) — з шансом на рідкісний. */
    public function random(Request $request): JsonResponse
    {
        $number = $this->phones->random($request->user());

        return response()->json([
            'phone' => $number->toCard(),
            'next_random_at' => $this->phones->nextRandomAt($request->user())?->toIso8601String(),
        ]);
    }

    /** Перевірка номера, який людина хоче купити: вільний? рівень? ціна? */
    public function check(Request $request): JsonResponse
    {
        $data = $request->validate(['operator' => ['required', 'string'], 'digits' => ['required', 'string']]);

        return response()->json($this->phones->check($request->user(), $data['operator'], $data['digits']));
    }

    /** «Підібрати»: вільні номери вибраного рівня. */
    public function suggest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tier' => ['required', 'string', 'in:'.implode(',', PhoneTiers::ALL)],
            'operator' => ['nullable', 'string', 'regex:/^(0[1-9]|[1-9]\d)$/'],
        ]);

        return response()->json(['numbers' => $this->phones->suggest($data['tier'], $data['operator'] ?? null)]);
    }

    /** Хто має цей номер (з урахуванням приватності). */
    public function lookup(Request $request): JsonResponse
    {
        $data = $request->validate(['number' => ['required', 'string', 'max:40']]);
        $viewer = $request->user();
        $number = $this->phones->find($data['number']);
        if ($number === null || $number->user->isBanned()) {
            return response()->json(['found' => false, 'message' => 'Номер не обслуговується.']);
        }
        $owner = $number->user;
        if ($owner->is($viewer)) {
            return response()->json(['found' => false, 'message' => 'Це ваш номер.']);
        }
        if (! $this->phones->reachable($viewer, $owner)) {
            return response()->json(['found' => false, 'message' => 'Абонент обмежив дзвінки за номером.']);
        }

        return response()->json([
            'found' => true,
            'phone' => $number->toCard(),
            'user' => $owner->toCard(),
        ]);
    }

    /** Подзвонити чи написати за номером: особиста бесіда з власником номера. */
    public function dial(Request $request, Messenger $messenger, Calls $calls): JsonResponse
    {
        $data = $request->validate(['number' => ['required', 'string', 'max:40']]);
        $viewer = $request->user();
        $number = $this->phones->find($data['number']);
        abort_if($number === null || $number->user->isBanned(), 404, 'Номер не обслуговується.');
        $owner = $number->user;
        abort_unless($this->phones->reachable($viewer, $owner), 403, 'Абонент обмежив дзвінки за номером.');
        abort_unless($messenger->canMessage($viewer, $owner), 403, $owner->first_name.' приймає дзвінки й повідомлення лише від друзів.');

        $conversation = $messenger->direct($viewer, $owner);

        return response()->json([
            'conversation' => ['id' => $conversation->id, 'title' => $owner->name],
            'can_call' => $calls->canCall($conversation, $viewer),
        ]);
    }

    public function settings(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'privacy' => ['required', 'string', 'in:'.implode(',', PhoneNumbers::PRIVACY)],
            'visible' => ['required', 'boolean'],
        ]);
        $request->user()->mergePref(['phone_privacy' => $data['privacy'], 'phone_visible' => (bool) $data['visible']]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування номера збережено.']);

        return back();
    }

    /** «Пізніше» у вікні вибору номера. */
    public function dismiss(Request $request): JsonResponse
    {
        $request->user()->mergePref(['phone_prompt' => false]);

        return response()->json(['ok' => true]);
    }

    private function friend(Request $request): User
    {
        $data = $request->validate(['user_id' => ['required', 'integer']]);

        return User::query()->whereKey((int) $data['user_id'])->first() ?? throw ValidationException::withMessages(['friend' => 'Друга не знайдено.']);
    }

    /**
     * Подарунки й передачі: вхідні пропозиції, мої надіслані, невикористані подарунки, друзі для вибору.
     *
     * @return array<string, mixed>
     */
    private function offersProps(User $user): array
    {
        $with = ['number', 'from', 'to'];

        return [
            'incoming' => PhoneOffer::query()->with($with)->where('to_user_id', $user->id)->where('status', PhoneOffer::PENDING)->latest('id')->get()->map->toCard()->values(),
            'outgoing' => PhoneOffer::query()->with($with)->where('from_user_id', $user->id)->where('status', PhoneOffer::PENDING)->latest('id')->get()->map->toCard()->values(),
            'gifts' => PhoneNumber::query()->where('user_id', $user->id)->where('status', PhoneNumber::GIFT)
                ->whereDoesntHave('offers', fn ($q) => $q->where('status', PhoneOffer::PENDING))
                ->get()->map(fn (PhoneNumber $n) => ['id' => $n->id, ...$n->toCard()])->values(),
            'friends' => app(FriendshipService::class)->friendsQuery($user)->orderBy('name')->limit(300)->get()->map->toCard()->values(),
        ];
    }

    /**
     * Дані для вибору номера (сторінка «Телефон», крок після реєстрації, вікно для старих акаунтів).
     *
     * @return array<string, mixed>
     */
    public function pickerProps(User $user): array
    {
        $config = $this->phones->config();
        $prices = [];
        foreach (PhoneTiers::ALL as $tier) {
            $prices[$tier] = ['price' => $this->phones->price($tier, $user), 'full_price' => $this->phones->price($tier, null)];
        }

        return [
            'phone' => $this->phones->current($user)?->toCard(),
            'codes' => ['premium' => $config['premium_code'], 'random' => $config['random_code']],
            'prices' => $prices,
            'chances' => $config['chances'],
            'discount' => $config['plus_discount'],
            'isPlus' => $user->isPlus(),
            'nextRandomAt' => $this->phones->nextRandomAt($user)?->toIso8601String(),
            'cooldownDays' => $config['random_cooldown_days'],
        ];
    }

    /**
     * Останні дзвінки в особистих бесідах: вхідні, вихідні, пропущені — з номером співрозмовника.
     *
     * @return list<array<string, mixed>>
     */
    private function history(User $user): array
    {
        $calls = Call::query()
            ->whereHas('participants', fn ($q) => $q->where('user_id', $user->id))
            ->whereHas('conversation', fn ($q) => $q->where('type', Conversation::TYPE_DIRECT))
            ->with('participants.user')
            ->latest('id')->limit(30)->get();
        $peers = $calls->map(fn (Call $call) => $call->participants->firstWhere('user_id', '!=', $user->id)?->user)->filter();
        $numbers = PhoneNumber::query()->where('status', PhoneNumber::ACTIVE)->whereIn('user_id', $peers->pluck('id'))->get()->keyBy('user_id');

        return array_values($calls->map(function (Call $call) use ($user, $numbers) {
            $peer = $call->participants->firstWhere('user_id', '!=', $user->id)?->user;
            if (! $peer instanceof User) {
                return null;
            }
            /** @var CallParticipant|null $mine */
            $mine = $call->participants->firstWhere('user_id', $user->id);
            $outgoing = $call->started_by === $user->id;
            $number = $numbers->get($peer->id);
            $shown = $number !== null && $this->phones->visibleOnProfile($peer);

            return [
                'id' => $call->id,
                'direction' => $outgoing ? 'out' : ($call->answered_at !== null && $mine?->joined_at !== null ? 'in' : 'missed'),
                'at' => $call->created_at->toIso8601String(),
                'seconds' => $call->answered_at !== null && $call->ended_at !== null ? (int) $call->answered_at->diffInSeconds($call->ended_at) : null,
                'conversation_id' => $call->conversation_id,
                'user' => $peer->toCard(),
                'phone' => $shown ? $number->toCard() : null,
            ];
        })->filter()->all());
    }
}
