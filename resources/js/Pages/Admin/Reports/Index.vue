<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { Head, router } from '@inertiajs/vue3';
import { ref } from 'vue';
import PhotoGallery from '@/Components/PhotoGallery.vue';
import { verb } from '@/utils/gendered';

const props = defineProps({
    reports: { type: Object, required: true },
    status: { type: String, default: 'pending' },
    filters: { type: Object, default: () => ({ type: '', from: '', to: '', q: '' }) },
    types: { type: Array, default: () => [] },
    aiRejectionAdviceEnabled: { type: Boolean, default: false },
    aiGradeAdviceEnabled: { type: Boolean, default: false },
});

const filterForm = ref({ type: props.filters.type, from: props.filters.from, to: props.filters.to, q: props.filters.q });

function applyFilters() {
    router.get(route('admin.reports.index'), { status: props.status, ...filterForm.value }, { preserveState: true, preserveScroll: true });
}

function resetFilters() {
    filterForm.value = { type: '', from: '', to: '', q: '' };
    router.get(route('admin.reports.index'), { status: props.status }, { preserveState: true, preserveScroll: true });
}

const toasts = ref([]);
let toastId = 0;
function pushToast(ok, message) {
    const id = ++toastId;
    toasts.value.push({ id, ok, message });
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 4000);
}

const busy = ref(null);
async function act(report, action, payload = {}) {
    busy.value = report.id;
    try {
        const { data } = await window.axios.post(`/admin/reports/${report.id}/${action}`, payload);
        pushToast(data.ok, data.message);
        if (data.ok) {
            router.reload({ only: ['reports'] });
            gradingReportId.value = null;
        } else if (data.errors?.grade_reason) {
            pushToast(false, data.errors.grade_reason[0]);
        }
    } catch (e) {
        pushToast(false, e.response?.data?.message || 'Помилка');
    } finally {
        busy.value = null;
    }
}

/* ================= Оцінка при затвердженні ================= */

const GRADES = ['S', 'A', 'B', 'C', 'D', 'F', 'G'];
const LOW_GRADES = ['D', 'F', 'G'];
const GRADE_LABELS = { S: '+30%', A: '+20%', B: '+10%', C: '0%', D: '-10%', F: '-20%', G: '-30%' };

const gradingReportId = ref(null);
const selectedGrade = ref(null);
const gradeReason = ref('');
const gradeAdvising = ref(false);
const gradeAdvice = ref(null);

function startGrading(report) {
    gradingReportId.value = report.id;
    selectedGrade.value = null;
    gradeReason.value = '';
    gradeAdvice.value = null;
}

async function suggestGrade(report) {
    gradeAdvising.value = true;
    gradeAdvice.value = null;
    try {
        const { data } = await window.axios.post(route('admin.reports.ai-grade-recommendation', report.id));
        if (data.ok) {
            selectedGrade.value = data.data.grade;
            gradeAdvice.value = data.data.reason;
        } else {
            pushToast(false, data.message);
        }
    } catch (e) {
        pushToast(false, e.response?.data?.message || 'Помилка');
    } finally {
        gradeAdvising.value = false;
    }
}

function confirmApprove(report) {
    if (!selectedGrade.value) return;
    if (LOW_GRADES.includes(selectedGrade.value) && !gradeReason.value.trim()) return;
    act(report, 'approve', { grade: selectedGrade.value, grade_reason: gradeReason.value || null });
}

/* ================= Відхилення + AI-рекомендація ================= */

const rejectingReportId = ref(null);
const rejectNote = ref('');
const aiDrafting = ref(false);

function startRejecting(report) {
    rejectingReportId.value = report.id;
    rejectNote.value = '';
}

async function draftAiRecommendation(report) {
    aiDrafting.value = true;
    try {
        const { data } = await window.axios.post(route('admin.reports.ai-recommendation', report.id), { hint: rejectNote.value || null });
        if (data.ok) {
            rejectNote.value = data.data.text;
        } else {
            pushToast(false, data.message);
        }
    } catch (e) {
        pushToast(false, e.response?.data?.message || 'Помилка');
    } finally {
        aiDrafting.value = false;
    }
}

function confirmReject(report) {
    act(report, 'reject', { note: rejectNote.value || null });
    rejectingReportId.value = null;
}

function switchStatus(s) {
    router.get(route('admin.reports.index'), { status: s, ...filterForm.value }, { preserveState: true, preserveScroll: true });
}

const typeLabels = { kapt: 'Капт', contract: 'Контракт', bizwar: 'Бізвар', investment: 'Інвестиції', other: 'Інше' };
function fmtDate(iso) {
    return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
    <Head title="Модерація звітів" />

    <AdminLayout title="Модерація звітів">
        <div class="pointer-events-none fixed inset-x-4 top-6 z-[100] flex flex-col gap-3 sm:inset-x-auto sm:right-6 sm:w-full sm:max-w-sm">
            <TransitionGroup name="toast">
                <div
                    v-for="t in toasts"
                    :key="t.id"
                    class="pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-md"
                    :class="t.ok ? 'border-emerald-400/30 bg-emerald-950/80 text-emerald-200' : 'border-ember-500/30 bg-ember-600/20 text-ember-500'"
                >
                    {{ t.message }}
                </div>
            </TransitionGroup>
        </div>

        <div class="max-w-6xl">
            <div class="mb-6 flex gap-2">
                <button
                    v-for="s in ['pending', 'approved', 'rejected']"
                    :key="s"
                    class="rounded-xl border px-4 py-2 text-sm transition-all"
                    :class="status === s ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/10 text-white/50 hover:border-white/25'"
                    @click="switchStatus(s)"
                >
                    {{ s === 'pending' ? 'На розгляді' : s === 'approved' ? 'Затверджені' : 'Відхилені' }}
                </button>
            </div>

            <div class="mb-6 flex flex-wrap items-end gap-3">
                <div>
                    <label class="mb-1 block text-[10px] uppercase tracking-widest text-white/40">Тип</label>
                    <select
                        v-model="filterForm.type"
                        class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white focus:border-gold-400/50 focus:outline-none"
                    >
                        <option value="">Усі типи</option>
                        <option v-for="t in types" :key="t" :value="t">{{ typeLabels[t] || t }}</option>
                    </select>
                </div>
                <div>
                    <label class="mb-1 block text-[10px] uppercase tracking-widest text-white/40">Дата від</label>
                    <input v-model="filterForm.from" type="date" class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                    <label class="mb-1 block text-[10px] uppercase tracking-widest text-white/40">Дата до</label>
                    <input v-model="filterForm.to" type="date" class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white" />
                </div>
                <div class="min-w-[180px] flex-1">
                    <label class="mb-1 block text-[10px] uppercase tracking-widest text-white/40">Учасник</label>
                    <input v-model="filterForm.q" type="text" placeholder="Ім'я…" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white placeholder:text-white/30" />
                </div>
                <button type="button" class="rounded-xl border border-gold-400/40 px-4 py-2 text-xs font-medium tracking-widest text-gold-200 hover:border-gold-300" @click="applyFilters">
                    Застосувати
                </button>
                <button
                    v-if="filters.type || filters.from || filters.to || filters.q"
                    type="button"
                    class="text-xs text-white/40 hover:text-white"
                    @click="resetFilters"
                >
                    Скинути
                </button>
                <a
                    :href="route('admin.reports.export', { status, ...filterForm })"
                    class="ml-auto rounded-xl border border-white/15 px-4 py-2 text-xs text-white/60 hover:border-white/30"
                >
                    ⬇ Експорт CSV
                </a>
            </div>

            <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                <div
                    v-for="report in reports.data"
                    :key="report.id"
                    class="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-6 py-4 last:border-0"
                >
                    <div>
                        <div class="flex items-center gap-2 text-white">
                            <span class="font-medium">{{ report.user?.name }}</span>
                            <span class="text-white/30">·</span>
                            <span>{{ typeLabels[report.type] }}</span>
                            <span v-if="report.outcome" class="text-xs uppercase text-white/40">{{ report.outcome }}</span>
                            <span v-if="report.weight" class="text-xs uppercase text-white/40">{{ report.weight }}</span>
                            <span v-if="report.wins_count !== null" class="text-xs uppercase text-white/40">W: {{ report.wins_count }}</span>
                            <span v-if="report.losses_count !== null" class="text-xs uppercase text-white/40">L: {{ report.losses_count }}</span>
                            <span v-if="report.kapt_times?.length" class="text-xs uppercase text-white/40">{{ report.kapt_times.join(', ') }}</span>
                            <span v-if="report.light_count !== null" class="text-xs uppercase text-white/40">
                                л:{{ report.light_count }} с:{{ report.medium_count }} т:{{ report.heavy_count }}
                            </span>
                            <span v-if="report.amount" class="text-xs uppercase text-white/40">{{ report.amount.toLocaleString('uk-UA') }}</span>
                            <span
                                v-if="report.ai_review?.flagged"
                                class="rounded-xl border border-gold-400/30 bg-gold-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gold-300"
                                :title="[report.ai_review.date_mismatch_detail, report.ai_review.count_mismatch_detail].filter(Boolean).join(' · ')"
                            >
                                🤖 AI: розбіжність
                            </span>
                        </div>
                        <p v-if="report.ai_review?.date_mismatch" class="mt-1 text-xs text-gold-300/80">🤖 {{ report.ai_review.date_mismatch_detail }}</p>
                        <p v-if="report.ai_review?.count_mismatch" class="mt-1 text-xs text-gold-300/80">🤖 {{ report.ai_review.count_mismatch_detail }}</p>
                        <p v-if="report.description" class="mt-1 text-sm text-white/50">{{ report.description }}</p>
                        <p class="mt-1 text-xs text-white/30">
                            {{ verb(report.submitter, 'подав', 'подала') }} {{ report.submitter?.name }}
                            <span v-if="report.report_date">· дата {{ new Date(report.report_date).toLocaleDateString('uk-UA') }}</span>
                            · {{ fmtDate(report.created_at) }}
                            <span v-if="report.grade" class="ml-1 font-medium text-gold-300/80">· оцінка {{ report.grade }} ({{ GRADE_LABELS[report.grade] }})</span>
                        </p>
                        <p v-if="report.grade_reason" class="mt-1 text-xs text-ember-500/70">Причина: {{ report.grade_reason }}</p>
                        <PhotoGallery v-if="report.attachments?.length" :photos="report.attachments" :visible="6" class="mt-3" />

                        <div v-if="gradingReportId === report.id" class="mt-3 rounded-lg border border-white/10 bg-obsidian-900/60 p-3">
                            <div class="flex flex-wrap items-center gap-1.5">
                                <button
                                    v-for="g in GRADES"
                                    :key="g"
                                    class="rounded-xl border px-3 py-1 text-xs font-medium transition-colors"
                                    :class="selectedGrade === g ? 'border-gold-400/60 bg-gold-400/15 text-gold-200' : 'border-white/15 text-white/50 hover:border-white/30'"
                                    @click="selectedGrade = g"
                                >
                                    {{ g }} <span class="text-white/30">{{ GRADE_LABELS[g] }}</span>
                                </button>
                                <button
                                    v-if="aiGradeAdviceEnabled"
                                    :disabled="gradeAdvising"
                                    class="rounded-xl border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-xs font-medium text-gold-300 hover:bg-gold-400/20 disabled:opacity-40"
                                    @click="suggestGrade(report)"
                                >
                                    {{ gradeAdvising ? 'Аналізую…' : '✨ Порекомендувати оцінку' }}
                                </button>
                            </div>
                            <p v-if="gradeAdvice" class="mt-2 text-xs text-gold-300/80">🤖 {{ gradeAdvice }}</p>
                            <textarea
                                v-if="selectedGrade && LOW_GRADES.includes(selectedGrade)"
                                v-model="gradeReason"
                                rows="2"
                                placeholder="Причина низької оцінки (обов'язково)"
                                class="mt-2 w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white"
                            ></textarea>
                            <div class="mt-2 flex gap-2">
                                <button
                                    :disabled="busy === report.id || !selectedGrade || (LOW_GRADES.includes(selectedGrade) && !gradeReason.trim())"
                                    class="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-30"
                                    @click="confirmApprove(report)"
                                >
                                    Підтвердити затвердження
                                </button>
                                <button class="text-xs text-white/40 hover:text-white" @click="gradingReportId = null">Скасувати</button>
                            </div>
                        </div>

                        <div v-if="rejectingReportId === report.id" class="mt-3 rounded-lg border border-white/10 bg-obsidian-900/60 p-3">
                            <textarea
                                v-model="rejectNote"
                                rows="3"
                                placeholder="Причина відхилення — учасник побачить цей текст…"
                                class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white"
                            ></textarea>
                            <div class="mt-2 flex flex-wrap gap-2">
                                <button
                                    v-if="aiRejectionAdviceEnabled"
                                    :disabled="aiDrafting"
                                    class="rounded-xl border border-gold-400/30 bg-gold-400/10 px-4 py-1.5 text-xs font-medium text-gold-300 hover:bg-gold-400/20 disabled:opacity-40"
                                    @click="draftAiRecommendation(report)"
                                >
                                    {{ aiDrafting ? 'Генерую…' : '✨ Згенерувати рекомендацію' }}
                                </button>
                                <button
                                    :disabled="busy === report.id"
                                    class="rounded-xl border border-ember-500/25 bg-ember-600/10 px-4 py-1.5 text-xs font-medium text-ember-500/80 hover:bg-ember-600/20 disabled:opacity-40"
                                    @click="confirmReject(report)"
                                >
                                    Підтвердити відхилення
                                </button>
                                <button class="text-xs text-white/40 hover:text-white" @click="rejectingReportId = null">Скасувати</button>
                            </div>
                        </div>
                    </div>
                    <div v-if="report.status === 'pending' && gradingReportId !== report.id && rejectingReportId !== report.id" class="flex gap-2">
                        <button
                            :disabled="busy === report.id"
                            class="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-40"
                            @click="startGrading(report)"
                        >
                            Затвердити
                        </button>
                        <button
                            :disabled="busy === report.id"
                            class="rounded-xl border border-ember-500/25 px-4 py-1.5 text-xs font-medium text-ember-500/80 hover:bg-ember-600/10 disabled:opacity-40"
                            @click="startRejecting(report)"
                        >
                            Відхилити
                        </button>
                    </div>
                </div>
                <div v-if="reports.data.length === 0" class="px-6 py-12 text-center text-white/30">
                    Нічого немає в цій категорії
                </div>
            </div>
        </div>
    </AdminLayout>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from {
    opacity: 0;
    transform: translateX(30px);
}
.toast-leave-to {
    opacity: 0;
    transform: translateX(30px) scale(0.95);
}
</style>
