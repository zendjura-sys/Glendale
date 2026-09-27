<script setup>
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import { Head, Link, router } from '@inertiajs/vue3';
import { computed, ref, watch } from 'vue';

const props = defineProps({
    summary: { type: Object, default: () => ({}) },
    penalties: { type: Array, default: () => [] },
    bankAvailable: { type: Boolean, default: false },
});

const typeStyle = {
    remark: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
    fine: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
    reprimand: 'border-orange-500/45 bg-orange-500/10 text-orange-200',
    demotion: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200',
    kick: 'border-red-500/50 bg-red-500/10 text-red-200',
    blacklist: 'border-red-700/70 bg-red-900/40 text-red-100',
};

const list = ref([...props.penalties]);
watch(() => props.penalties, (v) => (list.value = [...v]));

const open = computed(() => list.value.filter((p) => ['active', 'overdue'].includes(p.status)));
const history = computed(() => list.value.filter((p) => !['active', 'overdue'].includes(p.status)));

const message = ref(null);
const payingId = ref(null);

async function pay(p) {
    if (!window.confirm(`Сплатити штраф ${money(p.amount)} з вашого рахунку в банку родини?`)) return;
    payingId.value = p.id;
    message.value = null;
    try {
        const { data } = await window.axios.post(route('discipline.pay', p.id));
        list.value = list.value.map((x) => (x.id === p.id ? data.data.penalty : x));
        message.value = { ok: true, text: data.message };
        router.reload({ only: ['summary'] });
    } catch (e) {
        const errors = e.response?.data?.errors;
        message.value = { ok: false, text: (errors && Object.values(errors)[0]?.[0]) || e.response?.data?.message || 'Не вдалося сплатити.' };
    } finally {
        payingId.value = null;
    }
}

function money(n) {
    return (n ?? 0).toLocaleString('uk-UA').replace(/,/g, ' ') + '₴';
}
function fmt(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function dots(count, limit) {
    return Array.from({ length: limit }, (_, i) => i < count);
}
</script>

<template>
    <Head title="Мої покарання" />

    <AuthenticatedLayout>
        <template #header>
            <h2 class="font-display text-2xl font-light text-white">Мої покарання</h2>
        </template>

        <div class="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
            <!-- Стан -->
            <div class="grid gap-3 sm:grid-cols-3">
                <div class="glass-panel p-5">
                    <p class="text-xs text-white/40">Зауваження</p>
                    <div class="mt-2 flex items-center gap-1.5">
                        <span v-for="(on, i) in dots(summary.remarks, summary.remarksLimit)" :key="i" class="h-3 w-3 rounded-full border border-sky-400/50" :class="on ? 'bg-sky-400' : ''"></span>
                        <span class="ml-2 text-lg text-sky-200">{{ summary.remarks }}/{{ summary.remarksLimit }}</span>
                    </div>
                    <p class="mt-2 text-[11px] text-white/35">3 зауваження = догана</p>
                </div>
                <div class="glass-panel p-5">
                    <p class="text-xs text-white/40">Догани</p>
                    <div class="mt-2 flex items-center gap-1.5">
                        <span v-for="(on, i) in dots(summary.reprimands, summary.reprimandsLimit)" :key="i" class="h-3 w-3 rounded-full border border-orange-500/60" :class="on ? 'bg-orange-500' : ''"></span>
                        <span class="ml-2 text-lg text-orange-200">{{ summary.reprimands }}/{{ summary.reprimandsLimit }}</span>
                    </div>
                    <p class="mt-2 text-[11px]" :class="summary.bonusHalved ? 'text-orange-300/80' : 'text-white/35'">
                        {{ summary.bonusHalved ? 'Премія зараз нараховується на 50%' : '3/3 — виключення' }}
                    </p>
                </div>
                <div class="glass-panel p-5">
                    <p class="text-xs text-white/40">До сплати</p>
                    <p class="mt-2 text-lg" :class="summary.unpaidFinesAmount ? 'text-amber-200' : 'text-white/60'">{{ money(summary.unpaidFinesAmount) }}</p>
                    <p class="mt-2 text-[11px] text-white/35">{{ summary.unpaidFines ? `Штрафів: ${summary.unpaidFines}` : 'Несплачених штрафів немає' }}</p>
                </div>
            </div>

            <p v-if="message" class="rounded-xl border px-4 py-3 text-sm" :class="message.ok ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' : 'border-red-400/30 bg-red-500/10 text-red-100'">
                {{ message.text }}
            </p>

            <!-- Активні -->
            <div class="glass-panel p-6 sm:p-8">
                <h3 class="font-display text-lg font-normal text-white">Діють зараз</h3>
                <div class="mt-5 space-y-3">
                    <div v-for="p in open" :key="p.id" class="rounded-xl border bg-obsidian-900/40 p-4" :class="p.status === 'overdue' ? 'border-red-400/40' : 'border-white/10'">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                            <div class="min-w-0">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="rounded-xl border px-2.5 py-0.5 text-xs" :class="typeStyle[p.type]">{{ p.emoji }} {{ p.typeLabel }}</span>
                                    <span v-if="p.type === 'fine'" class="text-base text-amber-200">{{ money(p.amount) }}</span>
                                    <span v-if="p.originalAmount" class="text-xs text-white/30 line-through">{{ money(p.originalAmount) }}</span>
                                    <Link v-if="p.ruleCode && route().has('rules')" :href="route('rules')" class="text-xs text-gold-300 hover:underline"><span class="font-mono">п. {{ p.ruleCode }}</span><template v-if="p.ruleLabel"> · {{ p.ruleLabel }}</template></Link>
                                </div>
                                <p class="mt-2 text-sm text-white/75 [overflow-wrap:anywhere]">{{ p.reason }}</p>
                                <p class="mt-1 text-[11px] text-white/35">
                                    Видав(-ла): {{ p.author?.name ?? 'система' }} · {{ fmt(p.createdAt) }}
                                    <template v-if="p.type === 'fine'"> · сплатити до {{ fmt(p.dueAt) }}</template>
                                    <template v-if="p.expiresAt"> · згорить {{ fmt(p.expiresAt) }}, якщо не буде нових порушень</template>
                                </p>
                                <p v-if="p.status === 'overdue'" class="mt-2 text-xs text-red-300">Строк оплати минув — сума подвоєна, видано догану. Сплатіть якнайшвидше.</p>
                            </div>
                            <button
                                v-if="p.type === 'fine' && bankAvailable"
                                :disabled="payingId === p.id"
                                class="shrink-0 rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-2 text-xs font-medium text-amber-100 hover:bg-amber-400/20 disabled:opacity-40"
                                @click="pay(p)"
                            >
                                {{ payingId === p.id ? 'Оплата…' : `Сплатити з рахунку ${money(p.amount)}` }}
                            </button>
                        </div>
                    </div>
                    <p v-if="!open.length" class="py-6 text-center text-sm text-white/40">Активних покарань немає — так тримати 👑</p>
                </div>
            </div>

            <!-- Історія -->
            <div v-if="history.length" class="glass-panel p-6 sm:p-8">
                <h3 class="font-display text-lg font-normal text-white">Історія</h3>
                <div class="mt-5 space-y-2">
                    <div v-for="p in history" :key="p.id" class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2 text-sm">
                        <div class="min-w-0">
                            <span class="mr-2 rounded-xl border px-2 py-0.5 text-[11px]" :class="typeStyle[p.type]">{{ p.typeLabel }}</span>
                            <span v-if="p.type === 'fine'" class="mr-2 text-white/60">{{ money(p.amount) }}</span>
                            <span class="text-white/55 [overflow-wrap:anywhere]">{{ p.reason }}</span>
                        </div>
                        <span class="shrink-0 text-[11px] text-white/35">{{ p.statusLabel }} · {{ fmt(p.resolvedAt || p.paidAt || p.createdAt) }}</span>
                    </div>
                </div>
            </div>

            <p class="text-center text-xs text-white/35">
                Шкала покарань і строки — у розділі
                <Link v-if="route().has('rules')" :href="route('rules')" class="text-gold-300 hover:underline">«Правила»</Link>.
                Оскаржити покарання можна протягом 48 годин особисто Директору.
            </p>
        </div>
    </AuthenticatedLayout>
</template>
