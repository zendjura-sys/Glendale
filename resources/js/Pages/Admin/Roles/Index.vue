<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import TextInput from '@/Components/TextInput.vue';
import InputError from '@/Components/InputError.vue';
import { Head, useForm } from '@inertiajs/vue3';
import { ref } from 'vue';

const props = defineProps({
    roles: { type: Array, required: true },
    permissions: { type: Array, required: true },
});

/**
 * Людські назва + опис для кожного дозволу — сирий слаг типу
 * "addons.manage" нічого не каже адміну без ролі "admin", який саме розділ
 * і які саме дії він відкриває. Якщо з'явиться новий дозвіл (напр. від
 * нового аддона), якого тут немає — просто покажеться сирий слаг, нічого
 * не зламається.
 */
const PERMISSION_META = {
    'addons.manage': { label: 'Аддони', description: 'Встановлення, оновлення, увімкнення й вимкнення модулів/тем/плагінів' },
    'bonuses.manage': { label: 'Премії', description: 'Ставки розрахунку, інвестиційні тіри, історія виплат учасникам' },
    'broadcasts.manage': { label: 'Розсилки', description: 'Створення розсилок від адміністрації всім/за роллю/за посадою' },
    'events.manage': { label: 'Події родини', description: 'Створення, видалення подій і ручна розсилка нагадувань про них' },
    'goals.manage': { label: 'Цілі родини', description: 'Керування спільними цілями родини та їх прогресом' },
    'members.manage': { label: 'Кадри (HR)', description: 'Статус учасника, приватні HR-нотатки, розгляд заявок на відпустку' },
    'progression.manage': { label: 'Прогресія', description: 'Досвід, рівні, ранги, досягнення учасників' },
    'reports.manage': { label: 'Звіти', description: 'Перевірка й оцінка (S–G) звітів родини (бізвар, контракти, інвестиції)' },
    'roles.manage': { label: 'Ролі й права', description: 'Створення ролей і призначення їм дозволів — ця сторінка' },
    'settings.manage': { label: 'Налаштування сайту', description: 'Загальні налаштування CMS, включно з ключами AI/Telegram/Discord' },
    'users.manage': { label: 'Учасники', description: 'Акаунти учасників: ролі, посади, блокування' },
};
function permissionMeta(permission) {
    return PERMISSION_META[permission] ?? { label: permission, description: null };
}

const createForm = useForm({ name: '' });
function createRole() {
    createForm.post(route('admin.roles.store'), {
        preserveScroll: true,
        onSuccess: () => createForm.reset(),
    });
}

/**
 * Той самий підхід до діагностики, що на сторінці «Учасники»: без цього
 * будь-який провал тут падав тихим unhandled rejection у консоль, а UI
 * лишався в оптимістично зміненому стані, ніби все вдалося.
 */
function describeFailure(e, fallback) {
    const serverMessage = e.response?.data?.message;
    if (serverMessage) return serverMessage;
    if (!e.response) return `${fallback} (немає відповіді сервера — перевірте з'єднання)`;
    if (e.response.status === 403) return `${fallback} (немає прав)`;
    return `${fallback} (код ${e.response.status})`;
}

const savingRole = ref(null);
async function togglePermission(role, permission) {
    const has = role.permissions.includes(permission);
    const next = has ? role.permissions.filter((p) => p !== permission) : [...role.permissions, permission];
    role.permissions = next;

    savingRole.value = role.id;
    try {
        await window.axios.put(route('admin.roles.update', role.id), { permissions: next });
    } catch (e) {
        alert(describeFailure(e, 'Не вдалося оновити права'));
        role.permissions = has ? [...next, permission] : next.filter((p) => p !== permission);
    } finally {
        savingRole.value = null;
    }
}

async function destroyRole(role) {
    if (!confirm(`Видалити роль «${role.name}»?`)) return;
    try {
        await window.axios.delete(route('admin.roles.destroy', role.id));
        window.location.reload();
    } catch (e) {
        alert(describeFailure(e, 'Не вдалося видалити роль'));
    }
}
</script>

<template>
    <Head title="Права доступу" />

    <AdminLayout title="Права доступу">
        <form v-reveal class="glass-panel mb-8 flex flex-wrap items-end gap-4 p-6" @submit.prevent="createRole">
            <div class="min-w-[220px]">
                <label class="mb-2 block text-xs font-medium uppercase tracking-widest text-white/40">Нова роль</label>
                <TextInput v-model="createForm.name" placeholder="напр. moderator" />
                <InputError :message="createForm.errors.name" />
            </div>
            <PrimaryButton :disabled="createForm.processing">Створити роль</PrimaryButton>
        </form>

        <div class="space-y-6">
            <div v-for="role in roles" :key="role.id" v-reveal v-glow class="glass-panel p-6">
                <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h3 class="font-display text-xl text-white">{{ role.name }}</h3>
                        <p class="text-xs text-white/40">{{ role.users_count }} учасник(ів) з цією роллю</p>
                    </div>
                    <button
                        v-if="role.name !== 'admin'"
                        class="shrink-0 rounded-xl border border-ember-500/25 px-4 py-1.5 text-xs font-medium text-ember-500/80 transition-colors hover:bg-ember-600/10"
                        @click="destroyRole(role)"
                    >
                        Видалити
                    </button>
                </div>

                <div class="grid gap-2 sm:grid-cols-2" :class="savingRole === role.id && 'opacity-60'">
                    <label
                        v-for="permission in permissions"
                        :key="permission"
                        class="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors"
                        :class="role.permissions.includes(permission)
                            ? 'border-gold-400/50 bg-gold-400/10'
                            : 'border-white/10 hover:border-white/25'"
                    >
                        <input type="checkbox" class="hidden" :checked="role.permissions.includes(permission)" @change="togglePermission(role, permission)" />
                        <span
                            class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]"
                            :class="role.permissions.includes(permission) ? 'border-gold-300 bg-gold-400 text-obsidian-950' : 'border-white/20 text-transparent'"
                        >✓</span>
                        <span class="min-w-0">
                            <span class="block text-sm font-medium" :class="role.permissions.includes(permission) ? 'text-gold-200' : 'text-white/70'">
                                {{ permissionMeta(permission).label }}
                            </span>
                            <span class="block text-[11px] font-mono text-white/25">{{ permission }}</span>
                            <span v-if="permissionMeta(permission).description" class="mt-0.5 block text-xs leading-snug text-white/40">
                                {{ permissionMeta(permission).description }}
                            </span>
                        </span>
                    </label>
                </div>
            </div>
        </div>
    </AdminLayout>
</template>
