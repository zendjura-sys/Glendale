<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import InputLabel from '@/Components/InputLabel.vue';
import TextInput from '@/Components/TextInput.vue';
import InputError from '@/Components/InputError.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import { Head, router, useForm, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

const props = defineProps({
    families: { type: Array, default: () => [] },
    players: { type: Array, default: () => [] },
    reasons: { type: Object, default: () => ({}) },
});

const status = computed(() => usePage().props.flash?.status);

const TABS = [
    { key: 'families', label: 'Родини' },
    { key: 'players', label: 'Гравці' },
];
const activeTab = ref('families');

/* ---------- родини ---------- */
const familyForm = useForm({ family_name: '', reason: '', duration_amount: 30, duration_unit: 'days' });

function submitFamily() {
    familyForm.transform((data) => ({
        family_name: data.family_name,
        reason: data.reason,
        duration_hours: Number(data.duration_amount) * (data.duration_unit === 'days' ? 24 : 1),
    })).post(route('admin.union.blacklist.families.store'), {
        preserveScroll: true,
        onSuccess: () => familyForm.reset('family_name', 'reason'),
    });
}

function destroyFamily(f) {
    if (!confirm(`Прибрати родину «${f.family_name}» з ЧСС?`)) return;
    router.delete(route('admin.union.blacklist.families.destroy', f.id), { preserveScroll: true });
}

function isActive(f) {
    return new Date(f.expires_at).getTime() > Date.now();
}

/* ---------- гравці ---------- */
function destroyPlayer(p) {
    if (!confirm(`Прибрати гравця «${p.first_name} ${p.last_name ?? ''}» з ЧС?`)) return;
    router.delete(route('admin.union.blacklist.players.destroy', p.id), { preserveScroll: true });
}

function reasonLabel(key) {
    return props.reasons[key]?.label ?? key;
}

function fmtDate(iso) {
    return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
    <Head title="Чорний список союзу" />

    <AdminLayout title="Чорний список союзу">
        <p
            v-if="status"
            class="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
        >
            {{ status }}
        </p>

        <div class="mb-6 flex gap-2 border-b border-white/10">
            <button
                v-for="tab in TABS"
                :key="tab.key"
                type="button"
                class="px-4 py-2.5 text-sm transition-colors"
                :class="activeTab === tab.key ? 'border-b-2 border-gold-400 text-gold-200' : 'text-white/40 hover:text-white'"
                @click="activeTab = tab.key"
            >
                {{ tab.label }}
            </button>
        </div>

        <!-- ================= РОДИНИ (ЧСС) ================= -->
        <div v-if="activeTab === 'families'" class="max-w-3xl space-y-8">
            <div v-glow class="glass-panel p-6 sm:p-8">
                <h2 class="font-display mb-1 text-lg text-white">Додати родину в ЧСС</h2>
                <p class="mb-4 text-sm text-white/40">Родина з активним записом не зможе зареєструватись на union.gamecon.online.</p>
                <form class="space-y-4" @submit.prevent="submitFamily">
                    <div>
                        <InputLabel for="family_name" value="Назва родини (повністю)" />
                        <TextInput id="family_name" v-model="familyForm.family_name" type="text" class="w-full" />
                        <InputError :message="familyForm.errors.family_name" />
                    </div>
                    <div>
                        <InputLabel for="family_reason" value="Причина" />
                        <textarea
                            id="family_reason"
                            v-model="familyForm.reason"
                            rows="3"
                            class="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:ring-0"
                        ></textarea>
                        <InputError :message="familyForm.errors.reason" />
                    </div>
                    <div class="flex items-end gap-3">
                        <div class="max-w-[140px]">
                            <InputLabel for="duration_amount" value="Термін" />
                            <TextInput id="duration_amount" v-model="familyForm.duration_amount" type="number" min="1" class="w-full" />
                        </div>
                        <select
                            v-model="familyForm.duration_unit"
                            class="h-[42px] rounded-xl border border-white/10 bg-obsidian-900/60 px-3 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                        >
                            <option value="hours">годин</option>
                            <option value="days">днів</option>
                        </select>
                        <InputError :message="familyForm.errors.duration_hours" />
                    </div>
                    <p class="text-xs text-white/30">Від 1 години до 9999 днів.</p>
                    <PrimaryButton :disabled="familyForm.processing">Додати в ЧСС</PrimaryButton>
                </form>
            </div>

            <div v-glow class="glass-panel overflow-hidden">
                <h2 class="p-6 pb-4 font-display text-lg text-white">Записи ЧСС</h2>
                <div v-for="f in families" :key="f.id" class="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 px-6 py-4 last:border-0">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <p class="font-medium text-white">{{ f.family_name }}</p>
                            <span
                                class="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest"
                                :class="isActive(f) ? 'border-ember-500/40 bg-ember-500/10 text-ember-400' : 'border-white/15 bg-white/5 text-white/30'"
                            >
                                {{ isActive(f) ? 'активний' : 'спливлий' }}
                            </span>
                        </div>
                        <p class="mt-1 text-sm text-white/50">{{ f.reason }}</p>
                        <p class="mt-1 text-xs text-white/30">До {{ fmtDate(f.expires_at) }} · додав {{ f.added_by?.name ?? '—' }}</p>
                    </div>
                    <button class="shrink-0 text-xs text-ember-500/70 hover:text-ember-500" @click="destroyFamily(f)">Прибрати</button>
                </div>
                <div v-if="families.length === 0" class="px-6 py-12 text-center text-white/30">ЧСС порожній</div>
            </div>
        </div>

        <!-- ================= ГРАВЦІ (ЧС) ================= -->
        <div v-if="activeTab === 'players'" class="max-w-3xl">
            <p class="mb-4 text-sm text-white/40">
                Гравців додають самі союзники в кабінеті (розділ «Чорний список союзу»). Тут — лише перегляд і видалення записів, якими зловжили.
            </p>
            <div v-glow class="glass-panel overflow-hidden">
                <div v-for="p in players" :key="p.id" class="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 px-6 py-4 last:border-0">
                    <div class="min-w-0">
                        <p class="font-medium text-white">{{ p.first_name }} {{ p.last_name }}</p>
                        <p v-if="p.family_name" class="text-sm text-white/50">Родина: {{ p.family_name }}</p>
                        <div class="mt-2 flex flex-wrap gap-1.5">
                            <span v-for="r in p.reasons" :key="r" class="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-white/60">
                                {{ reasonLabel(r) }}
                            </span>
                        </div>
                        <p v-if="p.description" class="mt-2 whitespace-pre-line text-sm text-white/50">{{ p.description }}</p>
                        <p class="mt-1 text-xs text-white/30">Додав {{ p.added_by?.name ?? '—' }} · {{ fmtDate(p.created_at) }}</p>
                    </div>
                    <button class="shrink-0 text-xs text-ember-500/70 hover:text-ember-500" @click="destroyPlayer(p)">Прибрати</button>
                </div>
                <div v-if="players.length === 0" class="px-6 py-12 text-center text-white/30">ЧС порожній</div>
            </div>
        </div>
    </AdminLayout>
</template>
