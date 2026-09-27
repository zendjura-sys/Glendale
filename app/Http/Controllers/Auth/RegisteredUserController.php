<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UnionBlacklistedFamily;
use App\Models\UnionBlacklistedPlayer;
use App\Support\FamilyContent;
use App\Support\UnionDomain;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('Auth/Register', [
            'isUnion' => $this->isUnionRequest($request),
            'unionRoles' => User::UNION_ROLES,
        ]);
    }

    /** union.gamecon.online реєструє союзників, а не учасників родини — форма й валідація тут різняться. */
    private function isUnionRequest(Request $request): bool
    {
        return UnionDomain::matches($request);
    }

    /**
     * Handle an incoming registration request.
     *
     * Якщо хтось раніше подав звіт "за друга" з таким самим ім'ям —
     * заведено тіньовий акаунт (User::createShadow, без входу). Замість
     * тихого автозлиття за самим лише ім'ям (можна нарватись на тезку чи
     * підміну чужої статистики) показуємо підтвердження: людина сама каже
     * "так, це я" — і тоді реєстрація ЗАПОВНЮЄ вже наявний рядок замість
     * створення нового, зберігаючи всю історію (звіти/прогресія/премії
     * прив'язані до user_id, який при цьому не змінюється).
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse|Response
    {
        $isUnion = $this->isUnionRequest($request);

        $data = $request->validate([
            'first_name' => 'required|string|max:120',
            // Фамилия не обязательна: часть людей в игре известна одним ником.
            'last_name' => 'nullable|string|max:120',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'claim_shadow_id' => ['nullable', 'integer'],
            'skip_shadow_check' => ['nullable', 'boolean'],
            'union_family_name' => [$isUnion ? 'required' : 'prohibited', 'string', 'max:120'],
            'union_role' => [$isUnion ? 'required' : 'prohibited', 'string', 'in:'.implode(',', array_keys(User::UNION_ROLES))],
        ]);

        $fullName = trim($data['first_name'].' '.($data['last_name'] ?? ''));

        // ЧС гравця діє на ОБОХ сайтах — і союзному, і основному
        // (gamecon.online): гравець, якого союзники занесли в чорний список,
        // не може зареєструватись у родині так само, як не може
        // зареєструватись союзником. ЧСС родин — лише для union.gamecon.online,
        // на основному сайті поняття "родина союзника" не існує.
        if (UnionBlacklistedPlayer::isBlacklisted($data['first_name'], $data['last_name'] ?? null)) {
            throw ValidationException::withMessages(['first_name' => 'Цей гравець у чорному списку союзу — реєстрація недоступна.']);
        }

        if ($isUnion && UnionBlacklistedFamily::isBlacklisted($data['union_family_name'])) {
            throw ValidationException::withMessages(['union_family_name' => 'Ця родина в чорному списку союзу — реєстрація недоступна.']);
        }

        // Тіньові акаунти заводить лише Reports (подача звіту "за друга") —
        // це суто внутрішня механіка Monsory, у союзників таких збігів
        // бути не може, тож для них цей крок пропускаємо зовсім.
        if (! $isUnion && empty($data['claim_shadow_id']) && empty($data['skip_shadow_check'])) {
            $shadow = User::query()->where('is_shadow', true)->where('name', $fullName)->first();

            if ($shadow) {
                return Inertia::render('Auth/Register', [
                    'shadowMatch' => ['id' => $shadow->id, 'name' => $shadow->name],
                    'previousInput' => $request->only('first_name', 'last_name', 'email'),
                    'isUnion' => $isUnion,
                    'unionRoles' => User::UNION_ROLES,
                ]);
            }
        }

        if (! empty($data['claim_shadow_id'])) {
            $shadow = User::query()->where('id', $data['claim_shadow_id'])->where('is_shadow', true)->first();

            // Ім'я звіряємо ще раз: між показом підтвердження і сабмітом
            // хтось міг помінятись даними, довіряти самому лише ID небезпечно.
            if (! $shadow || $shadow->name !== $fullName) {
                throw ValidationException::withMessages(['email' => 'Не вдалося підтвердити профіль — спробуйте ще раз.']);
            }

            $shadow->update([
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                'is_shadow' => false,
            ]);

            $user = $shadow;
        } elseif ($isUnion) {
            $user = User::create([
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'] ?? null,
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                // Союзник не входить в ієрархію Monsory — position_key
                // навмисно лишається порожнім, замість присвоєння "Стажера".
                'position_key' => null,
                'union_family_name' => $data['union_family_name'],
                'union_role' => $data['union_role'],
            ]);
        } else {
            $user = User::create([
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'] ?? null,
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                // "Починають усі однаково — зі Стажера" — та же формулировка,
                // что на сайте и в боте. Берём ПЕРВЫЙ ключ из живого списка
                // (не хардкодим 'trainee'): если админ когда-нибудь переставит
                // должности так, что первой станет другая, регистрация должна
                // следовать за этим, а не молча указывать в старую позицию.
                'position_key' => FamilyContent::positionKeys()[0] ?? null,
            ]);
        }

        event(new Registered($user));

        Auth::login($user);

        return redirect(route('dashboard', absolute: false));
    }
}
