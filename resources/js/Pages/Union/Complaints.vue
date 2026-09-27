<script setup>
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import InputLabel from '@/Components/InputLabel.vue';
import TextInput from '@/Components/TextInput.vue';
import InputError from '@/Components/InputError.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import PhotoGallery from '@/Components/PhotoGallery.vue';
import { Head, useForm, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

const props = defineProps({
    complaints: { type: Array, default: () => [] },
    reasons: { type: Object, default: () => ({}) },
    statuses: { type: Array, default: () => [] },
    myId: { type: Number, required: true },
    canReview: { type: Boolean, default: false },
});

const status = computed(() => usePage().props.flash?.status);

const STATUS_LABELS = {
    pending: 'Очікує',
    in_review: 'На розгляді',
    resolved: 'Вирішено',
    dismissed: 'Відхилено',
};

const STATUS_COLORS = {
    pending: 'border-gold-400/30 bg-gold-400/10 text-gold-200',
    in_review: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
    resolved: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    dismissed: 'border-white/15 bg-white/5 text-white/40',
};

/* ---------- форма подачі ---------- */
const form = useForm({
    against_family: '',
    against_name: '',
    reasons: [],
    description: '',
    photos: [],
});

function toggleReason(key) {
    const idx = form.reasons.indexOf(key);
    if (idx === -1) {
        form.reasons.push(key);
    } else {
        form.reasons.splice(idx, 1);
    }
}

function onPhotosChange(e) {
    form.photos = Array.from(e.target.files ?? []);
}

const familyMatches = ref([]);
let familySearchTimer = null;

function onFamilyInput() {
    clearTimeout(familySearchTimer);
    if (form.against_family.trim().length < 2) {
        familyMatches.value = [];
        return;
    }
    familySearchTimer = setTimeout(async () => {
        const { data } = await window.axios.get(route('union.families.search'), { params: { q: form.against_family } });
        familyMatches.value = data.data.families;
    }, 300);
}

function pickFamily(family) {
    form.against_family = family.name;
    familyMatches.value = [];
}

function submit() {
    form.post(route('union.complaints.store'), {
        preserveScroll: true,
        forceFormData: true,
        onSuccess: () => {
            form.reset();
            familyMatches.value = [];
        },
    });
}

/* ---------- розгляд (лідер/заступник обвинуваченої родини) ---------- */
const editingId = ref(null);
const editForm = useForm({ status: '', reviewer_note: '' });

function startEdit(complaint) {
    editingId.value = complaint.id;
    editForm.status = complaint.status;
    editForm.reviewer_note = complaint.reviewer_note ?? '';
}

function saveReview(complaint) {
    editForm.put(route('union.complaints.update', complaint.id), {
        preserveScroll: true,
        onSuccess: () => { editingId.value = null; },
    });
}

function reasonLabel(key) {
    return props.reasons[key]?.label ?? key;
}

function fmtDate(iso) {
    return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
    <Head title="Скарги союзу" />

    <AuthenticatedLayout>
        <template #header>
            <h2 class="font-display text-2xl font-light text-white">Скарги союзу</h2>
        </template>

        <div class="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
            <p
                v-if="status"
                class="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
            >
                {{ status }}
            </p>

            <!-- ================= ФОРМА ================= -->
            <div v-glow class="glass-panel p-6 sm:p-8">
                <h3 class="font-display mb-1 text-lg text-white">Подати скаргу</h3>
                <p class="mb-4 text-sm text-white/40">
                    Якщо хтось із союзної родини має до вас претензії — краще розглянуть, якщо описати конкретну ситуацію.
                </p>
                <form class="space-y-5" @submit.prevent="submit">
                    <div class="relative">
                        <InputLabel for="c_family" value="На яку родину скарга" />
                        <TextInput id="c_family" v-model="form.against_family" type="text" required @input="onFamilyInput" />
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
                        <InputError :message="form.errors.against_family" />
                    </div>

                    <div>
                        <InputLabel for="c_name" value="На кого скарга (ігровий нік)" />
                        <TextInput id="c_name" v-model="form.against_name" type="text" required />
                        <InputError :message="form.errors.against_name" />
                    </div>

                    <div>
                        <InputLabel value="Причина скарги (можна декілька)" />
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
                        <InputLabel for="c_description" value="Опис ситуації" />
                        <textarea
                            id="c_description"
                            v-model="form.description"
                            rows="4"
                            class="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:ring-0"
                        ></textarea>
                        <InputError :message="form.errors.description" />
                    </div>

                    <div>
                        <InputLabel for="c_photos" value="Фото-докази (необов'язково)" />
                        <input
                            id="c_photos"
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp"
                            class="mt-1 block w-full text-sm text-white/60 file:mr-4 file:rounded-xl file:border-0 file:bg-gold-400/10 file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-widest file:text-gold-200"
                            @change="onPhotosChange"
                        />
                        <InputError :message="form.errors.photos" />
                    </div>

                    <PrimaryButton :disabled="form.processing">Подати скаргу</PrimaryButton>
                </form>
            </div>

            <!-- ================= СПИСОК ================= -->
            <div class="space-y-4">
                <h3 class="font-display text-lg text-white">
                    {{ canReview ? 'Мої скарги та скарги проти моєї родини' : 'Мої скарги' }}
                </h3>

                <div v-for="complaint in complaints" :key="complaint.id" v-glow class="glass-panel p-6">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="rounded-xl border px-2.5 py-0.5 text-[10px] uppercase tracking-widest" :class="STATUS_COLORS[complaint.status]">
                                    {{ STATUS_LABELS[complaint.status] ?? complaint.status }}
                                </span>
                                <span v-if="complaint.reporter_id === myId" class="text-[10px] uppercase tracking-widest text-white/30">моя скарга</span>
                            </div>
                            <p class="mt-2 text-sm text-white/40">
                                {{ fmtDate(complaint.created_at) }} · подав <span class="text-white/70">{{ complaint.reporter?.name }}</span>
                            </p>
                            <p class="mt-2 font-medium text-white">
                                Проти родини <span class="text-gold-300">{{ complaint.against_family }}</span>, гравець «{{ complaint.against_name }}»
                            </p>
                            <div class="mt-2 flex flex-wrap gap-1.5">
                                <span v-for="r in complaint.reasons" :key="r" class="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-white/60">
                                    {{ reasonLabel(r) }}
                                </span>
                            </div>
                            <p v-if="complaint.description" class="mt-3 whitespace-pre-line text-sm text-white/60">{{ complaint.description }}</p>
                            <PhotoGallery v-if="complaint.attachments?.length" :photos="complaint.attachments" class="mt-3" />
                            <p v-if="complaint.reviewer" class="mt-3 text-xs text-white/30">
                                Розглянув: {{ complaint.reviewer.name }}<span v-if="complaint.reviewer_note"> — «{{ complaint.reviewer_note }}»</span>
                            </p>
                        </div>

                        <button
                            v-if="canReview && editingId !== complaint.id"
                            type="button"
                            class="shrink-0 text-xs text-white/40 hover:text-white"
                            @click="startEdit(complaint)"
                        >
                            Розглянути
                        </button>
                    </div>

                    <div v-if="editingId === complaint.id" class="mt-4 space-y-3 border-t border-white/10 pt-4">
                        <select
                            v-model="editForm.status"
                            class="w-full max-w-xs rounded-xl border border-white/10 bg-obsidian-900/60 px-3 py-2 text-sm text-white focus:border-gold-400/40 focus:outline-none"
                        >
                            <option v-for="s in statuses" :key="s" :value="s">{{ STATUS_LABELS[s] ?? s }}</option>
                        </select>
                        <textarea
                            v-model="editForm.reviewer_note"
                            rows="2"
                            placeholder="Коментар до рішення (необов'язково)"
                            class="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:ring-0"
                        ></textarea>
                        <div class="flex gap-3">
                            <button type="button" class="rounded-xl border border-gold-400/40 px-4 py-1.5 text-xs text-gold-200 hover:border-gold-300" @click="saveReview(complaint)">Зберегти</button>
                            <button type="button" class="text-xs text-white/40 hover:text-white" @click="editingId = null">Скасувати</button>
                        </div>
                    </div>
                </div>

                <div v-if="complaints.length === 0" class="glass-panel px-6 py-12 text-center text-white/30">Скарг ще немає</div>
            </div>
        </div>
    </AuthenticatedLayout>
</template>
