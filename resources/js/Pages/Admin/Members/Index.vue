<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { Head, Link, router } from '@inertiajs/vue3';
import { ref } from 'vue';

const props = defineProps({
    members: { type: Object, required: true },
    pendingLeaveRequests: { type: Array, default: () => [] },
    statuses: { type: Array, required: true },
    search: { type: String, default: '' },
});

const statusLabels = {
    active: 'Активний',
    probation: 'На стажуванні',
    leave: 'У відпустці',
    inactive: 'Неактивний',
};

const q = ref(props.search);
function search() {
    router.get(route('admin.members.index'), { q: q.value }, { preserveState: true, replace: true });
}

/* ---------- сповіщення ---------- */
const toasts = ref([]);
let toastId = 0;
function pushToast(ok, message) {
    const id = ++toastId;
    toasts.value.push({ id, ok, message });
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 4000);
}

/* ---------- зміна HR-статусу ---------- */
const savingMember = ref(null);
async function changeStatus(member, status) {
    if (member.hr_status === status) return;
    const prev = member.hr_status;
    member.hr_status = status;
    savingMember.value = member.id;
    try {
        const { data } = await window.axios.put(route('admin.members.status', member.id), { hr_status: status });
        pushToast(data.ok, data.message);
    } catch (e) {
        member.hr_status = prev;
        pushToast(false, e.response?.data?.message || 'Помилка');
    } finally {
        savingMember.value = null;
    }
}

/* ---------- приватні нотатки ---------- */
const openNotesFor = ref(null);
const notesByUser = ref({});
const newNoteBody = ref('');
const notesBusy = ref(false);

async function toggleNotes(member) {
    if (openNotesFor.value === member.id) {
        openNotesFor.value = null;
        return;
    }
    openNotesFor.value = member.id;
    newNoteBody.value = '';
    if (!notesByUser.value[member.id]) {
        const { data } = await window.axios.get(route('admin.members.notes.index', member.id));
        notesByUser.value = { ...notesByUser.value, [member.id]: data.data.notes };
    }
}

async function addNote(member) {
    if (!newNoteBody.value.trim()) return;
    notesBusy.value = true;
    try {
        const { data } = await window.axios.post(route('admin.members.notes.store', member.id), { body: newNoteBody.value });
        notesByUser.value = { ...notesByUser.value, [member.id]: [data.data.note, ...(notesByUser.value[member.id] || [])] };
        newNoteBody.value = '';
        member.notes_count += 1;
    } catch (e) {
        pushToast(false, e.response?.data?.message || 'Помилка');
    } finally {
        notesBusy.value = false;
    }
}

/* ---------- заявки на відпустку ---------- */
const leaveBusy = ref(null);
async function reviewLeave(leaveRequest, action) {
    leaveBusy.value = leaveRequest.id;
    try {
        const { data } = await window.axios.post(route(`admin.members.leave.${action}`, leaveRequest.id));
        pushToast(data.ok, data.message);
        if (data.ok) router.reload({ only: ['pendingLeaveRequests'] });
    } catch (e) {
        pushToast(false, e.response?.data?.message || 'Помилка');
    } finally {
        leaveBusy.value = null;
    }
}

function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateTime(iso) {
    return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
    <Head title="Кадровий облік" />

    <AdminLayout title="Кадровий облік">
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

        <!-- ================= ЗАЯВКИ НА РОЗГЛЯДІ ================= -->
        <div v-if="pendingLeaveRequests.length > 0" class="mb-10">
            <h2 class="font-display mb-4 text-xl text-white">Заявки на відпустку — на розгляді</h2>
            <div class="overflow-hidden rounded-2xl border border-gold-400/20 bg-gold-400/[0.03]">
                <div
                    v-for="lr in pendingLeaveRequests"
                    :key="lr.id"
                    class="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-6 py-4 last:border-0"
                >
                    <div>
                        <p class="font-medium text-white">{{ lr.user?.name }}</p>
                        <p class="text-sm text-white/50">{{ fmtDate(lr.starts_on) }} — {{ fmtDate(lr.ends_on) }}</p>
                        <p v-if="lr.reason" class="mt-1 text-sm text-white/40">{{ lr.reason }}</p>
                    </div>
                    <div class="flex gap-2">
                        <button
                            :disabled="leaveBusy === lr.id"
                            class="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-40"
                            @click="reviewLeave(lr, 'approve')"
                        >
                            Затвердити
                        </button>
                        <button
                            :disabled="leaveBusy === lr.id"
                            class="rounded-xl border border-ember-500/25 px-4 py-1.5 text-xs font-medium text-ember-500/80 hover:bg-ember-600/10 disabled:opacity-40"
                            @click="reviewLeave(lr, 'reject')"
                        >
                            Відхилити
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- ================= УЧАСНИКИ ================= -->
        <div class="mb-6 max-w-sm">
            <input
                v-model="q"
                type="search"
                placeholder="Пошук за іменем або email…"
                class="w-full rounded-lg border border-white/10 bg-obsidian-900/60 px-3 py-2 text-white placeholder:text-white/30 focus:border-gold-400/50 focus:outline-none focus:ring-1 focus:ring-gold-400/40"
                @keyup.enter="search"
            />
        </div>

        <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <template v-for="member in members.data" :key="member.id">
                <div class="border-b border-white/5 px-6 py-4 last:border-0" :class="savingMember === member.id && 'opacity-60'">
                    <div class="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p class="font-medium text-white">{{ member.name }}</p>
                            <p class="text-xs text-white/40">{{ member.email }}</p>
                        </div>
                        <div class="flex flex-wrap items-center gap-3">
                            <button
                                class="rounded-xl border border-white/15 px-3 py-1.5 text-xs text-white/60 transition-colors hover:border-white/30"
                                @click="toggleNotes(member)"
                            >
                                Нотатки ({{ member.notes_count }})
                            </button>
                            <!-- Покарання — окремий розділ адмінки (строки, штрафи, ескалація за правилами родини) -->
                            <Link
                                v-if="route().has('admin.discipline.index')"
                                :href="route('admin.discipline.index', { user: member.id, status: 'all' })"
                                class="rounded-xl border px-3 py-1.5 text-xs transition-colors"
                                :class="member.warnings_count > 0 ? 'border-orange-400/30 text-orange-300 hover:border-orange-400/50' : 'border-white/15 text-white/60 hover:border-white/30'"
                            >
                                ⚖ Покарання ({{ member.warnings_count }})
                            </Link>
                            <select
                                class="rounded-xl border border-white/10 bg-obsidian-900 px-3 py-1.5 text-xs text-white focus:border-gold-400/50 focus:outline-none"
                                :value="member.hr_status"
                                @change="changeStatus(member, $event.target.value)"
                            >
                                <option v-for="s in statuses" :key="s" :value="s">{{ statusLabels[s] }}</option>
                            </select>
                        </div>
                    </div>

                    <div v-if="openNotesFor === member.id" class="mt-4 rounded-xl border border-white/10 bg-obsidian-900/60 p-4">
                        <div class="mb-3 flex gap-2">
                            <input
                                v-model="newNoteBody"
                                type="text"
                                placeholder="Приватна нотатка (бачить лише HR)…"
                                class="w-full rounded-lg border border-white/10 bg-obsidian-950 px-3 py-2 text-sm text-white placeholder:text-white/30"
                                @keyup.enter="addNote(member)"
                            />
                            <button
                                :disabled="notesBusy"
                                class="shrink-0 rounded-lg border border-gold-400/40 px-4 py-2 text-xs font-medium text-gold-200 hover:border-gold-300 disabled:opacity-40"
                                @click="addNote(member)"
                            >
                                Додати
                            </button>
                        </div>
                        <div class="space-y-2">
                            <div v-for="note in notesByUser[member.id] || []" :key="note.id" class="rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                                <p class="text-white/70">{{ note.body }}</p>
                                <p class="mt-1 text-[11px] text-white/30">{{ note.author?.name }} · {{ fmtDateTime(note.created_at) }}</p>
                            </div>
                            <p v-if="(notesByUser[member.id] || []).length === 0" class="text-sm text-white/30">Нотаток ще немає</p>
                        </div>
                    </div>

                </div>
            </template>
            <div v-if="members.data.length === 0" class="px-6 py-12 text-center text-white/30">
                Нікого не знайдено
            </div>
        </div>

        <div v-if="members.links?.length > 3" class="mt-6 flex flex-wrap gap-2">
            <Link
                v-for="link in members.links"
                :key="link.label"
                :href="link.url || ''"
                v-html="link.label"
                class="rounded-xl border px-3 py-1.5 text-xs"
                :class="[
                    link.active ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/10 text-white/40 hover:text-white',
                    !link.url && 'pointer-events-none opacity-30',
                ]"
            />
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
