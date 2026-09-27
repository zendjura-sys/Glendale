<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { Head, router, useForm, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

// Профіль родини: опис, керівництво, посади, критерії підвищення, правила
// і посади учасників — лідер і заступники керують СВОЄЮ родиною.
const props = defineProps({
    family: { type: Object, required: true },
    content: { type: Object, required: true },
    rules: { type: String, default: '' },
    members: { type: Array, default: () => [] },
});

const flash = computed(() => usePage().props.flash?.status);
const tabs = [
    { key: 'about', label: 'Про родину' },
    { key: 'positions', label: 'Посади' },
    { key: 'members', label: 'Склад' },
    { key: 'rules', label: 'Правила' },
];
const tab = ref('about');

const form = useForm({
    about: props.content.about.length ? [...props.content.about] : [''],
    leadership: props.content.leadership.map((r) => ({ ...r })),
    positions: props.content.positions.map((r) => ({ ...r })),
    promotionCriteria: [...props.content.promotionCriteria],
});
const save = () => form.put(route('admin.family-profile.content'), { preserveScroll: true });
const move = (list, i, d) => {
    const rows = form[list];
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
};

const rulesForm = useForm({ rules: props.rules });
const saveRules = () => rulesForm.put(route('admin.family-profile.rules'), { preserveScroll: true });

const ROLE = { leader: 'Лідер', deputy: 'Заступник', member: 'Учасник' };
function setPosition(member, key) {
    router.put(route('admin.family-profile.position', member.id), { positionKey: key || null }, { preserveScroll: true });
}

const field = 'w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold-400/40 focus:ring-0';
const small = 'text-xs text-white/40 hover:text-white';
</script>

<template>
    <Head title="Профіль родини" />
    <AdminLayout :title="`Профіль родини ${family.tag ? '[' + family.tag + '] ' : ''}${family.name}`">
        <p class="-mt-3 mb-5 text-sm text-white/45">{{ family.project }}{{ family.server ? ' · ' + family.server : '' }}</p>
        <p v-if="flash" class="mb-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{{ flash }}</p>

        <div class="mb-6 flex flex-wrap gap-2">
            <button
                v-for="t in tabs"
                :key="t.key"
                class="rounded-full border px-4 py-1.5 text-xs"
                :class="tab === t.key ? 'border-gold-400/60 bg-gold-400/15 text-gold-100' : 'border-white/10 text-white/60 hover:bg-white/5'"
                @click="tab = t.key"
            >
                {{ t.label }}
            </button>
        </div>

        <!-- Про родину + керівництво -->
        <div v-if="tab === 'about'" class="space-y-6">
            <section class="glass-panel p-6">
                <h2 class="text-lg font-semibold text-white">Про родину</h2>
                <p class="mb-4 text-xs text-white/45">Абзаци опису — показуються на сторінці родини.</p>
                <div v-for="(_, i) in form.about" :key="i" class="mb-3 flex gap-2">
                    <textarea v-model="form.about[i]" rows="2" :class="field"></textarea>
                    <button type="button" :class="small" @click="form.about.splice(i, 1)">✕</button>
                </div>
                <button type="button" class="glass-pill px-4 py-2 text-xs text-white/70" @click="form.about.push('')">+ Абзац</button>
            </section>

            <section class="glass-panel p-6">
                <h2 class="text-lg font-semibold text-white">Структура керівництва</h2>
                <p class="mb-4 text-xs text-white/45">Хто за що відповідає в родині.</p>
                <div v-for="(unit, i) in form.leadership" :key="i" class="mb-3 rounded-xl border border-white/10 p-3">
                    <div class="grid gap-2 sm:grid-cols-2">
                        <input v-model="unit.title" :class="field" placeholder="Напрямок, напр. Бізвар" />
                        <input v-model="unit.nickname" :class="field" placeholder="Нік у грі" />
                    </div>
                    <textarea v-model="unit.text" rows="2" :class="[field, 'mt-2']" placeholder="Опис"></textarea>
                    <div class="mt-2 flex gap-3">
                        <button type="button" :class="small" @click="move('leadership', i, -1)">↑</button>
                        <button type="button" :class="small" @click="move('leadership', i, 1)">↓</button>
                        <button type="button" class="ml-auto text-xs text-red-300/70 hover:text-red-300" @click="form.leadership.splice(i, 1)">Видалити</button>
                    </div>
                </div>
                <button type="button" class="glass-pill px-4 py-2 text-xs text-white/70" @click="form.leadership.push({ title: '', text: '', nickname: '' })">+ Напрямок</button>
            </section>

            <button class="btn-gold px-6 py-2.5 text-xs" :disabled="form.processing" @click="save">Зберегти</button>
        </div>

        <!-- Посади + критерії -->
        <div v-if="tab === 'positions'" class="space-y-6">
            <section class="glass-panel p-6">
                <h2 class="text-lg font-semibold text-white">Посади</h2>
                <p class="mb-4 text-xs text-white/45">Від нижчої до вищої. Видалену посаду буде знято з учасників.</p>
                <div v-for="(pos, i) in form.positions" :key="pos.key || i" class="mb-3 rounded-xl border border-white/10 p-3">
                    <input v-model="pos.title" :class="field" placeholder="Назва посади" />
                    <textarea v-model="pos.text" rows="2" :class="[field, 'mt-2']" placeholder="Обов'язки / опис"></textarea>
                    <div class="mt-2 flex gap-3">
                        <button type="button" :class="small" @click="move('positions', i, -1)">↑</button>
                        <button type="button" :class="small" @click="move('positions', i, 1)">↓</button>
                        <button type="button" class="ml-auto text-xs text-red-300/70 hover:text-red-300" @click="form.positions.splice(i, 1)">Видалити</button>
                    </div>
                </div>
                <button type="button" class="glass-pill px-4 py-2 text-xs text-white/70" @click="form.positions.push({ title: '', text: '', image: '' })">+ Посада</button>
            </section>

            <section class="glass-panel p-6">
                <h2 class="text-lg font-semibold text-white">Критерії підвищення</h2>
                <div v-for="(_, i) in form.promotionCriteria" :key="i" class="mb-2 flex gap-2">
                    <input v-model="form.promotionCriteria[i]" :class="field" />
                    <button type="button" :class="small" @click="form.promotionCriteria.splice(i, 1)">✕</button>
                </div>
                <button type="button" class="glass-pill px-4 py-2 text-xs text-white/70" @click="form.promotionCriteria.push('')">+ Критерій</button>
            </section>

            <p v-if="Object.keys(form.errors).length" class="text-sm text-red-300">{{ Object.values(form.errors)[0] }}</p>
            <button class="btn-gold px-6 py-2.5 text-xs" :disabled="form.processing" @click="save">Зберегти</button>
        </div>

        <!-- Склад і посади учасників -->
        <section v-if="tab === 'members'" class="glass-panel p-6">
            <h2 class="text-lg font-semibold text-white">Склад родини</h2>
            <p class="mb-4 text-xs text-white/45">Посада учасника — у цій родині. Ролі (лідер, заступник) — на сторінці родини.</p>
            <div class="divide-y divide-white/5">
                <div v-for="m in members" :key="m.id" class="flex flex-wrap items-center gap-3 py-2.5">
                    <span class="min-w-0 flex-1 truncate text-sm text-white">{{ m.name }}</span>
                    <span class="text-xs text-white/40">{{ ROLE[m.role] }}</span>
                    <select
                        :value="m.positionKey ?? ''"
                        class="rounded-xl border border-white/10 bg-obsidian-900/60 px-3 py-1.5 text-xs text-white"
                        @change="setPosition(m, $event.target.value)"
                    >
                        <option value="">— без посади —</option>
                        <option v-for="p in content.positions" :key="p.key" :value="p.key">{{ p.title }}</option>
                    </select>
                </div>
            </div>
        </section>

        <!-- Правила -->
        <section v-if="tab === 'rules'" class="glass-panel p-6">
            <h2 class="text-lg font-semibold text-white">Правила родини</h2>
            <p class="mb-3 text-xs text-white/45">
                Формат, як у Discord: «# 1. Розділ», «**1.1 Текст пункту**», блоки ```diff з рядками «- покарання» і «! примітка». Показуються учасникам у «Правилах».
            </p>
            <textarea v-model="rulesForm.rules" rows="22" :class="[field, 'font-mono text-xs']" placeholder="# 1. Загальні положення&#10;**1.1 ...**"></textarea>
            <button class="btn-gold mt-4 px-6 py-2.5 text-xs" :disabled="rulesForm.processing" @click="saveRules">Зберегти правила</button>
        </section>
    </AdminLayout>
</template>
