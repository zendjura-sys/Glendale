<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\StaffRole;
use App\Models\User;
use App\Support\Staff\StaffRoles;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Команда (ролі й доручені розділи), воронка реєстрації й перегляд сайту очима людини (лише читання). */
class TeamController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/team', [
            'staff' => User::query()->with('staffRole')->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MODERATOR])->orderBy('role')->orderBy('name')->get()
                ->map(fn (User $u) => [...$u->toCard(), 'role' => $u->role, 'staff_role_id' => $u->staff_role_id, 'own_sections' => (array) $u->staff_sections, 'sections' => StaffRoles::sections($u)])->values(),
            'sections' => StaffRoles::SECTIONS,
            'roles' => StaffRole::query()->withCount('users')->orderBy('name')->get()->map(fn (StaffRole $r) => $r->toCard())->values(),
            'colors' => StaffRole::COLORS,
        ]);
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'role' => ['required', Rule::in([User::ROLE_USER, User::ROLE_MODERATOR, User::ROLE_ADMIN])],
            'sections' => ['array'],
            'sections.*' => ['string', Rule::in(array_keys(StaffRoles::SECTIONS))],
            'staff_role_id' => ['nullable', 'integer', Rule::exists('staff_roles', 'id')],
        ]);
        abort_if($user->id === $request->user()->id && $data['role'] !== User::ROLE_ADMIN, 422, 'Свою роль адміністратора зняти не можна.');
        $staff = $data['role'] !== User::ROLE_USER;
        $user->forceFill([
            'role' => $data['role'],
            'staff_sections' => $data['role'] === User::ROLE_MODERATOR ? array_values(array_unique($data['sections'] ?? [])) : null,
            // Назва ролі (значок біля ніка) — і в адміністраторів, і в модераторів; людина без ролі команди — без неї.
            'staff_role_id' => $staff ? ($data['staff_role_id'] ?? null) : null,
        ])->save();
        Log::info('team: role updated', ['user' => $user->id, 'role' => $data['role'], 'staff_role' => $user->staff_role_id, 'sections' => $user->staff_sections, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Роль оновлено.']);

        return back();
    }

    public function add(Request $request): RedirectResponse
    {
        $data = $request->validate(['username' => ['required', 'string', 'max:40']]);
        $user = User::query()->where('username', ltrim($data['username'], '@'))->first();
        abort_if($user === null, 422, 'Людину з таким ніком не знайдено.');
        if (! $user->isStaff()) {
            $user->forceFill(['role' => User::ROLE_MODERATOR, 'staff_sections' => ['moderation']])->save();
            Log::info('team: moderator added', ['user' => $user->id, 'by' => $request->user()->id]);
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Додано до команди — оберіть розділи.']);

        return back();
    }

    /** Нова роль команди: назва, колір значка й розділи адмінки. */
    public function storeRole(Request $request): RedirectResponse
    {
        $role = StaffRole::query()->create($this->roleData($request));
        Log::info('team: staff role created', ['role' => $role->id, 'name' => $role->name, 'sections' => $role->sections, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Роль «{$role->name}» створено."]);

        return back();
    }

    public function updateRole(Request $request, StaffRole $role): RedirectResponse
    {
        $role->update($this->roleData($request));
        Log::info('team: staff role updated', ['role' => $role->id, 'name' => $role->name, 'sections' => $role->sections, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Роль «{$role->name}» оновлено."]);

        return back();
    }

    /** Видалити роль: люди лишаються в команді з особистими розділами, лише без назви ролі. */
    public function destroyRole(Request $request, StaffRole $role): RedirectResponse
    {
        $role->delete();
        Log::info('team: staff role deleted', ['role' => $role->id, 'name' => $role->name, 'by' => $request->user()->id]);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Роль «{$role->name}» видалено."]);

        return back();
    }

    /**
     * @return array{name: string, color: string, sections: list<string>}
     */
    private function roleData(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:40'],
            'color' => ['required', Rule::in(StaffRole::COLORS)],
            'sections' => ['array'],
            'sections.*' => ['string', Rule::in(array_keys(StaffRoles::SECTIONS))],
        ]);

        return ['name' => trim((string) $data['name']), 'color' => (string) $data['color'], 'sections' => array_values(array_unique($data['sections'] ?? []))];
    }

    /** Воронка реєстрації: скільки з нових акаунтів пройшли кожен крок. */
    public function funnel(Request $request): Response
    {
        $days = in_array((int) $request->query('days'), [7, 30, 90], true) ? (int) $request->query('days') : 30;
        $since = now()->subDays($days);
        $cohort = fn () => User::query()->where('created_at', '>=', $since);
        $friend = fn ($q) => $q->whereExists(fn ($e) => $e->select(DB::raw(1))->from('friendships')->where('status', 'accepted')
            ->where(fn ($w) => $w->whereColumn('friendships.requester_id', 'users.id')->orWhereColumn('friendships.addressee_id', 'users.id')));
        $steps = [
            ['key' => 'registered', 'label' => 'Зареєструвалися', 'count' => $cohort()->count()],
            ['key' => 'verified', 'label' => 'Підтвердили пошту', 'count' => $cohort()->whereNotNull('email_verified_at')->count()],
            ['key' => 'onboarded', 'label' => 'Пройшли знайомство', 'count' => $cohort()->where('preferences->onboarded', true)->count()],
            ['key' => 'friend', 'label' => 'Додали друга', 'count' => $friend($cohort())->count()],
            ['key' => 'posted', 'label' => 'Опублікували запис', 'count' => $cohort()->whereExists(fn ($e) => $e->select(DB::raw(1))->from('posts')->whereColumn('posts.author_id', 'users.id')->where('is_draft', false))->count()],
            ['key' => 'returned', 'label' => 'Повернулися наступного дня', 'count' => $cohort()->whereNotNull('last_seen_at')->get(['id', 'created_at', 'last_seen_at'])
                ->filter(fn (User $u) => $u->last_seen_at !== null && $u->last_seen_at->greaterThan($u->created_at->copy()->addDay()))->count()],
        ];

        return Inertia::render('admin/funnel', ['days' => $days, 'steps' => $steps]);
    }

    /** Подивитися сайт очима людини: лише читання, без особистих повідомлень і налаштувань. */
    public function viewAs(Request $request, User $user): RedirectResponse
    {
        abort_if($user->isAdmin(), 422, 'Переглядати очима іншого адміністратора не можна.');
        $request->session()->put('view_as', $user->id);
        Log::info('team: view-as started', ['user' => $user->id, 'by' => $request->user()->id]);

        return redirect('/feed');
    }

    public function stopViewAs(Request $request): RedirectResponse
    {
        $id = $request->session()->pull('view_as');
        Log::info('team: view-as stopped', ['user' => $id, 'by' => $request->user()?->id]);

        return redirect('/admin/users');
    }
}
