<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\StaffRole;
use App\Models\User;
use App\Models\UserRole;
use App\Services\Achievements;
use App\Services\Profile\UserRoles;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Адмінка → Ролі: ролі-плашки з титулами для всіх користувачів («old», «Big Sponsor»).
 * Видаються вручну або автоматично за правилом. Кожна дія — в журнал (roles: …).
 */
class UserRoleController extends Controller
{
    public function index(Request $request): Response
    {
        $roles = UserRole::query()->withCount('users')->orderBy('priority')->orderBy('id')->get();
        $selected = $request->integer('role') ?: null;

        return Inertia::render('admin/roles', [
            'roles' => $roles->map(fn (UserRole $r) => [...$r->toCard(), 'priority' => $r->priority, 'active_from' => $r->active_from?->toDateString(), 'active_until' => $r->active_until?->toDateString(), 'active' => $r->activeNow(), 'rule' => $r->rule, 'rule_value' => $r->rule_value, 'members' => $r->users_count])->values(),
            'members' => $selected ? UserRole::query()->find($selected)?->users()->orderByPivot('created_at', 'desc')->limit(100)->get()
                ->map(fn (User $u) => [...$u->toCard(), 'auto' => (bool) $u->pivot->auto])->values() : [],
            'selected' => $selected,
            'kinds' => UserRole::KINDS,
            'rules' => UserRole::RULES,
            'icons' => UserRole::ICONS,
            'colors' => StaffRole::COLORS,
            'achievements' => app(Achievements::class)->catalog(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $role = UserRole::query()->create($this->data($request));
        UserRoles::forget();
        Log::info('roles: created', ['role' => $role->id, 'name' => $role->name, 'rule' => $role->rule, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Роль «{$role->name}» створено."]);

        return back();
    }

    public function update(Request $request, UserRole $role): RedirectResponse
    {
        $role->update($this->data($request));
        UserRoles::forget();
        Log::info('roles: updated', ['role' => $role->id, 'name' => $role->name, 'rule' => $role->rule, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Роль «{$role->name}» оновлено."]);

        return back();
    }

    public function destroy(Request $request, UserRole $role): RedirectResponse
    {
        $role->delete();
        UserRoles::forget();
        Log::info('roles: deleted', ['role' => $role->id, 'name' => $role->name, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Роль «{$role->name}» видалено."]);

        return back();
    }

    /** Видати роль людині за ніком (вручну — лишається, доки адміністратор не забере). */
    public function grant(Request $request, UserRole $role): RedirectResponse
    {
        $data = $request->validate(['username' => ['required', 'string', 'max:40']]);
        $user = User::query()->where('username', ltrim($data['username'], '@'))->first();
        if ($user === null) {
            throw ValidationException::withMessages(['username' => 'Людину з таким ніком не знайдено.']);
        }
        DB::table('user_role_user')->updateOrInsert(
            ['user_role_id' => $role->id, 'user_id' => $user->id],
            ['auto' => false, 'granted_by' => $request->user()->id, 'updated_at' => now(), 'created_at' => now()],
        );
        Log::info('roles: granted', ['role' => $role->id, 'user' => $user->id, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Роль «{$role->name}» видано @{$user->username}."]);

        return back();
    }

    public function revoke(Request $request, UserRole $role, User $user): RedirectResponse
    {
        DB::table('user_role_user')->where('user_role_id', $role->id)->where('user_id', $user->id)->delete();
        Log::info('roles: revoked', ['role' => $role->id, 'user' => $user->id, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Роль «{$role->name}» забрано в @{$user->username}."]);

        return back();
    }

    /** Запустити видачу автоматичних ролей зараз (не чекаючи ночі). */
    public function sync(Request $request, UserRoles $roles): RedirectResponse
    {
        $changes = $roles->sync();
        Log::info('roles: synced', ['changes' => $changes, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Автоматичні ролі оновлено: змін — {$changes}."]);

        return back();
    }

    /**
     * @return array{name: string, kind: string, active_from: string|null, active_until: string|null, color: string, icon: string|null, priority: int, rule: string, rule_value: string|null, description: string|null}
     */
    private function data(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:30'],
            'kind' => ['required', Rule::in(array_keys(UserRole::KINDS))],
            'active_from' => ['nullable', 'date'],
            'active_until' => ['nullable', 'date', 'after_or_equal:active_from'],
            'color' => ['required', Rule::in(StaffRole::COLORS)],
            'icon' => ['nullable', Rule::in(UserRole::ICONS)],
            'priority' => ['required', 'integer', 'min:0', 'max:999'],
            'rule' => ['required', Rule::in(array_keys(UserRole::RULES))],
            'rule_value' => ['nullable', 'string', 'max:64', 'required_if:rule,account_years,level,achievement,spent'],
            'description' => ['nullable', 'string', 'max:160'],
        ], ['rule_value.required_if' => 'Для цього правила вкажіть значення.', 'active_until.after_or_equal' => 'Дата завершення не може бути раніше початку.']);
        $rule = (string) $data['rule'];
        $value = $data['rule_value'] ?? null;
        if (in_array($rule, ['account_years', 'level', 'spent'], true) && (! ctype_digit((string) $value) || (int) $value < 1)) {
            throw ValidationException::withMessages(['rule_value' => 'Вкажіть ціле число від 1.']);
        }
        if ($rule === 'achievement' && ! collect(app(Achievements::class)->catalog())->contains('key', $value)) {
            throw ValidationException::withMessages(['rule_value' => 'Такого досягнення немає.']);
        }

        return [
            'name' => trim((string) $data['name']),
            'kind' => (string) $data['kind'],
            'active_from' => $data['kind'] === 'holiday' ? ($data['active_from'] ?? null) : null,
            'active_until' => $data['kind'] === 'holiday' ? ($data['active_until'] ?? null) : null,
            'color' => (string) $data['color'],
            'icon' => $data['icon'] ?? null,
            'priority' => (int) $data['priority'],
            'rule' => $rule,
            'rule_value' => in_array($rule, ['manual', 'plus'], true) ? null : (string) $value,
            'description' => $data['description'] ?? null,
        ];
    }
}
