<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { Head, router } from '@inertiajs/vue3';
import { computed, ref, watch } from 'vue';

const props = defineProps({
    penalties: { type: Array, default: () => [] },
    stats: { type: Object, default: () => ({}) },
    types: { type: Array, default: () => [] },
    rules: { type: Array, default: () => [] },
    filters: { type: Object, default: () => ({ status: 'open', user: null }) },
});

const typeStyle = {
    remark: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
    fine: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
    reprimand: 'border-orange-500/45 bg-orange-500/10 text-orange-200',
    demotion: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200',
    kick: 'border-red-500/50 bg-red-500/10 text-red-200',
    blacklist: 'border-red-700/70 bg-red-900/40 text-red-100',
};
const statusStyle = {
    active: 'text-emerald-300',
    overdue: 'text-red-300',
    paid: 'text-white/40',
    expired: 'text-white/40',
    converted: 'text-white/40',
    revoked: 'text-white/40',
};

const list = ref([...props.penalties]);
watch(() => props.penalties, (v) => (list.value = [...v]));

/* ---------- сповіщення ---------- */
const toasts = ref([]);
let toastId = 0;
function pushToast(ok, message) {
    const id = ++toastId;
    toasts.value.push({ id, ok, message });
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 4500);
}
function errorText(e) {
    const errors = e.response?.data?.errors;
    return (errors && Object.values(errors)[0]?.[0]) || e.response?.data?.message || 'Помилка';
}

/* ---------- фільтри ---------- */
const statusTabs = [
    { key: 'open', label: 'Активні' },
    { key: 'fines', label: 'Несплачені штрафи' },
    { key: 'closed', label: 'Закриті' },
    { key: 'all', label: 'Усі' },
];
function setStatus(status) {
    router.get(route('admin.discipline.index'), { status, user: props.filters.user || undefined }, { preserveState: false, replace: true });
}
function clearUser() {
    router.get(route('admin.discipline.index'), { status: props.filters.status }, { replace: true });
}

/* ---------- видача ---------- */
const form = ref({ user: null, type: 'remark', rule_code: '', reason: '', amount: '' });
const memberQuery = ref('');
const memberMatches = ref([]);
const busy = ref(false);
let searchTimer = null;

watch(memberQuery, (q) => {
    clearTimeout(searchTimer);
    if (form.value.user && q === form.value.user.name) return;
    form.value.user = null;
    if (q.trim().length < 2) {
        memberMatches.value = [];
        return;
    }
    searchTimer = setTimeout(async () => {
        const { data } = await window.axios.get(route('admin.discipline.members.search'), { params: { q } });
        memberMatches.value = data.data.members;
    }, 250);
});

function pickMember(m) {
    form.value.user = m;
    memberQuery.value = m.name;
    memberMatches.value = [];
}

const selectedRule = computed(() => props.rules.find((r) => r.code === form.value.rule_code));

async function issue() {
    if (!form.value.user) return pushToast(false, 'Оберіть учасника зі списку.');
    busy.value = true;
    try {
        const { data } = await window.axios.post(route('admin.discipline.store'), {
            user_id: form.value.user.id,
            type: form.value.type,
            rule_code: form.value.rule_code || null,
            reason: form.value.reason,
            amount: form.value.type === 'fine' ? Number(form.value.amount) : null,
        });
        list.value = [data.data.penalty, ...list.value];
        pushToast(true, data.message + ' Учасника сповіщено.');
        form.value = { user: null, type: form.value.type, rule_code: '', reason: '', amount: '' };
        memberQuery.value = '';
        router.reload({ only: ['stats'] });
    } catch (e) {
        pushToast(false, errorText(e));
    } finally {
        busy.value = false;
    }
}

/* ---------- дії з покаранням ---------- */
const actionBusy = ref(null);
async function revoke(p) {
    const note = window.prompt(`Причина скасування (${p.typeLabel}, ${p.user?.name}):`);
    if (!note?.trim()) return;
    await act(p, route('admin.discipline.revoke', p.id), { note });
}
async function markPaid(p) {
    if (!window.confirm(`Підтвердити, що ${p.user?.name} сплатив(-ла) штраф ${money(p.amount)} поза банком?`)) return;
    await act(p, route('admin.discipline.mark-paid', p.id), {});
}
async function act(p, url, payload) {
    actionBusy.value = p.id;
    try {
        const { data } = await window.axios.post(url, payload);
        list.value = list.value.map((x) => (x.id === p.id ? data.data.penalty : x));
        pushToast(true, data.message);
        router.reload({ only: ['stats'] });
    } catch (e) {
        pushToast(false, errorText(e));
    } finally {
        actionBusy.value = null;
    }
}

function money(n) {
    return (n ?? 0).toLocaleString('uk-UA').replace(/,/g, ' ') + '₴';
}
function fmt(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
    <Head title="Покарання" />

    <AdminLayout>
        <template #header>
            <h2 class="font-display text-2xl font-light text-white">Покарання</h2>
        </template>

        <div class="space-y-6">
            <!-- Підсумок -->
            <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div class="glass-panel p-4">
                    <p class="text-xs text-white/40">Активні зауваження</p>
                    <p class="mt-1 text-2xl text-sky-200">{{ stats.openRemarks ?? 0 }}</p>
                </div>
                <div class="glass-panel p-4">
                    <p class="text-xs text-white/40">Активні догани</p>
                    <p class="mt-1 text-2xl text-orange-200">{{ stats.openReprimands ?? 0 }}</p>
                </div>
                <div class="glass-panel p-4">
                    <p class="text-xs text-white/40">Несплачені штрафи</p>
                    <p class="mt-1 text-2xl text-amber-200">{{ stats.unpaidFines ?? 0 }}</p>
                </div>
                <div class="glass-panel p-4">
                    <p class="text-xs text-white/40">Сума до сплати</p>
                    <p class="mt-1 text-2xl text-amber-200">{{ money(stats.unpaidFinesAmount) }}</p>
                </div>
            </div>

            <!-- Видача -->
            <div class="glass-panel p-6">
                <h3 class="font-display text-lg font-normal text-white">Видати покарання</h3>
                <p class="mt-1 text-xs text-white/40">
                    Учасника одразу сповістять (сайт, застосунок). 3 зауваження автоматично стають доганою; штраф — 48 годин на оплату, далі ×2 і догана.
                </p>

                <div class="mt-5 grid gap-4 lg:grid-cols-2">
                    <div class="relative">
                        <label class="text-xs text-white/50">Учасник</label>
                        <input
                            v-model="memberQuery"
                            type="text"
                            placeholder="Почніть вводити ім'я…"
                            class="mt-1 w-full rounded-lg border border-white/10 bg-obsidian-950 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold-400/50 focus:outline-none"
                        />
                        <div v-if="memberMatches.length" class="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-obsidian-900 shadow-xl">
                            <button
                                v-for="m in memberMatches"
                                :key="m.id"
                                type="button"
                                class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
                                @click="pickMember(m)"
                            >
                                <span>{{ m.name }}</span>
                                <span class="text-[11px] text-white/40">
                                    зауваж. {{ m.summary.remarks }}/3 · догани {{ m.summary.reprimands }}/3<template v-if="m.summary.unpaidFines"> · штрафи {{ money(m.summary.unpaidFinesAmount) }}</template>
                                </span>
                            </button>
                        </div>
                        <p v-if="form.user" class="mt-1 text-[11px] text-white/40">
                            Зараз: зауважень {{ form.user.summary.remarks }}/3, доган {{ form.user.summary.reprimands }}/3
                        </p>
                    </div>

                    <div>
                        <label class="text-xs text-white/50">Тип</label>
                        <div class="mt-1 flex flex-wrap gap-2">
                            <button
                                v-for="t in types"
                                :key="t.key"
                                type="button"
                                class="rounded-full border px-3 py-1.5 text-xs transition-opacity"
                                :class="[typeStyle[t.key], form.type === t.key ? 'opacity-100 ring-1 ring-white/30' : 'opacity-50 hover:opacity-80']"
                                @click="form.type = t.key"
                            >
                                {{ t.emoji }} {{ t.label }}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label class="text-xs text-white/50">Пункт правил родини</label>
                        <select
                            v-model="form.rule_code"
                            class="mt-1 w-full rounded-lg border border-white/10 bg-obsidian-950 px-3 py-2 text-sm text-white focus:border-gold-400/50 focus:outline-none"
                        >
                            <option value="">— без пункту —</option>
                            <option v-for="r in rules" :key="r.code" :value="r.code">{{ r.code }} — {{ r.text }}</option>
                        </select>
                        <p v-if="selectedRule?.penalty" class="mt-1 text-[11px] text-amber-200/70">За правилами: {{ selectedRule.penalty }}</p>
                    </div>

                    <div v-if="form.type === 'fine'">
                        <label class="text-xs text-white/50">Сума штрафу, ₴</label>
                        <input
                            v-model="form.amount"
                            type="number"
                            min="1"
                            placeholder="напр. 50000"
                            class="mt-1 w-full rounded-lg border border-white/10 bg-obsidian-950 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold-400/50 focus:outline-none"
                        />
                    </div>

                    <div class="lg:col-span-2">
                        <label class="text-xs text-white/50">Причина (побачить учасник)</label>
                        <textarea
                            v-model="form.reason"
                            rows="2"
                            placeholder="Що саме сталося, коли, докази…"
                            class="mt-1 w-full rounded-lg border border-white/10 bg-obsidian-950 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold-400/50 focus:outline-none"
                        ></textarea>
                    </div>
                </div>

                <button
                    type="button"
                    :disabled="busy || !form.user || !form.reason.trim() || (form.type === 'fine' && !form.amount)"
                    class="mt-4 rounded-full border border-gold-400/50 bg-gold-400/10 px-6 py-2 text-sm font-medium text-gold-200 transition hover:bg-gold-400/20 disabled:opacity-40"
                    @click="issue"
                >
                    {{ busy ? 'Видаю…' : 'Видати' }}
                </button>
            </div>

            <!-- Список -->
            <div class="glass-panel p-6">
                <div class="flex flex-wrap items-center gap-2">
                    <button
                        v-for="t in statusTabs"
                        :key="t.key"
                        type="button"
                        class="rounded-full border px-3 py-1.5 text-xs"
                        :class="filters.status === t.key ? 'border-gold-400/60 bg-gold-400/15 text-gold-200' : 'border-white/10 text-white/60 hover:border-white/30'"
                        @click="setStatus(t.key)"
                    >
                        {{ t.label }}
                    </button>
                    <button v-if="filters.user" type="button" class="ml-auto text-xs text-white/40 hover:text-white/70" @click="clearUser">
                        ✕ Лише один учасник — показати всіх
                    </button>
                </div>

                <div class="mt-5 space-y-3">
                    <div v-for="p in list" :key="p.id" class="rounded-xl border border-white/10 bg-obsidian-900/40 p-4">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                            <div class="min-w-0">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="rounded-full border px-2.5 py-0.5 text-xs" :class="typeStyle[p.type]">{{ p.emoji }} {{ p.typeLabel }}</span>
                                    <span v-if="p.type === 'fine'" class="text-sm text-amber-200">{{ money(p.amount) }}</span>
                                    <span v-if="p.originalAmount" class="text-xs text-white/30 line-through">{{ money(p.originalAmount) }}</span>
                                    <span class="text-sm text-white">{{ p.user?.name }}</span>
                                    <span v-if="p.ruleCode" class="text-xs text-gold-300"><span class="font-mono">п. {{ p.ruleCode }}</span><template v-if="p.ruleLabel"> · {{ p.ruleLabel }}</template></span>
                                    <span v-if="p.auto" class="text-[11px] text-white/40">авто</span>
                                </div>
                                <p class="mt-2 text-sm text-white/70 [overflow-wrap:anywhere]">{{ p.reason }}</p>
                                <p class="mt-1 text-[11px] text-white/35">
                                    {{ p.author?.name }} · {{ fmt(p.createdAt) }}
                                    <template v-if="p.dueAt && ['active', 'overdue'].includes(p.status)"> · сплатити до {{ fmt(p.dueAt) }}</template>
                                    <template v-if="p.expiresAt && p.status === 'active'"> · згорить {{ fmt(p.expiresAt) }}</template>
                                    <template v-if="p.resolutionNote"> · «{{ p.resolutionNote }}»</template>
                                </p>
                            </div>
                            <div class="flex shrink-0 flex-col items-end gap-2">
                                <span class="text-xs" :class="statusStyle[p.status]">
                                    {{ p.statusLabel }}<template v-if="p.status === 'paid' && p.paidVia === 'bank'"> з рахунку</template>
                                </span>
                                <div class="flex gap-2">
                                    <button
                                        v-if="['active', 'overdue'].includes(p.status) && p.type === 'fine'"
                                        :disabled="actionBusy === p.id"
                                        class="rounded-full border border-emerald-400/40 px-3 py-1 text-xs text-emerald-200 hover:border-emerald-300 disabled:opacity-40"
                                        @click="markPaid(p)"
                                    >
                                        Сплачено
                                    </button>
                                    <button
                                        v-if="['active', 'overdue'].includes(p.status)"
                                        :disabled="actionBusy === p.id"
                                        class="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60 hover:border-white/40 disabled:opacity-40"
                                        @click="revoke(p)"
                                    >
                                        Скасувати
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p v-if="!list.length" class="py-8 text-center text-sm text-white/30">Нічого немає.</p>
                </div>
            </div>
        </div>

        <div class="fixed bottom-6 right-6 z-50 space-y-2">
            <div
                v-for="t in toasts"
                :key="t.id"
                class="rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur"
                :class="t.ok ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100' : 'border-red-400/30 bg-red-500/15 text-red-100'"
            >
                {{ t.message }}
            </div>
        </div>
    </AdminLayout>
</template>
