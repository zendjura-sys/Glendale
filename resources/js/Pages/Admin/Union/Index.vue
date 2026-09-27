<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import InputLabel from '@/Components/InputLabel.vue';
import TextInput from '@/Components/TextInput.vue';
import InputError from '@/Components/InputError.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import { Head, useForm, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

const props = defineProps({
    domain: { type: String, default: null },
    content: { type: Object, required: true },
    members: { type: Array, default: () => [] },
    unionRoles: { type: Object, default: () => ({}) },
});

const status = computed(() => usePage().props.flash?.status);

const TABS = [
    { key: 'content', label: 'Контент' },
    { key: 'members', label: 'Союзники' },
];
const activeTab = ref('content');

const form = useForm({
    title: props.content.title,
    tagline: props.content.tagline ?? '',
    about: [...props.content.about],
    rules: [...props.content.rules],
    terms: [...props.content.terms],
});

function save() {
    form.put(route('admin.union.content'), { preserveScroll: true });
}

function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<template>
    <Head title="Союз" />

    <AdminLayout title="Союз">
        <p
            v-if="status"
            class="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
        >
            {{ status }}
        </p>

        <p v-if="domain" class="mb-6 text-sm text-white/40">
            Публічний вхід: <span class="text-gold-300">{{ domain }}</span> — той самий логін, база й адмінка, що й на основному сайті.
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

        <!-- ================= КОНТЕНТ ================= -->
        <form v-if="activeTab === 'content'" class="glass-panel max-w-2xl space-y-8 p-6 sm:p-8" @submit.prevent="save">
            <div class="space-y-5">
                <h2 class="font-display text-lg text-white">Головна сторінка</h2>

                <div>
                    <InputLabel for="union_title" value="Заголовок" />
                    <TextInput id="union_title" v-model="form.title" type="text" />
                    <InputError :message="form.errors.title" />
                </div>

                <div>
                    <InputLabel for="union_tagline" value="Слоган (необов'язково)" />
                    <TextInput id="union_tagline" v-model="form.tagline" type="text" />
                    <InputError :message="form.errors.tagline" />
                </div>

                <div>
                    <InputLabel value="Про союз" />
                    <div class="mt-2 space-y-3">
                        <div v-for="(_, i) in form.about" :key="i" class="flex items-start gap-3">
                            <textarea
                                v-model="form.about[i]"
                                rows="3"
                                class="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:ring-0"
                            ></textarea>
                            <button type="button" class="mt-2 text-xs text-white/30 hover:text-ember-500" @click="form.about.splice(i, 1)">✕</button>
                        </div>
                    </div>
                    <button type="button" class="glass-pill mt-3 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/70 hover:text-white" @click="form.about.push('')">
                        + Додати абзац
                    </button>
                </div>
            </div>

            <div class="space-y-5 border-t border-white/10 pt-6">
                <h2 class="font-display text-lg text-white">Правила союзу</h2>
                <div class="space-y-3">
                    <div v-for="(_, i) in form.rules" :key="i" class="flex items-start gap-3">
                        <textarea
                            v-model="form.rules[i]"
                            rows="2"
                            class="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:ring-0"
                        ></textarea>
                        <button type="button" class="mt-2 text-xs text-white/30 hover:text-ember-500" @click="form.rules.splice(i, 1)">✕</button>
                    </div>
                </div>
                <button type="button" class="glass-pill px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/70 hover:text-white" @click="form.rules.push('')">
                    + Додати правило
                </button>
            </div>

            <div class="space-y-5 border-t border-white/10 pt-6">
                <h2 class="font-display text-lg text-white">Умови участі</h2>
                <div class="space-y-3">
                    <div v-for="(_, i) in form.terms" :key="i" class="flex items-start gap-3">
                        <textarea
                            v-model="form.terms[i]"
                            rows="2"
                            class="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:ring-0"
                        ></textarea>
                        <button type="button" class="mt-2 text-xs text-white/30 hover:text-ember-500" @click="form.terms.splice(i, 1)">✕</button>
                    </div>
                </div>
                <button type="button" class="glass-pill px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/70 hover:text-white" @click="form.terms.push('')">
                    + Додати умову
                </button>
            </div>

            <div class="flex items-center gap-4 border-t border-white/10 pt-6">
                <PrimaryButton :disabled="form.processing">Зберегти</PrimaryButton>
                <p v-if="form.recentlySuccessful" class="text-sm text-emerald-300">Збережено.</p>
            </div>
        </form>

        <!-- ================= СОЮЗНИКИ ================= -->
        <div v-if="activeTab === 'members'" class="glass-panel overflow-hidden">
            <h2 class="p-6 pb-4 font-display text-lg text-white">Зареєстровані союзники</h2>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead>
                        <tr class="border-b border-white/10 text-xs uppercase tracking-widest text-white/40">
                            <th class="px-6 py-3 font-normal">Ім'я</th>
                            <th class="px-6 py-3 font-normal">Родина</th>
                            <th class="px-6 py-3 font-normal">Позиція</th>
                            <th class="px-6 py-3 font-normal">Пошта</th>
                            <th class="px-6 py-3 font-normal">У союзі з</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="member in members" :key="member.id" class="border-b border-white/5 last:border-0">
                            <td class="px-6 py-3 text-white">{{ member.name }}</td>
                            <td class="px-6 py-3 text-white/70">{{ member.union_family_name }}</td>
                            <td class="px-6 py-3 text-white/50">{{ unionRoles[member.union_role] ?? member.union_role }}</td>
                            <td class="px-6 py-3 text-white/40">{{ member.email }}</td>
                            <td class="px-6 py-3 text-white/40">{{ fmtDate(member.created_at) }}</td>
                        </tr>
                    </tbody>
                </table>
                <div v-if="members.length === 0" class="px-6 py-12 text-center text-white/30">Ще ніхто не зареєструвався</div>
            </div>
        </div>
    </AdminLayout>
</template>
