<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PhoneNumber;
use App\Models\User;
use App\Services\Billing\GooglePlay;
use App\Services\Billing\GooglePlayException;
use App\Services\Phones\PhoneNumbers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Покупка GameCon+ у застосунку через Google Play Billing.
 *
 * Ціни, назви й періоди застосунок бере з Google Play (ProductDetails), а не з сервера: сервер віддає лише
 * ID підписок і ідентифікатор акаунта для obfuscatedAccountId. Жодних посилань на оплату на сайті.
 */
class GooglePlayController extends Controller
{
    public function __construct(private readonly GooglePlay $play) {}

    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $enabled = $this->play->enabled();

        $phones = $this->play->phonesEnabled();

        return response()->json([
            'enabled' => $enabled,
            'products' => $enabled ? $this->play->products() : [],
            'account_id' => $enabled || $phones ? $this->play->accountId($user) : null,
            // Номери телефону — разові товари phone_<рівень>.
            'phone_products' => $phones ? $this->play->phoneProducts() : [],
        ]);
    }

    /** Застосунок отримав покупку від Google Play — перевіряємо її на сервері й вмикаємо GameCon+. */
    public function verify(Request $request): JsonResponse
    {
        abort_unless($this->play->enabled(), 404);
        $data = $request->validate([
            'purchase_token' => ['required', 'string', 'min:10', 'max:4000'],
            'product_id' => ['nullable', 'string', 'max:64'],
        ]);
        /** @var User $user */
        $user = $request->user();

        try {
            $subscription = $this->play->sync($data['purchase_token'], $user);
        } catch (GooglePlayException $e) {
            abort($e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 422, $e->getMessage());
        }
        $user->refresh();

        return response()->json([
            'is_pro' => $user->isPlus(),
            'expires_at' => $user->isPlus() ? $user->plus_until?->toIso8601ZuluString() : null,
            'status' => $subscription->status,
            'acknowledged' => $subscription->acknowledged_at !== null,
        ]);
    }

    /** Забронювати номер на час оплати в Google Play; profile_id іде в obfuscatedProfileId покупки. */
    public function phoneHold(Request $request, PhoneNumbers $phones): JsonResponse
    {
        abort_unless($this->play->phonesEnabled(), 404);
        $data = $request->validate([
            'operator' => ['required', 'string', 'regex:/^\d{2}$/'],
            'digits' => ['required', 'string', 'regex:/^\d{7}$/'],
            'gift_to' => ['nullable', 'integer'],
        ]);
        /** @var User $user */
        $user = $request->user();
        $giftTo = isset($data['gift_to']) ? User::query()->find((int) $data['gift_to']) : null;
        $tier = $phones->tierOf($data['operator'], $data['digits']);
        $number = $phones->hold($user, $data['operator'], $data['digits'], PhoneNumbers::product($tier), $giftTo);

        return response()->json([
            'product' => PhoneNumbers::product($number->tier),
            'profile_id' => $this->play->holdId($number),
            'account_id' => $this->play->accountId($user),
            'phone' => $number->toCard(),
        ]);
    }

    /** Застосунок отримав покупку номера від Google Play — перевіряємо й вмикаємо номер. */
    public function phoneVerify(Request $request): JsonResponse
    {
        abort_unless($this->play->phonesEnabled(), 404);
        $data = $request->validate([
            'purchase_token' => ['required', 'string', 'min:10', 'max:4000'],
            'product_id' => ['required', 'string', 'max:64'],
            'amount_micros' => ['nullable', 'integer', 'min:0'],
            'currency' => ['nullable', 'string', 'max:8'],
        ]);
        /** @var User $user */
        $user = $request->user();

        try {
            $number = $this->play->purchasePhone($data['purchase_token'], $data['product_id'], $user, (int) ($data['amount_micros'] ?? 0), (string) ($data['currency'] ?? ''));
        } catch (GooglePlayException $e) {
            abort($e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 422, $e->getMessage());
        }

        return response()->json([
            'phone' => $number->toCard(),
            'gift' => $number->status === PhoneNumber::GIFT,
            'message' => $number->status === PhoneNumber::GIFT ? 'Подарунок надіслано — номер перейде, щойно друг прийме.' : 'Тепер ваш номер — '.$number->formatted().'.',
        ]);
    }
}
