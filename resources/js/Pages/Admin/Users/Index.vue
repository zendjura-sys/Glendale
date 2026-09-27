<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import Modal from '@/Components/Modal.vue';
import { Head, Link, router } from '@inertiajs/vue3';
import { ref } from 'vue';

const props = defineProps({
    users: { type: Object, required: true },
    roles: { type: Array, required: true },
    positions: { type: Array, required: true },
    search: { type: String, default: '' },
    roleFilter: { type: String, default: '' },
    positionFilter: { type: String, default: '' },
    recentAudit: { type: Array, default: () => [] },
});

const AUDIT_LABELS = {
    roles_updated: 'змінив ролі',
    position_updated: 'змінив посаду',
    profile_updated: 'відредагував профіль',
    password_reset: 'скинув пароль',
    account_deleted: 'видалив акаунт',
};

function fmtDate(iso) {
    return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const q = ref(props.search);
const role = ref(props.roleFilter);
const position = ref(props.positionFilter);

function search() {
    router.get(route('admin.users.index'), { q: q.value, role: role.value, position: position.value }, { preserveState: true, replace: true });
}

/**
 * Раньше провал этих запросов показывал один и тот же безликий текст,
 * какой бы ни была реальная причина — 419 (сесія застаріла), 403 (немає
 * прав), 422 (валідація) чи 500 вело до однакового "Не вдалося оновити".
 * Тепер спершу шукаємо повідомлення від сервера, а якщо його немає —
 * показуємо код статусу замість тиші: цього досить, щоб наступного разу
 * зрозуміти причину з одного скріншота, а не гадати.
 */
function describeFailure(e, fieldErrorsKey, fallback) {
    const fieldError = e.response?.data?.errors?.[fieldErrorsKey]?.[0];
    if (fieldError) return fieldError;

    const serverMessage = e.response?.data?.message;
    if (serverMessage) return serverMessage;

    if (!e.response) return `${fallback} (немає відповіді сервера — перевірте з'єднання)`;

    if (e.response.status === 419) return `${fallback} (сесія застаріла — оновіть сторінку)`;
    if (e.response.status === 403) return `${fallback} (немає прав)`;

    return `${fallback} (код ${e.response.status})`;
}

const savingUser = ref(null);
async function toggleRole(user, role) {
    const has = user.roles.includes(role);
    const next = has ? user.roles.filter((r) => r !== role) : [...user.roles, role];
    user.roles = next;

    savingUser.value = user.id;
    try {
        await window.axios.put(route('admin.users.roles', user.id), { roles: next });
        router.reload({ only: ['recentAudit'] });
    } catch (e) {
        alert(describeFailure(e, 'roles', 'Не вдалося оновити ролі'));
        user.roles = has ? [...next, role] : next.filter((r) => r !== role);
    } finally {
        savingUser.value = null;
    }
}

// Посада — окремо від ролей доступу: одна ставить доступ до адмінки,
// друга показує статус у родині на сайті й у боті. Зберігається ключем
// (не індексом) — ключ переживає перестановку й видалення посад у
// Дизайн → Розділи, індекс ні.
async function changePosition(user, event) {
    const raw = event.target.value;
    const prev = user.position_key;
    const next = raw === '' ? null : raw;
    user.position_key = next;

    savingUser.value = user.id;
    try {
        await window.axios.put(route('admin.users.position', user.id), { position_key: next });
        router.reload({ only: ['recentAudit'] });
    } catch (e) {
        alert(describeFailure(e, 'position_key', 'Не вдалося оновити посаду'));
        user.position_key = prev;
    } finally {
        savingUser.value = null;
    }
}

/* ---------- редагування учасника (шестерня) ---------- */
const editingUser = ref(null);
const editForm = ref({ first_name: '', last_name: '', email: '' });
const editSaving = ref(false);
const editError = ref(null);
const resetPasswordResult = ref(null);
const resetPasswordBusy = ref(false);
const deleteBusy = ref(false);

function openEdit(user) {
    editingUser.value = user;
    editForm.value = { first_name: user.first_name || '', last_name: user.last_name || '', email: user.email };
    editError.value = null;
    resetPasswordResult.value = null;
}

function closeEdit() {
    editingUser.value = null;
}

async function saveEdit() {
    editSaving.value = true;
    editError.value = null;
    try {
        const { data } = await window.axios.put(route('admin.users.update', editingUser.value.id), editForm.value);
        const target = props.users.data.find((u) => u.id === editingUser.value.id);
        if (target) Object.assign(target, data.user);
        router.reload({ only: ['recentAudit'] });
        closeEdit();
    } catch (e) {
        editError.value = describeFailure(e, 'email', 'Не вдалося зберегти зміни');
    } finally {
        editSaving.value = false;
    }
}

async function resetPassword() {
    if (!confirm(`Згенерувати новий пароль для «${editingUser.value.name}»? Старий пароль одразу перестане працювати.`)) return;
    resetPasswordBusy.value = true;
    try {
        const { data } = await window.axios.post(route('admin.users.reset-password', editingUser.value.id));
        resetPasswordResult.value = data.data.password;
        router.reload({ only: ['recentAudit'] });
    } catch (e) {
        alert(describeFailure(e, 'password', 'Не вдалося скинути пароль'));
    } finally {
        resetPasswordBusy.value = false;
    }
}

async function deleteAccount() {
    if (!confirm(`Видалити акаунт «${editingUser.value.name}» повністю? Цю дію не можна скасувати.`)) return;
    deleteBusy.value = true;
    try {
        await window.axios.delete(route('admin.users.destroy', editingUser.value.id));
        router.reload({ only: ['users', 'recentAudit'] });
        closeEdit();
    } catch (e) {
        alert(e.response?.data?.message || 'Не вдалося видалити акаунт');
    } finally {
        deleteBusy.value = false;
    }
}
</script>

<template>
    <Head title="Учасники" />

    <AdminLayout title="Учасники">
        <div class="mb-6 flex flex-wrap items-end gap-3">
            <div class="max-w-sm flex-1 basis-64">
                <label class="mb-1 block text-[10px] uppercase tracking-widest text-white/40">Пошук</label>
                <input
                    v-model="q"
                    type="search"
                    placeholder="Пошук за іменем або email…"
                    class="w-full rounded-lg border border-white/10 bg-obsidian-900/60 px-3 py-2 text-white placeholder:text-white/30 focus:border-gold-400/50 focus:outline-none focus:ring-1 focus:ring-gold-400/40"
                    @keyup.enter="search"
                />
            </div>
            <div>
                <label class="mb-1 block text-[10px] uppercase tracking-widest text-white/40">Роль</label>
                <select v-model="role" class="rounded-lg border border-white/10 bg-obsidian-900/60 px-3 py-2 text-sm text-white focus:border-gold-400/50 focus:outline-none" @change="search">
                    <option value="">Усі ролі</option>
                    <option value="__none__">Без ролі</option>
                    <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
                </select>
            </div>
            <div>
                <label class="mb-1 block text-[10px] uppercase tracking-widest text-white/40">Посада</label>
                <select v-model="position" class="rounded-lg border border-white/10 bg-obsidian-900/60 px-3 py-2 text-sm text-white focus:border-gold-400/50 focus:outline-none" @change="search">
                    <option value="">Усі посади</option>
                    <option value="__none__">Не призначено</option>
                    <option v-for="pos in positions" :key="pos.key" :value="pos.key">{{ pos.title }}</option>
                </select>
            </div>
            <button type="button" class="rounded-full border border-gold-400/40 px-4 py-2 text-xs font-medium tracking-widest text-gold-200 hover:border-gold-300" @click="search">
                Застосувати
            </button>
        </div>

        <div v-reveal class="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div
                v-for="user in users.data"
                :key="user.id"
                class="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-6 py-4 last:border-0"
                :class="savingUser === user.id && 'opacity-60'"
            >
                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        class="shrink-0 rounded-full border border-white/15 p-2 text-white/50 transition-colors hover:border-gold-400/40 hover:text-gold-300"
                        title="Редагувати учасника"
                        @click="openEdit(user)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                    <div>
                        <p class="font-medium text-white">{{ user.name }}</p>
                        <p class="text-xs text-white/40">{{ user.email }}</p>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-4">
                    <div class="flex flex-col gap-1">
                        <span class="text-[10px] uppercase tracking-widest text-white/30">Посада</span>
                        <select
                            :value="user.position_key ?? ''"
                            class="rounded-lg border border-white/10 bg-obsidian-900/60 px-2 py-1.5 text-xs text-white focus:border-gold-400/50 focus:outline-none focus:ring-1 focus:ring-gold-400/40"
                            @change="changePosition(user, $event)"
                        >
                            <option value="">— не призначено —</option>
                            <option v-for="(pos, idx) in positions" :key="pos.key" :value="pos.key">
                                {{ String(idx + 1).padStart(2, '0') }}. {{ pos.title }}
                            </option>
                        </select>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <label
                            v-for="role in roles"
                            :key="role"
                            class="cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium tracking-wide transition-colors"
                            :class="user.roles.includes(role)
                                ? 'border-gold-400/50 bg-gold-400/10 text-gold-200'
                                : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white'"
                        >
                            <input type="checkbox" class="hidden" :checked="user.roles.includes(role)" @change="toggleRole(user, role)" />
                            {{ role }}
                        </label>
                    </div>
                </div>
            </div>
            <div v-if="users.data.length === 0" class="px-6 py-12 text-center text-white/30">
                Нікого не знайдено
            </div>
        </div>

        <div v-if="users.links?.length > 3" class="mt-6 flex flex-wrap gap-2">
            <Link
                v-for="link in users.links"
                :key="link.label"
                :href="link.url || ''"
                v-html="link.label"
                class="rounded-full border px-3 py-1.5 text-xs"
                :class="[
                    link.active ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/10 text-white/40 hover:text-white',
                    !link.url && 'pointer-events-none opacity-30',
                ]"
            />
        </div>

        <div class="mt-16">
            <h2 class="font-display mb-4 text-xl text-white">Журнал дій</h2>
            <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                <div
                    v-for="log in recentAudit"
                    :key="log.id"
                    class="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-5 py-3 text-sm last:border-0"
                >
                    <span class="text-white/60">
                        <span class="text-gold-300/80">{{ log.actor?.name || 'система' }}</span>
                        — {{ AUDIT_LABELS[log.action] || log.action }}
                        <span v-if="log.target || log.meta?.name || log.meta?.email" class="text-white/40">
                            ({{ log.target?.name || log.meta?.name || log.meta?.email }})
                        </span>
                    </span>
                    <span class="shrink-0 whitespace-nowrap text-xs text-white/30">{{ fmtDate(log.created_at) }}</span>
                </div>
                <div v-if="recentAudit.length === 0" class="px-5 py-6 text-center text-sm text-white/30">
                    Поки що пусто
                </div>
            </div>
        </div>

        <Modal :show="editingUser !== null" @close="closeEdit">
            <div v-if="editingUser" class="p-6">
                <h3 class="font-display mb-5 text-lg text-white">Редагування учасника</h3>

                <div class="space-y-4">
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Ім'я</label>
                            <input v-model="editForm.first_name" type="text" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                        </div>
                        <div>
                            <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Прізвище</label>
                            <input v-model="editForm.last_name" type="text" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                        </div>
                    </div>
                    <div>
                        <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Email</label>
                        <input v-model="editForm.email" type="email" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                    </div>
                    <p v-if="editError" class="text-sm text-ember-500">{{ editError }}</p>

                    <div class="flex flex-wrap gap-3 pt-2">
                        <button
                            type="button"
                            :disabled="editSaving"
                            class="rounded-full border border-gold-400/40 px-5 py-2 text-sm font-medium tracking-wide text-gold-200 transition-colors hover:border-gold-300 disabled:opacity-40"
                            @click="saveEdit"
                        >
                            {{ editSaving ? 'Зберігаю…' : 'Зберегти' }}
                        </button>
                        <button
                            type="button"
                            class="rounded-full border border-white/15 px-5 py-2 text-sm text-white/60 hover:border-white/30"
                            @click="closeEdit"
                        >
                            Скасувати
                        </button>
                    </div>
                </div>

                <div class="mt-6 border-t border-white/10 pt-5">
                    <p v-if="resetPasswordResult" class="mb-3 rounded-lg border border-gold-400/30 bg-gold-400/5 px-3 py-2 text-sm text-gold-200">
                        Новий пароль (передайте учаснику, більше показано не буде):
                        <span class="block select-all font-mono text-base">{{ resetPasswordResult }}</span>
                    </p>
                    <button
                        type="button"
                        :disabled="resetPasswordBusy"
                        class="rounded-full border border-white/15 px-5 py-2 text-sm text-white/60 transition-colors hover:border-white/30 disabled:opacity-40"
                        @click="resetPassword"
                    >
                        {{ resetPasswordBusy ? 'Генерую…' : 'Скинути пароль' }}
                    </button>
                </div>

                <div class="mt-6 border-t border-ember-500/20 pt-5">
                    <p class="mb-3 text-xs text-white/30">Незворотна дія — акаунт і всі пов'язані дані буде видалено.</p>
                    <button
                        type="button"
                        :disabled="deleteBusy"
                        class="rounded-full border border-ember-500/30 px-5 py-2 text-sm font-medium text-ember-500/80 transition-colors hover:bg-ember-600/10 disabled:opacity-40"
                        @click="deleteAccount"
                    >
                        {{ deleteBusy ? 'Видаляю…' : 'Видалити акаунт' }}
                    </button>
                </div>
            </div>
        </Modal>
    </AdminLayout>
</template>
