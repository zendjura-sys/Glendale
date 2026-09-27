<script setup>
import { Head, Link, useForm } from '@inertiajs/vue3';
import { ref, watch } from 'vue';
import MemberCard from '@/Components/MemberCard.vue';

const props = defineProps({
    payouts: { type: Object, required: true },
    cumulativeInvestment: { type: Number, default: 0 },
    tiers: { type: Array, default: () => [] },
    transactions: { type: Array, default: () => [] },
    deposits: { type: Array, default: () => [] },
    cashRequests: { type: Array, default: () => [] },
    depositSettings: { type: Object, required: true },
    card: { type: Object, required: true },
});

function fmt(amount) {
    return new Intl.NumberFormat('uk-UA').format(amount ?? 0) + '₴';
}

function fmtDate(d) {
    return new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(d) {
    return new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ---------- переказ ---------- */
const transferForm = useForm({ recipient_id: null, amount: '', note: '' });
const recipientQuery = ref('');
const recipientMatches = ref([]);
const recipientSelected = ref(null);
let recipientSearchTimer = null;

watch(recipientQuery, (q) => {
    recipientSelected.value = null;
    transferForm.recipient_id = null;
    clearTimeout(recipientSearchTimer);

    if (q.trim().length < 2) {
        recipientMatches.value = [];
        return;
    }
    recipientSearchTimer = setTimeout(async () => {
        const { data } = await window.axios.get(route('bonuses.recipients.search'), { params: { q } });
        recipientMatches.value = data.data.members;
    }, 300);
});

function pickRecipient(member) {
    recipientSelected.value = member;
    transferForm.recipient_id = member.id;
    recipientQuery.value = member.name;
    recipientMatches.value = [];
}

function submitTransfer() {
    transferForm.post(route('bonuses.transfer'), {
        preserveScroll: true,
        onSuccess: () => {
            transferForm.reset();
            recipientQuery.value = '';
            recipientSelected.value = null;
        },
    });
}

/* ---------- депозити ---------- */
const depositForm = useForm({ amount: '' });
function submitDeposit() {
    depositForm.post(route('bonuses.deposits.store'), {
        preserveScroll: true,
        onSuccess: () => depositForm.reset(),
    });
}

const withdrawingDeposit = ref(null);
function withdrawDeposit(deposit) {
    if (!confirm(`Зняти депозит достроково? Відсоток (${fmt(deposit.projected_payout - deposit.amount)}) буде втрачено — повернеться лише ${fmt(deposit.amount)}.`)) return;
    withdrawingDeposit.value = deposit.id;
    window.axios.post(route('bonuses.deposits.withdraw', deposit.id))
        .then(() => window.location.reload())
        .finally(() => { withdrawingDeposit.value = null; });
}

function depositStatusLabel(d) {
    if (d.status === 'active') return 'активний';
    if (d.status === 'completed') return 'дозрів';
    return 'знято достроково';
}

/* ---------- готівка на руки ---------- */
const cashForm = useForm({ amount: '' });
function submitCashRequest() {
    if (!confirm(`Запросити видачу ${fmt(cashForm.amount)} готівкою на руки? Сума одразу заморозиться на балансі, а замовам і лідеру прийде сповіщення.`)) return;
    cashForm.post(route('bonuses.cash-requests.store'), {
        preserveScroll: true,
        onSuccess: () => cashForm.reset(),
    });
}

function cashStatusLabel(r) {
    if (r.status === 'pending') return 'очікує';
    if (r.status === 'completed') return 'видано';
    return 'скасовано';
}

const transactionIcon = {
    payout: '💰',
    manual_award: '🎁',
    transfer: '↔',
    deposit_open: '🔒',
    deposit_close: '🔓',
    cash_request: '🤝',
    fine: '🧾',
};
</script>

<template>
    <Head title="Банк" />

    <div class="min-h-screen bg-obsidian-950 font-sans text-white/80">
        <header class="border-b border-white/5 bg-obsidian-900/60 backdrop-blur-md">
            <div class="mx-auto max-w-3xl px-6 py-6">
                <Link :href="route('dashboard')" class="text-xs uppercase tracking-widest text-white/40 hover:text-gold-300">
                    ← Кабінет
                </Link>
                <h1 class="font-display mt-2 text-3xl font-light text-white">Банк</h1>
                <p class="mt-1 text-sm text-white/40">Премії, перекази та депозити родини — все в одному місці.</p>
            </div>
        </header>

        <div class="mx-auto max-w-3xl px-6 py-10">
            <!-- ================= КАРТКА УЧАСНИКА ================= -->
            <div class="mb-8">
                <MemberCard :number="card.number" :number-full="card.numberFull" :name="card.name" :amount="card.balance" />
            </div>

            <!-- ================= ВИПИСКА ПО РАХУНКУ ================= -->
            <section v-reveal v-glow class="glass-panel mb-8 overflow-hidden">
                <h2 class="p-6 pb-4 font-display text-lg text-white">Виписка по рахунку</h2>
                <div
                    v-for="(t, i) in transactions"
                    :key="i"
                    class="border-b border-white/5 px-6 py-4 last:border-0"
                    :class="{ 'opacity-40': t.reversed }"
                >
                    <div class="flex items-start justify-between gap-3">
                        <span class="text-sm text-white/60">
                            <span class="mr-1">{{ transactionIcon[t.kind] ?? '•' }}</span>
                            {{ t.label }}
                            <span v-if="t.detail" class="text-white/40"> — {{ t.detail }}</span>
                            <span v-if="t.reversed" class="ml-2 text-[10px] uppercase tracking-wide text-ember-500/70">скасовано</span>
                        </span>
                        <span
                            class="shrink-0 text-lg font-semibold"
                            :class="{
                                'text-emerald-400/80': t.sign === '+',
                                'text-ember-500/80': t.sign === '−',
                                'text-white/30': t.sign === '·',
                            }"
                        >
                            {{ t.sign !== '·' ? t.sign : '' }}{{ fmt(t.amount) }}
                        </span>
                    </div>
                    <p class="mt-1 text-[11px] text-white/30">{{ fmtDateTime(t.at) }}</p>
                </div>
                <div v-if="transactions.length === 0" class="px-6 py-12 text-center text-white/30">
                    Операцій ще не було
                </div>
            </section>

            <!-- ================= ПЕРЕКАЗ ================= -->
            <section v-reveal v-glow class="glass-panel mb-8 p-6">
                <h2 class="mb-1 font-display text-lg text-white">Переказ на картку</h2>
                <p class="mb-4 text-sm text-white/40">З вашого балансу — {{ fmt(card.balance) }} доступно.</p>

                <form class="space-y-4" @submit.prevent="submitTransfer">
                    <div class="relative">
                        <input
                            v-model="recipientQuery"
                            type="text"
                            placeholder="Кому (ім'я учасника)"
                            class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white"
                        />
                        <div v-if="recipientMatches.length" class="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-obsidian-900 shadow-xl">
                            <button
                                v-for="m in recipientMatches"
                                :key="m.id"
                                type="button"
                                class="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5"
                                @click="pickRecipient(m)"
                            >
                                {{ m.name }}
                            </button>
                        </div>
                        <p v-if="recipientSelected" class="mt-1 text-xs text-emerald-400/70">Отримувач: {{ recipientSelected.name }}</p>
                        <p v-if="transferForm.errors.recipient_id" class="mt-1 text-xs text-ember-500">{{ transferForm.errors.recipient_id }}</p>
                    </div>

                    <div class="grid gap-3 sm:grid-cols-2">
                        <div>
                            <input v-model.number="transferForm.amount" type="number" min="1" :max="card.balance" placeholder="Сума, ₴" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white" />
                            <p v-if="transferForm.errors.amount" class="mt-1 text-xs text-ember-500">{{ transferForm.errors.amount }}</p>
                        </div>
                        <input v-model="transferForm.note" type="text" placeholder="Повідомлення (необов'язково)" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white" />
                    </div>

                    <button
                        type="submit"
                        :disabled="transferForm.processing || !transferForm.recipient_id"
                        class="rounded-xl border border-gold-400/40 px-5 py-2 text-xs font-medium uppercase tracking-widest text-gold-200 hover:border-gold-300 disabled:opacity-40"
                    >
                        Переказати
                    </button>
                </form>
            </section>

            <!-- ================= ДЕПОЗИТИ ================= -->
            <section v-reveal v-glow class="glass-panel mb-8 p-6">
                <h2 class="mb-1 font-display text-lg text-white">Депозити</h2>
                <p v-if="depositSettings.enabled" class="mb-4 text-sm text-white/40">
                    Заморозьте частину балансу на {{ depositSettings.termDays }} {{ depositSettings.termDays === 1 ? 'день' : 'днів' }} — поверніть з +{{ depositSettings.rate }}%.
                    Мінімум — {{ fmt(depositSettings.minAmount) }}.
                </p>
                <p v-else class="mb-4 text-sm text-white/30">Депозити тимчасово вимкнено адміністрацією.</p>

                <form v-if="depositSettings.enabled" class="flex flex-wrap items-start gap-3" @submit.prevent="submitDeposit">
                    <div>
                        <input v-model.number="depositForm.amount" type="number" :min="depositSettings.minAmount" :max="card.balance" placeholder="Сума, ₴" class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white" />
                        <p v-if="depositForm.errors.amount" class="mt-1 text-xs text-ember-500">{{ depositForm.errors.amount }}</p>
                    </div>
                    <button
                        type="submit"
                        :disabled="depositForm.processing || !depositForm.amount"
                        class="rounded-xl border border-gold-400/40 px-5 py-2 text-xs font-medium uppercase tracking-widest text-gold-200 hover:border-gold-300 disabled:opacity-40"
                    >
                        Відкрити депозит
                    </button>
                </form>

                <div v-if="deposits.length" class="mt-5 space-y-2">
                    <div v-for="d in deposits" :key="d.id" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-4 py-2.5">
                        <div>
                            <span class="font-medium text-white">{{ fmt(d.amount) }}</span>
                            <span class="ml-2 text-sm text-white/40">+{{ d.interest_rate }}%</span>
                            <span
                                class="ml-2 rounded-xl px-2 py-0.5 text-[10px] uppercase tracking-wide"
                                :class="{
                                    'bg-gold-400/10 text-gold-300': d.status === 'active',
                                    'bg-emerald-400/10 text-emerald-300': d.status === 'completed',
                                    'bg-white/5 text-white/40': d.status === 'withdrawn',
                                }"
                            >
                                {{ depositStatusLabel(d) }}
                            </span>
                            <p class="mt-1 text-xs text-white/30">
                                <template v-if="d.status === 'active'">дозріє {{ fmtDateTime(d.matures_at) }} → {{ fmt(d.projected_payout) }}</template>
                                <template v-else>закрито {{ fmtDateTime(d.closed_at) }} → повернуто {{ fmt(d.payout_amount) }}</template>
                            </p>
                        </div>
                        <button
                            v-if="d.status === 'active'"
                            :disabled="withdrawingDeposit === d.id"
                            class="shrink-0 rounded-xl border border-white/15 px-3 py-1 text-xs text-white/50 hover:border-ember-500/40 hover:text-ember-400 disabled:opacity-40"
                            @click="withdrawDeposit(d)"
                        >
                            Зняти достроково
                        </button>
                    </div>
                </div>
            </section>

            <!-- ================= ГОТІВКА НА РУКИ ================= -->
            <section v-reveal v-glow class="glass-panel mb-8 p-6">
                <h2 class="mb-1 font-display text-lg text-white">Отримати готівку на руки</h2>
                <p class="mb-4 text-sm text-white/40">
                    Сума одразу заморозиться на балансі, а замовам і лідеру прийде сповіщення — узгодьте з ними передачу.
                </p>

                <form class="flex flex-wrap items-start gap-3" @submit.prevent="submitCashRequest">
                    <div>
                        <input v-model.number="cashForm.amount" type="number" min="1" :max="card.balance" placeholder="Сума, ₴" class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white" />
                        <p v-if="cashForm.errors.amount" class="mt-1 text-xs text-ember-500">{{ cashForm.errors.amount }}</p>
                    </div>
                    <button
                        type="submit"
                        :disabled="cashForm.processing || !cashForm.amount"
                        class="rounded-xl border border-gold-400/40 px-5 py-2 text-xs font-medium uppercase tracking-widest text-gold-200 hover:border-gold-300 disabled:opacity-40"
                    >
                        Запросити готівку
                    </button>
                </form>

                <div v-if="cashRequests.length" class="mt-5 space-y-2">
                    <div v-for="r in cashRequests" :key="r.id" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-4 py-2.5">
                        <div>
                            <span class="font-medium text-white">{{ fmt(r.amount) }}</span>
                            <span
                                class="ml-2 rounded-xl px-2 py-0.5 text-[10px] uppercase tracking-wide"
                                :class="{
                                    'bg-gold-400/10 text-gold-300': r.status === 'pending',
                                    'bg-emerald-400/10 text-emerald-300': r.status === 'completed',
                                    'bg-white/5 text-white/40': r.status === 'cancelled',
                                }"
                            >
                                {{ cashStatusLabel(r) }}
                            </span>
                            <p class="mt-1 text-xs text-white/30">{{ fmtDateTime(r.created_at) }}</p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- ================= ІНВЕСТИЦІЙНІ ТІРИ ================= -->
            <section v-if="tiers.length" v-reveal v-glow class="glass-panel mb-8 p-6">
                <h2 class="mb-1 font-display text-lg text-white">Інвестиційні досягнення</h2>
                <p class="mb-4 text-sm text-white/40">Кумулятивно вкладено: {{ fmt(cumulativeInvestment) }}</p>
                <div class="space-y-2">
                    <div
                        v-for="tier in tiers"
                        :key="tier.id"
                        class="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2.5"
                        :class="tier.earned ? 'border-gold-400/30 bg-gold-400/[0.04]' : 'border-white/10'"
                    >
                        <div>
                            <span class="font-medium" :class="tier.earned ? 'text-gold-200' : 'text-white'">
                                {{ tier.earned ? '✓' : '' }} {{ tier.label }}
                            </span>
                            <span class="ml-3 text-sm text-white/40">від {{ fmt(tier.threshold_amount) }} → +{{ fmt(tier.bonus_amount) }}</span>
                        </div>
                        <span v-if="!tier.earned && cumulativeInvestment < tier.threshold_amount" class="shrink-0 whitespace-nowrap text-xs text-white/30">
                            лишилось {{ fmt(tier.threshold_amount - cumulativeInvestment) }}
                        </span>
                    </div>
                </div>
            </section>

            <div v-if="payouts.links?.length > 3" class="mt-6 flex flex-wrap gap-2">
                <Link
                    v-for="link in payouts.links"
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
        </div>
    </div>
</template>
