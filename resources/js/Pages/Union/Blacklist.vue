<script setup>
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import InputLabel from '@/Components/InputLabel.vue';
import TextInput from '@/Components/TextInput.vue';
import InputError from '@/Components/InputError.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import { Head, useForm, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

const props = defineProps({
    players: { type: Array, default: () => [] },
    reasons: { type: Object, default: () => ({}) },
});

const status = computed(() => usePage().props.flash?.status);

const form = useForm({
    first_name: '',
    last_name: '',
    family_name: '',
    reasons: [],
    description: '',
});

function toggleReason(key) {
    const idx = form.reasons.indexOf(key);
    if (idx === -1) {
        form.reasons.push(key);
    } else {
        form.reasons.splice(idx, 1);
    }
}

/* ---------- автодоповнення родини ---------- */
const familyMatches = ref([]);
const familyBlacklistedHint = ref(false);
let familySearchTimer = null;

function onFamilyInput() {
    clearTimeout(familySearchTimer);
    familyBlacklistedHint.value = false;

    if (form.family_name.trim().length < 2) {
        familyMatches.value = [];
        return;
    }
    familySearchTimer = setTimeout(async () => {
        const { data } = await window.axios.get(route('union.families.search'), { params: { q: form.family_name } });
        familyMatches.value = data.data.families;
    }, 300);
}

function pickFamily(family) {
    form.family_name = family.name;
    familyBlacklistedHint.value = family.blacklisted;
    familyMatches.value = [];
}

function submit() {
    form.post(route('union.blacklist.players.store'), {
        preserveScroll: true,
        onSuccess: () => {
            form.reset();
            familyMatches.value = [];
            familyBlacklistedHint.value = false;
        },
    });
}

function reasonLabel(key) {
    return props.reasons[key]?.label ?? key;
}

function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<template>
    <Head title="Чорний список союзу" />

    <AuthenticatedLayout>
        <template #header>
            <h2 class="font-display text-2xl font-light text-white">Чорний список союзу</h2>
        </template>

        <div class="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
            <p
                v-if="status"
                class="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
            >
                {{ status }}
            </p>

            <p class="text-white/50">
                Тут кожен зареєстрований союзник може попередити інших про гравця, з яким не варто мати справу. Записи бачать усі союзники; адміністрація Monsory може прибрати запис, яким зловжили.
            </p>

            <!-- ================= ФОРМА ================= -->
            <div v-glow class="glass-panel p-6 sm:p-8">
                <h3 class="font-display mb-4 text-lg text-white">Додати гравця</h3>
                <form class="space-y-5" @submit.prevent="submit">
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <InputLabel for="bl_first_name" value="Ім'я" />
                            <TextInput id="bl_first_name" v-model="form.first_name" type="text" required />
                            <InputError :message="form.errors.first_name" />
                        </div>
                        <div>
                            <InputLabel for="bl_last_name" value="Прізвище (необов'язково)" />
                            <TextInput id="bl_last_name" v-model="form.last_name" type="text" />
                            <InputError :message="form.errors.last_name" />
                        </div>
                    </div>

                    <div class="relative">
                        <InputLabel for="bl_family" value="Родина гравця (необов'язково)" />
                        <TextInput id="bl_family" v-model="form.family_name" type="text" @input="onFamilyInput" />
                        <div v-if="familyMatches.length" class="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-obsidian-900 shadow-xl">
                            <button
                                v-for="f in familyMatches"
                                :key="f.name"
                                type="button"
                                class="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-white hover:bg-white/5"
                                @click="pickFamily(f)"
                            >
                                <span>{{ f.name }}</span>
                                <span v-if="f.blacklisted" class="text-[10px] uppercase tracking-widest text-ember-400">у ЧСС</span>
                            </button>
                        </div>
                        <p v-if="familyBlacklistedHint" class="mt-1 text-xs text-ember-400/80">Ця родина вже в чорному списку союзу.</p>
                        <InputError :message="form.errors.family_name" />
                    </div>

                    <div>
                        <InputLabel value="Причина (можна декілька)" />
                        <div class="mt-2 grid gap-2 sm:grid-cols-2">
                            <label
                                v-for="(info, key) in reasons"
                                :key="key"
                                class="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm"
                                :class="form.reasons.includes(key) ? 'border-gold-400/40 bg-gold-400/[0.06]' : 'hover:border-white/20'"
                            >
                                <input type="checkbox" class="mt-0.5" :checked="form.reasons.includes(key)" @change="toggleReason(key)" />
                                <span>
                                    <span class="block text-white">{{ info.label }}</span>
                                    <span class="block text-xs text-white/40">{{ info.description }}</span>
                                </span>
                            </label>
                        </div>
                        <InputError :message="form.errors.reasons" />
                    </div>

                    <div>
                        <InputLabel for="bl_description" value="Опис (необов'язково)" />
                        <textarea
                            id="bl_description"
                            v-model="form.description"
                            rows="4"
                            class="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:ring-0"
                        ></textarea>
                        <InputError :message="form.errors.description" />
                    </div>

                    <PrimaryButton :disabled="form.processing">Додати до чорного списку</PrimaryButton>
                </form>
            </div>

            <!-- ================= СПИСОК ================= -->
            <div v-glow class="glass-panel overflow-hidden">
                <h3 class="p-6 pb-4 font-display text-lg text-white">Чорний список</h3>
                <div v-for="p in players" :key="p.id" class="border-b border-white/5 px-6 py-4 last:border-0">
                    <p class="font-medium text-white">{{ p.first_name }} {{ p.last_name }}</p>
                    <p v-if="p.family_name" class="text-sm text-white/50">Родина: {{ p.family_name }}</p>
                    <div class="mt-2 flex flex-wrap gap-1.5">
                        <span v-for="r in p.reasons" :key="r" class="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-white/60">
                            {{ reasonLabel(r) }}
                        </span>
                    </div>
                    <p v-if="p.description" class="mt-2 whitespace-pre-line text-sm text-white/50">{{ p.description }}</p>
                    <p class="mt-1 text-xs text-white/30">Додав {{ p.added_by?.name ?? '—' }} · {{ fmtDate(p.created_at) }}</p>
                </div>
                <div v-if="players.length === 0" class="px-6 py-12 text-center text-white/30">Список поки порожній</div>
            </div>
        </div>
    </AuthenticatedLayout>
</template>
