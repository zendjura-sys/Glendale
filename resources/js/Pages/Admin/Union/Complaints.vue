<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import PhotoGallery from '@/Components/PhotoGallery.vue';
import { Head, router, useForm, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

const props = defineProps({
    complaints: { type: Object, required: true },
    reasons: { type: Object, default: () => ({}) },
    statuses: { type: Array, default: () => [] },
    filters: { type: Object, default: () => ({}) },
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

function filterByStatus(value) {
    router.get(route('admin.union.complaints.index'), value ? { status: value } : {}, { preserveState: true });
}

const editingId = ref(null);
const editForm = useForm({ status: '', reviewer_note: '' });

function startEdit(complaint) {
    editingId.value = complaint.id;
    editForm.status = complaint.status;
    editForm.reviewer_note = complaint.reviewer_note ?? '';
}

function save(complaint) {
    editForm.put(route('admin.union.complaints.update', complaint.id), {
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

    <AdminLayout title="Скарги союзу">
        <p
            v-if="status"
            class="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
        >
            {{ status }}
        </p>

        <div class="mb-6 flex flex-wrap gap-2">
            <button
                type="button"
                class="glass-pill px-4 py-1.5 text-xs uppercase tracking-widest"
                :class="!filters.status ? 'text-gold-200' : 'text-white/50 hover:text-white'"
                @click="filterByStatus(null)"
            >
                Усі
            </button>
            <button
                v-for="s in statuses"
                :key="s"
                type="button"
                class="glass-pill px-4 py-1.5 text-xs uppercase tracking-widest"
                :class="filters.status === s ? 'text-gold-200' : 'text-white/50 hover:text-white'"
                @click="filterByStatus(s)"
            >
                {{ STATUS_LABELS[s] ?? s }}
            </button>
        </div>

        <div class="space-y-4">
            <div v-for="complaint in complaints.data" :key="complaint.id" v-glow class="glass-panel p-6">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                        <span class="rounded-xl border px-2.5 py-0.5 text-[10px] uppercase tracking-widest" :class="STATUS_COLORS[complaint.status]">
                            {{ STATUS_LABELS[complaint.status] ?? complaint.status }}
                        </span>
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

                    <button v-if="editingId !== complaint.id" type="button" class="shrink-0 text-xs text-white/40 hover:text-white" @click="startEdit(complaint)">
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
                        <button type="button" class="rounded-xl border border-gold-400/40 px-4 py-1.5 text-xs text-gold-200 hover:border-gold-300" @click="save(complaint)">Зберегти</button>
                        <button type="button" class="text-xs text-white/40 hover:text-white" @click="editingId = null">Скасувати</button>
                    </div>
                </div>
            </div>

            <div v-if="complaints.data.length === 0" class="glass-panel px-6 py-12 text-center text-white/30">Скарг ще немає</div>
        </div>
    </AdminLayout>
</template>
