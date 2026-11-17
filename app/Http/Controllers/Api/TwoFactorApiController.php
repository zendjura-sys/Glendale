<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Actions\ConfirmTwoFactorAuthentication;
use Laravel\Fortify\Actions\DisableTwoFactorAuthentication;
use Laravel\Fortify\Actions\EnableTwoFactorAuthentication;
use Laravel\Fortify\Actions\GenerateNewRecoveryCodes;
use Laravel\Fortify\Features;
use Laravel\Fortify\Fortify;

/**
 * Двофакторний захист у застосунку: ті самі кроки, що на сайті
 * (увімкнути → QR і секрет → підтвердити код → коди відновлення → вимкнути).
 * Пароль у тілі замінює підтвердження пароля сесії, якого в токена застосунку немає.
 */
class TwoFactorApiController extends Controller
{
    public function store(Request $request, EnableTwoFactorAuthentication $enable): JsonResponse
    {
        $this->ensureFeature();
        $user = $this->user($request);
        $this->password($request, $user);
        abort_if($user->hasEnabledTwoFactorAuthentication(), 422, 'Двофакторний захист уже ввімкнено.');

        $enable($user);
        $user->refresh();

        return response()->json($this->setup($user));
    }

    public function confirm(Request $request, ConfirmTwoFactorAuthentication $confirm): JsonResponse
    {
        $this->ensureFeature();
        $user = $this->user($request);
        abort_if($user->two_factor_secret === null, 422, 'Спершу увімкніть двофакторний захист.');
        abort_if($user->hasEnabledTwoFactorAuthentication(), 422, 'Двофакторний захист уже ввімкнено.');
        $data = $request->validate(['code' => ['required', 'string', 'max:20']]);

        try {
            $confirm($user, preg_replace('/\s+/', '', $data['code']) ?? '');
        } catch (ValidationException) {
            throw ValidationException::withMessages(['code' => 'Невірний код.']);
        }

        $user->refresh();

        return response()->json([
            'ok' => true,
            'two_factor' => true,
            'recovery_codes' => $this->codes($user),
        ]);
    }

    public function destroy(Request $request, DisableTwoFactorAuthentication $disable): JsonResponse
    {
        $this->ensureFeature();
        $user = $this->user($request);
        $this->password($request, $user);
        $disable($user);

        return response()->json(['ok' => true, 'two_factor' => false]);
    }

    /** QR, як GET /user/two-factor-qr-code на сайті. Пароль — у тілі запиту. */
    public function qrCode(Request $request): JsonResponse
    {
        $user = $this->pending($request);

        return response()->json([
            'svg' => $user->twoFactorQrCodeSvg(),
            'url' => $user->twoFactorQrCodeUrl(),
        ]);
    }

    /** Секрет для ручного введення, як GET /user/two-factor-secret-key на сайті. */
    public function secretKey(Request $request): JsonResponse
    {
        $user = $this->pending($request);

        return response()->json([
            'secretKey' => Fortify::currentEncrypter()->decrypt($user->two_factor_secret),
        ]);
    }

    /**
     * Поточні коди відновлення. Пароль у тілі.
     * Порожній POST (як на сайті) або regenerate: true — нові коди.
     */
    public function recoveryCodes(Request $request, GenerateNewRecoveryCodes $generate): JsonResponse
    {
        $this->ensureFeature();
        $user = $this->user($request);
        $this->password($request, $user);
        abort_if($user->two_factor_secret === null, 422, 'Спершу увімкніть двофакторний захист.');

        $regenerate = $request->exists('regenerate') ? $request->boolean('regenerate') : $request->isMethod('POST');
        if ($regenerate) {
            $generate($user);
            $user->refresh();
        }

        return response()->json(['recovery_codes' => $this->codes($user)]);
    }

    private function ensureFeature(): void
    {
        abort_unless(Features::canManageTwoFactorAuthentication(), 404);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }

    private function password(Request $request, User $user): void
    {
        $data = $request->validate(['password' => ['required', 'string']]);
        if (! is_string($user->password) || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => 'Невірний пароль.']);
        }
    }

    /** Секрет ще не підтверджено: QR і ключ можна показати після пароля. */
    private function pending(Request $request): User
    {
        $this->ensureFeature();
        $user = $this->user($request);
        $this->password($request, $user);
        abort_if($user->two_factor_secret === null, 404, 'Спершу увімкніть двофакторний захист.');

        return $user;
    }

    /**
     * @return array{svg: string, url: string, secretKey: string}
     */
    private function setup(User $user): array
    {
        return [
            'svg' => $user->twoFactorQrCodeSvg(),
            'url' => $user->twoFactorQrCodeUrl(),
            'secretKey' => Fortify::currentEncrypter()->decrypt($user->two_factor_secret),
        ];
    }

    /**
     * @return list<string>
     */
    private function codes(User $user): array
    {
        if ($user->two_factor_recovery_codes === null) {
            return [];
        }
        $codes = $user->recoveryCodes();

        return array_values(is_array($codes) ? $codes : []);
    }
}
