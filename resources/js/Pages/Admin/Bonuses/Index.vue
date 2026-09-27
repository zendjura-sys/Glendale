<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { Head, Link, useForm, router } from '@inertiajs/vue3';
import { ref, watch } from 'vue';

const props = defineProps({
    settings: { type: Object, required: true },
    tiers: { type: Array, required: true },
    payouts: { type: Object, required: true },
    filters: { type: Object, default: () => ({ from: '', to: '', paid: '' }) },
    manualAwards: { type: Array, default: () => [] },
    transfers: { type: Array, default: () => [] },
    deposits: { type: Array, default: () => [] },
    cashRequests: { type: Array, default: () => [] },
});

const filterForm = ref({ from: props.filters.from, to: props.filters.to, paid: props.filters.paid });
function applyFilters() {
    router.get(route('admin.bonuses.index'), filterForm.value, { preserveState: true, preserveScroll: true });
}
function resetFilters() {
    filterForm.value = { from: '', to: '', paid: '' };
    router.get(route('admin.bonuses.index'), {}, { preserveState: true, preserveScroll: true });
}

function describeFailure(e, fallback) {
    const serverMessage = e.response?.data?.message;
    if (serverMessage) return serverMessage;
    if (!e.response) return `${fallback} (немає відповіді сервера — перевірте з'єднання)`;
    if (e.response.status === 403) return `${fallback} (немає прав)`;
    return `${fallback} (код ${e.response.status})`;
}

function fmt(amount) {
    return new Intl.NumberFormat('uk-UA').format(amount ?? 0) + '₴';
}

function fmtDateTime(d) {
    return new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDate(d) {
    return new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ------------------------- Налаштування ставок ------------------------- */

const settingsForm = useForm({
    bizwar_base_rate: props.settings.bizwar_base_rate,
    contract_light_rate: props.settings.contract_light_rate,
    contract_medium_rate: props.settings.contract_medium_rate,
    contract_heavy_rate: props.settings.contract_heavy_rate,
    streak_threshold: props.settings.streak_threshold,
    streak_bonus_amount: props.settings.streak_bonus_amount,
    contracts_count_threshold: props.settings.contracts_count_threshold,
    contracts_count_bonus_amount: props.settings.contracts_count_bonus_amount,
    min_digest_amount: props.settings.min_digest_amount,
});

function saveSettings() {
    settingsForm.put(route('admin.bonuses.settings.update'), { preserveScroll: true });
}

/* ------------------------- Інвестиційні тіри ------------------------- */

const tierForm = useForm({ label: '', threshold_amount: '', bonus_amount: '' });
function addTier() {
    tierForm.post(route('admin.bonuses.tiers.store'), {
        preserveScroll: true,
        onSuccess: () => tierForm.reset(),
    });
}

function removeTier(tier) {
    if (!confirm(`Видалити тір «${tier.label}»?`)) return;
    router.delete(route('admin.bonuses.tiers.destroy', tier.id), { preserveScroll: true });
}

/* ------------------------- Виплати ------------------------- */

const markingPaid = ref(null);
async function markPaid(payout) {
    markingPaid.value = payout.id;
    try {
        await window.axios.post(route('admin.bonuses.payouts.mark-paid', payout.id));
        payout.paid = true;
    } catch (e) {
        alert(describeFailure(e, 'Не вдалося позначити виплаченим'));
    } finally {
        markingPaid.value = null;
    }
}

const running = ref(false);
async function runNow() {
    if (!confirm('Порахувати поточний тиждень і надіслати дайджест у Telegram зараз?')) return;
    running.value = true;
    try {
        await window.axios.post(route('admin.bonuses.run-now'));
        router.reload({ only: ['payouts'] });
    } catch (e) {
        alert(describeFailure(e, 'Не вдалося запустити розрахунок'));
    } finally {
        running.value = false;
    }
}

/* ------------------------- Ручна виплата ------------------------- */

const manualForm = useForm({ user_id: null, amount: '', note: '' });
const memberQuery = ref('');
const memberMatches = ref([]);
const memberSelected = ref(null);
let memberSearchTimer = null;

watch(memberQuery, (q) => {
    memberSelected.value = null;
    manualForm.user_id = null;
    clearTimeout(memberSearchTimer);

    if (q.trim().length < 2) {
        memberMatches.value = [];
        return;
    }
    memberSearchTimer = setTimeout(async () => {
        const { data } = await window.axios.get(route('admin.bonuses.members.search'), { params: { q } });
        memberMatches.value = data.data.members;
    }, 300);
});

function pickMember(member) {
    memberSelected.value = member;
    manualForm.user_id = member.id;
    memberQuery.value = member.name;
    memberMatches.value = [];
}

function submitManualAward() {
    manualForm.post(route('admin.bonuses.manual.store'), {
        preserveScroll: true,
        onSuccess: () => {
            manualForm.reset();
            memberQuery.value = '';
            memberSelected.value = null;
        },
    });
}

function removeManualAward(award) {
    if (!confirm(`Видалити ручну премію «${award.user?.name}» на ${fmt(award.amount)}?`)) return;
    router.delete(route('admin.bonuses.manual.destroy', award.id), { preserveScroll: true });
}

/* ------------------------- Налаштування банку ------------------------- */

const bankForm = useForm({
    transfer_enabled: props.settings.transfer_enabled,
    transfer_daily_limit: props.settings.transfer_daily_limit,
    transfer_min_amount: props.settings.transfer_min_amount,
    deposit_enabled: props.settings.deposit_enabled,
    deposit_interest_rate: props.settings.deposit_interest_rate,
    deposit_min_amount: props.settings.deposit_min_amount,
    deposit_term_days: props.settings.deposit_term_days,
});

function saveBankSettings() {
    bankForm.put(route('admin.bonuses.bank-settings.update'), { preserveScroll: true });
}

/* ------------------------- Перекази: скасування ------------------------- */

const reversingTransfer = ref(null);
async function reverseTransfer(transfer) {
    if (!confirm(`Скасувати переказ ${fmt(transfer.amount)} від «${transfer.sender?.name}» до «${transfer.recipient?.name}»? Кошти повернуться на баланс відправника.`)) return;
    reversingTransfer.value = transfer.id;
    try {
        await window.axios.post(route('admin.bonuses.transfers.reverse', transfer.id));
        transfer.reversed_at = new Date().toISOString();
    } catch (e) {
        alert(describeFailure(e, 'Не вдалося скасувати переказ'));
    } finally {
        reversingTransfer.value = null;
    }
}

/* ------------------------- Запити на готівку ------------------------- */

const resolvingCashRequest = ref(null);
async function completeCashRequest(r) {
    if (!confirm(`Підтвердити, що ${fmt(r.amount)} видано на руки учаснику «${r.user?.name}»?`)) return;
    resolvingCashRequest.value = r.id;
    try {
        await window.axios.post(route('admin.bonuses.cash-requests.complete', r.id));
        r.status = 'completed';
    } catch (e) {
        alert(describeFailure(e, 'Не вдалося підтвердити видачу'));
    } finally {
        resolvingCashRequest.value = null;
    }
}

async function cancelCashRequest(r) {
    if (!confirm(`Скасувати запит на ${fmt(r.amount)} від «${r.user?.name}»? Кошти повернуться на його баланс.`)) return;
    resolvingCashRequest.value = r.id;
    try {
        await window.axios.post(route('admin.bonuses.cash-requests.cancel', r.id));
        r.status = 'cancelled';
    } catch (e) {
        alert(describeFailure(e, 'Не вдалося скасувати запит'));
    } finally {
        resolvingCashRequest.value = null;
    }
}
</script>

<template>
    <Head title="Банк" />

    <AdminLayout title="Банк">
        <div class="mb-6 flex justify-end">
            <button
                :disabled="running"
                class="rounded-full border border-gold-400/40 px-5 py-2 text-xs font-medium uppercase tracking-widest text-gold-200 transition-all hover:border-gold-300 disabled:opacity-40"
                @click="runNow"
            >
                {{ running ? 'Рахую…' : '⟳ Розрахувати зараз' }}
            </button>
        </div>

        <!-- ================= СТАВКИ ================= -->
        <section class="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 class="mb-4 font-display text-lg text-white">Ставки й пороги</h2>
            <form class="grid gap-5 sm:grid-cols-2" @submit.prevent="saveSettings">
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Бізвар — ставка за 100% перемог (₴)</label>
                    <input v-model.number="settingsForm.bizwar_base_rate" type="number" min="0" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                    <p class="mt-1 text-[11px] text-white/30">Виплата = ставка × частка перемог за тиждень (90% перемог → 0.9 × ставка)</p>
                </div>
                <div></div>

                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Контракт — легкий (₴)</label>
                    <input v-model.number="settingsForm.contract_light_rate" type="number" min="0" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                </div>
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Контракт — середній (₴)</label>
                    <input v-model.number="settingsForm.contract_medium_rate" type="number" min="0" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                </div>
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Контракт — важкий (₴)</label>
                    <input v-model.number="settingsForm.contract_heavy_rate" type="number" min="0" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                </div>
                <div></div>

                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Бонус за серію перемог — поріг (к-сть поспіль)</label>
                    <input v-model.number="settingsForm.streak_threshold" type="number" min="1" placeholder="вимкнено" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                </div>
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Бонус за серію перемог — сума (₴)</label>
                    <input v-model.number="settingsForm.streak_bonus_amount" type="number" min="0" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                </div>

                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Бонус за к-сть контрактів за тиждень — поріг</label>
                    <input v-model.number="settingsForm.contracts_count_threshold" type="number" min="1" placeholder="вимкнено" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                </div>
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Бонус за к-сть контрактів — сума (₴)</label>
                    <input v-model.number="settingsForm.contracts_count_bonus_amount" type="number" min="0" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                </div>

                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Мінімум для дайджесту в Telegram (₴)</label>
                    <input v-model.number="settingsForm.min_digest_amount" type="number" min="0" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                </div>

                <div class="sm:col-span-2">
                    <button
                        type="submit"
                        :disabled="settingsForm.processing"
                        class="rounded-full bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 px-6 py-2.5 text-sm font-semibold uppercase tracking-widest text-obsidian-950 shadow-gold transition-transform hover:scale-[1.03] disabled:opacity-40"
                    >
                        Зберегти
                    </button>
                </div>
            </form>
        </section>

        <!-- ================= ІНВЕСТИЦІЙНІ ТІРИ ================= -->
        <section class="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 class="mb-4 font-display text-lg text-white">Досягнення за інвестиції</h2>

            <div v-if="tiers.length" class="mb-5 space-y-2">
                <div v-for="tier in tiers" :key="tier.id" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-4 py-2.5">
                    <div>
                        <span class="font-medium text-white">{{ tier.label }}</span>
                        <span class="ml-3 text-sm text-white/40">від {{ fmt(tier.threshold_amount) }} кумулятивно → +{{ fmt(tier.bonus_amount) }}</span>
                    </div>
                    <button class="shrink-0 text-xs text-ember-500/70 hover:text-ember-500" @click="removeTier(tier)">Видалити</button>
                </div>
            </div>
            <p v-else class="mb-5 text-sm text-white/30">Тірів ще немає.</p>

            <form class="grid gap-3 sm:grid-cols-4" @submit.prevent="addTier">
                <input v-model="tierForm.label" type="text" placeholder="Назва (напр. Інвестор I)" class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white sm:col-span-2" />
                <input v-model.number="tierForm.threshold_amount" type="number" min="1" placeholder="Поріг, ₴" class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white" />
                <input v-model.number="tierForm.bonus_amount" type="number" min="0" placeholder="Премія, ₴" class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white" />
                <div class="sm:col-span-4">
                    <button
                        type="submit"
                        :disabled="tierForm.processing"
                        class="rounded-full border border-gold-400/40 px-5 py-2 text-xs font-medium uppercase tracking-widest text-gold-200 hover:border-gold-300 disabled:opacity-40"
                    >
                        + Додати тір
                    </button>
                </div>
            </form>
        </section>

        <!-- ================= РУЧНА ВИПЛАТА ================= -->
        <section class="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 class="mb-1 font-display text-lg text-white">Ручна виплата</h2>
            <p class="mb-4 text-sm text-white/40">Разова премія поза автоматичним тижневим розрахунком — за потреби, будь-якому учаснику.</p>

            <form class="grid gap-3 sm:grid-cols-4" @submit.prevent="submitManualAward">
                <div class="relative sm:col-span-2">
                    <input
                        v-model="memberQuery"
                        type="text"
                        placeholder="Ім'я учасника"
                        class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white"
                    />
                    <div v-if="memberMatches.length" class="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-obsidian-900 shadow-xl">
                        <button
                            v-for="m in memberMatches"
                            :key="m.id"
                            type="button"
                            class="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5"
                            @click="pickMember(m)"
                        >
                            {{ m.name }}
                        </button>
                    </div>
                    <p v-if="memberSelected" class="mt-1 text-xs text-emerald-400/70">Обрано: {{ memberSelected.name }}</p>
                </div>
                <input v-model.number="manualForm.amount" type="number" min="1" placeholder="Сума, ₴" class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white" />
                <input v-model="manualForm.note" type="text" placeholder="Причина (необов'язково)" class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white" />
                <div class="sm:col-span-4">
                    <button
                        type="submit"
                        :disabled="manualForm.processing || !manualForm.user_id"
                        class="rounded-full border border-gold-400/40 px-5 py-2 text-xs font-medium uppercase tracking-widest text-gold-200 hover:border-gold-300 disabled:opacity-40"
                    >
                        Видати премію
                    </button>
                </div>
            </form>

            <div v-if="manualAwards.length" class="mt-5 space-y-2">
                <div v-for="a in manualAwards" :key="a.id" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-4 py-2.5">
                    <div>
                        <span class="font-medium text-white">{{ a.user?.name }}</span>
                        <span class="ml-3 text-sm text-gold-200">{{ fmt(a.amount) }}</span>
                        <span v-if="a.note" class="ml-2 text-sm text-white/40">— {{ a.note }}</span>
                        <span class="ml-2 text-xs text-white/30">{{ fmtDate(a.created_at) }} · видав {{ a.awarded_by?.name ?? '—' }}</span>
                    </div>
                    <button class="shrink-0 text-xs text-ember-500/70 hover:text-ember-500" @click="removeManualAward(a)">Видалити</button>
                </div>
            </div>
        </section>

        <!-- ================= НАЛАШТУВАННЯ БАНКУ ================= -->
        <section class="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 class="mb-4 font-display text-lg text-white">Налаштування банку</h2>
            <form class="grid gap-5 sm:grid-cols-2" @submit.prevent="saveBankSettings">
                <div class="sm:col-span-2 flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3">
                    <input id="transfer_enabled" v-model="bankForm.transfer_enabled" type="checkbox" class="h-4 w-4 rounded border-white/20 bg-obsidian-900" />
                    <label for="transfer_enabled" class="text-sm text-white">Дозволити перекази між учасниками</label>
                </div>
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Мінімальна сума переказу (₴)</label>
                    <input v-model.number="bankForm.transfer_min_amount" type="number" min="1" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                </div>
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Денний ліміт переказів на учасника (₴)</label>
                    <input v-model.number="bankForm.transfer_daily_limit" type="number" min="1" placeholder="без ліміту" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                </div>

                <div class="sm:col-span-2 flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3">
                    <input id="deposit_enabled" v-model="bankForm.deposit_enabled" type="checkbox" class="h-4 w-4 rounded border-white/20 bg-obsidian-900" />
                    <label for="deposit_enabled" class="text-sm text-white">Дозволити депозити</label>
                </div>
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Відсоток за строк депозиту (%)</label>
                    <input v-model.number="bankForm.deposit_interest_rate" type="number" min="0" max="100" step="0.1" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                </div>
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Строк депозиту (днів)</label>
                    <input v-model.number="bankForm.deposit_term_days" type="number" min="1" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                </div>
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Мінімальна сума депозиту (₴)</label>
                    <input v-model.number="bankForm.deposit_min_amount" type="number" min="1" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                </div>

                <div class="sm:col-span-2">
                    <button
                        type="submit"
                        :disabled="bankForm.processing"
                        class="rounded-full bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 px-6 py-2.5 text-sm font-semibold uppercase tracking-widest text-obsidian-950 shadow-gold transition-transform hover:scale-[1.03] disabled:opacity-40"
                    >
                        Зберегти
                    </button>
                </div>
            </form>
        </section>

        <!-- ================= ЗАПИТИ НА ГОТІВКУ ================= -->
        <section class="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 class="mb-1 font-display text-lg text-white">Запити на видачу готівки</h2>
            <p class="mb-4 text-sm text-white/40">Учасник хоче отримати кошти на руки — узгодьте передачу і підтвердіть тут.</p>

            <div v-if="cashRequests.length" class="space-y-2">
                <div
                    v-for="r in cashRequests"
                    :key="r.id"
                    class="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2.5"
                    :class="r.status === 'pending' ? 'border-gold-400/30 bg-gold-400/[0.04]' : 'border-white/10 opacity-60'"
                >
                    <div>
                        <span class="text-white">{{ r.user?.name }}</span>
                        <span class="ml-3 text-sm text-gold-200">{{ fmt(r.amount) }}</span>
                        <span
                            class="ml-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide"
                            :class="{
                                'bg-gold-400/10 text-gold-300': r.status === 'pending',
                                'bg-emerald-400/10 text-emerald-300': r.status === 'completed',
                                'bg-white/5 text-white/40': r.status === 'cancelled',
                            }"
                        >
                            {{ r.status === 'pending' ? 'очікує' : (r.status === 'completed' ? 'видано' : 'скасовано') }}
                        </span>
                        <p class="mt-1 text-xs text-white/30">
                            {{ fmtDateTime(r.created_at) }}
                            <template v-if="r.resolved_by">· опрацював {{ r.resolved_by?.name }}</template>
                        </p>
                    </div>
                    <div v-if="r.status === 'pending'" class="flex shrink-0 items-center gap-2">
                        <button
                            :disabled="resolvingCashRequest === r.id"
                            class="rounded-full border border-emerald-400/30 px-3 py-1 text-xs text-emerald-300 hover:border-emerald-400/60 disabled:opacity-40"
                            @click="completeCashRequest(r)"
                        >
                            Видано
                        </button>
                        <button
                            :disabled="resolvingCashRequest === r.id"
                            class="rounded-full border border-white/15 px-3 py-1 text-xs text-white/50 hover:border-ember-500/40 hover:text-ember-400 disabled:opacity-40"
                            @click="cancelCashRequest(r)"
                        >
                            Скасувати
                        </button>
                    </div>
                </div>
            </div>
            <p v-else class="text-sm text-white/30">Запитів ще не було.</p>
        </section>

        <!-- ================= ПЕРЕКАЗИ МІЖ УЧАСНИКАМИ ================= -->
        <section class="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 class="mb-1 font-display text-lg text-white">Перекази між учасниками</h2>
            <p class="mb-4 text-sm text-white/40">Учасники переказують самі, з «Банку» — тут можна лише скасувати помилковий переказ.</p>

            <div v-if="transfers.length" class="space-y-2">
                <div v-for="t in transfers" :key="t.id" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2.5" :class="t.reversed_at ? 'border-white/5 opacity-50' : 'border-white/10'">
                    <div>
                        <span class="text-white">{{ t.sender?.name }}</span>
                        <span class="mx-2 text-white/30">→</span>
                        <span class="text-white">{{ t.recipient?.name }}</span>
                        <span class="ml-3 text-sm text-gold-200">{{ fmt(t.amount) }}</span>
                        <span v-if="t.note" class="ml-2 text-sm text-white/40">— {{ t.note }}</span>
                        <span v-if="t.reversed_at" class="ml-2 rounded-full bg-ember-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-ember-400">скасовано</span>
                    </div>
                    <div class="flex shrink-0 items-center gap-3">
                        <span class="text-xs text-white/30">{{ fmtDateTime(t.created_at) }}</span>
                        <button
                            v-if="!t.reversed_at"
                            :disabled="reversingTransfer === t.id"
                            class="rounded-full border border-white/15 px-3 py-1 text-xs text-white/50 hover:border-ember-500/40 hover:text-ember-400 disabled:opacity-40"
                            @click="reverseTransfer(t)"
                        >
                            Скасувати
                        </button>
                    </div>
                </div>
            </div>
            <p v-else class="text-sm text-white/30">Переказів ще не було.</p>
        </section>

        <!-- ================= ДЕПОЗИТИ ================= -->
        <section class="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 class="mb-1 font-display text-lg text-white">Депозити учасників</h2>
            <p class="mb-4 text-sm text-white/40">Лише перегляд.</p>

            <div v-if="deposits.length" class="space-y-2">
                <div v-for="d in deposits" :key="d.id" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-4 py-2.5">
                    <div>
                        <span class="text-white">{{ d.user?.name }}</span>
                        <span class="ml-3 text-sm text-gold-200">{{ fmt(d.amount) }}</span>
                        <span class="ml-2 text-sm text-white/40">+{{ d.interest_rate }}%</span>
                        <span
                            class="ml-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide"
                            :class="{
                                'bg-gold-400/10 text-gold-300': d.status === 'active',
                                'bg-emerald-400/10 text-emerald-300': d.status === 'completed',
                                'bg-white/5 text-white/40': d.status === 'withdrawn',
                            }"
                        >
                            {{ d.status === 'active' ? 'активний' : (d.status === 'completed' ? 'дозрів' : 'знято достроково') }}
                        </span>
                    </div>
                    <span class="shrink-0 text-xs text-white/30">{{ fmtDateTime(d.created_at) }}</span>
                </div>
            </div>
            <p v-else class="text-sm text-white/30">Депозитів ще не було.</p>
        </section>

        <!-- ================= ІСТОРІЯ ВИПЛАТ ================= -->
        <section class="rounded-2xl border border-white/10 bg-white/[0.02]">
            <div class="flex flex-wrap items-end justify-between gap-3 p-6 pb-0">
                <h2 class="font-display text-lg text-white">Історія нарахувань</h2>
                <a
                    :href="route('admin.bonuses.export', filterForm)"
                    class="rounded-full border border-white/15 px-4 py-2 text-xs text-white/60 hover:border-white/30"
                >
                    ⬇ Експорт CSV
                </a>
            </div>

            <div class="flex flex-wrap items-end gap-3 p-6 pb-0">
                <div>
                    <label class="mb-1 block text-[10px] uppercase tracking-widest text-white/40">Тиждень від</label>
                    <input v-model="filterForm.from" type="date" class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                    <label class="mb-1 block text-[10px] uppercase tracking-widest text-white/40">Тиждень до</label>
                    <input v-model="filterForm.to" type="date" class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                    <label class="mb-1 block text-[10px] uppercase tracking-widest text-white/40">Виплата</label>
                    <select v-model="filterForm.paid" class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white focus:border-gold-400/50 focus:outline-none">
                        <option value="">Усі</option>
                        <option value="1">Виплачено</option>
                        <option value="0">Не виплачено</option>
                    </select>
                </div>
                <button type="button" class="rounded-full border border-gold-400/40 px-4 py-2 text-xs font-medium tracking-widest text-gold-200 hover:border-gold-300" @click="applyFilters">
                    Застосувати
                </button>
                <button
                    v-if="filters.from || filters.to || filters.paid"
                    type="button"
                    class="text-xs text-white/40 hover:text-white"
                    @click="resetFilters"
                >
                    Скинути
                </button>
            </div>

            <div class="overflow-x-auto">
                <table class="mt-4 w-full text-left text-sm">
                    <thead>
                        <tr class="border-b border-white/10 text-[11px] uppercase tracking-widest text-white/30">
                            <th class="px-6 py-2">Тиждень</th>
                            <th class="px-3 py-2">Учасник</th>
                            <th class="px-3 py-2">Бізвар</th>
                            <th class="px-3 py-2">Контракти</th>
                            <th class="px-3 py-2">Бонуси</th>
                            <th class="px-3 py-2">Разом</th>
                            <th class="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="p in payouts.data" :key="p.id" class="border-b border-white/5">
                            <td class="px-6 py-3 text-white/50">{{ fmtDate(p.week_start) }}</td>
                            <td class="px-3 py-3 text-white">{{ p.user?.name }}</td>
                            <td class="px-3 py-3 text-white/60">
                                {{ fmt(p.bizwar_amount) }}
                                <span v-if="p.bizwar_winrate !== null" class="text-white/30">({{ p.bizwar_winrate }}%)</span>
                            </td>
                            <td class="px-3 py-3 text-white/60">{{ fmt(p.contract_amount) }} <span class="text-white/30">×{{ p.contracts_count }}</span></td>
                            <td class="px-3 py-3 text-white/60">{{ fmt(p.streak_bonus_amount + p.contracts_count_bonus_amount + p.investment_bonus_amount) }}</td>
                            <td class="px-3 py-3 font-medium text-gold-200">{{ fmt(p.total_amount) }}</td>
                            <td class="px-3 py-3">
                                <span v-if="p.paid" class="text-xs text-emerald-400/70">✓ виплачено</span>
                                <button
                                    v-else
                                    :disabled="markingPaid === p.id"
                                    class="rounded-full border border-white/15 px-3 py-1 text-xs text-white/50 hover:border-gold-400/40 hover:text-gold-200 disabled:opacity-40"
                                    @click="markPaid(p)"
                                >
                                    Позначити виплаченим
                                </button>
                            </td>
                        </tr>
                        <tr v-if="payouts.data.length === 0">
                            <td colspan="7" class="px-6 py-12 text-center text-white/30">Нарахувань ще не було</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-if="payouts.links?.length > 3" class="flex flex-wrap gap-2 p-6 pt-4">
                <Link
                    v-for="link in payouts.links"
                    :key="link.label"
                    :href="link.url || ''"
                    v-html="link.label"
                    class="rounded-full border px-3 py-1.5 text-xs"
                    :class="[
                        link.active ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/10 text-white/40 hover:text-white',
                        !link.url && 'pointer-events-none opacity-30',
                    ]"
                />
            </div>
        </section>
    </AdminLayout>
</template>
