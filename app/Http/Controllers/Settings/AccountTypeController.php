<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\AccountLink;
use App\Models\User;
use App\Services\Accounts\AccountTypes;
use App\Services\Accounts\Verification;
use App\Support\Plugins\Plugins;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Налаштування → «Тип акаунта»: спеціальний акаунт, склад і верифікація 2.0. */
class AccountTypeController extends Controller
{
    public function __construct(
        private readonly AccountTypes $types,
        private readonly Verification $verification,
    ) {}

    public function edit(Request $request): Response
    {
        $plugins = app(Plugins::class);
        abort_unless($plugins->on('account_types') || $plugins->on('verification_v2'), 404);
        $user = $request->user();

        return Inertia::render('settings/account-type', [
            'types' => $plugins->on('account_types') ? collect(AccountTypes::TYPES)->map(fn (array $t, string $key) => ['key' => $key, 'label' => $t['label'], 'icon' => $t['icon'], 'fields' => $t['fields'], 'roster' => $t['roster']])->values()->all() : null,
            'current' => ['type' => $user->account_type, 'details' => $user->account_details ?? []],
            'roster' => (AccountTypes::TYPES[$user->account_type]['roster'] ?? false) ? $this->types->roster($user, withPending: true) : null,
            'invitations' => $this->types->invitations($user),
            'verification' => $plugins->on('verification_v2') ? $this->verification->state($user) : null,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        app(Plugins::class)->ensure('account_types');
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(AccountTypes::TYPES))],
            'details' => ['nullable', 'array'],
            'details.*' => ['nullable', 'string', 'max:160'],
        ]);
        $this->types->set($request->user(), $data['type'], $data['details'] ?? []);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Тип акаунта збережено.']);

        return back();
    }

    public function invite(Request $request): RedirectResponse
    {
        app(Plugins::class)->ensure('account_types');
        $data = $request->validate(['username' => ['required', 'string', 'max:40'], 'role' => ['nullable', 'string', 'max:40']]);
        $member = User::query()->where('username', ltrim(trim($data['username']), '@'))->first();
        abort_if($member === null, 422, 'Людину з такою адресою не знайдено.');
        $this->types->invite($request->user(), $member, $data['role'] ?? null);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запрошення надіслано — людина має підтвердити.']);

        return back();
    }

    public function answer(Request $request, AccountLink $link): RedirectResponse
    {
        $data = $request->validate(['accept' => ['required', 'boolean']]);
        $this->types->answer($request->user(), $link, (bool) $data['accept']);

        return back();
    }

    public function remove(Request $request, AccountLink $link): RedirectResponse
    {
        $this->types->remove($request->user(), $link);

        return back();
    }

    public function verify(Request $request): RedirectResponse
    {
        app(Plugins::class)->ensure('verification_v2');
        $data = $request->validate([
            'kind' => ['required', Rule::in(array_keys(Verification::KINDS))],
            'links' => ['required', 'array', 'min:1', 'max:5'],
            'links.*' => ['required', 'url:http,https', 'max:255'],
            'note' => ['nullable', 'string', 'max:1000'],
            'document' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ]);
        $this->verification->apply($request->user(), $data['kind'], array_values($data['links']), $data['note'] ?? null, $request->file('document'));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Заявку надіслано. Відповідь прийде сповіщенням.']);

        return back();
    }
}
