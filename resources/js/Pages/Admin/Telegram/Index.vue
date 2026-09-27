<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { Head, Link } from '@inertiajs/vue3';
import { ref } from 'vue';

const props = defineProps({
    configured: { type: Boolean, required: true },
    botUsername: { type: String, default: null },
    webhookInfo: { type: Object, default: null },
    linkedCount: { type: Number, default: 0 },
    group: { type: Object, default: () => ({ id: null, ok: false, title: null, error: null }) },
    applications: { type: Array, default: () => [] },
    pendingCount: { type: Number, default: 0 },
});

const webhookInfo = ref(props.webhookInfo);
const busy = ref(false);

/* ---------- сповіщення ---------- */
const toasts = ref([]);
let toastId = 0;
function pushToast(ok, message) {
    const id = ++toastId;
    toasts.value.push({ id, ok, message });
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 5000);
}

async function setupWebhook() {
    busy.value = true;
    try {
        const { data } = await window.axios.post(route('admin.telegram.webhook.setup'));
        pushToast(data.ok, data.message);
        if (data.ok) window.location.reload();
    } catch (e) {
        pushToast(false, e.response?.data?.message || 'Помилка');
    } finally {
        busy.value = false;
    }
}

async function removeWebhook() {
    if (!confirm('Зняти webhook? Бот перестане отримувати повідомлення.')) return;
    busy.value = true;
    try {
        const { data } = await window.axios.delete(route('admin.telegram.webhook.remove'));
        pushToast(data.ok, data.message);
        if (data.ok) window.location.reload();
    } catch (e) {
        pushToast(false, e.response?.data?.message || 'Помилка');
    } finally {
        busy.value = false;
    }
}

const hasActiveWebhook = webhookInfo.value?.url && webhookInfo.value.url.length > 0;

/* ---------- заявки з бота ---------- */
const applications = ref([...props.applications]);
const notes = ref({});
const reviewing = ref(null);

const STATUS = {
    pending: { label: 'На розгляді', cls: 'border-gold-400/30 bg-gold-500/10 text-gold-300' },
    approved: { label: 'Схвалено', cls: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' },
    rejected: { label: 'Відхилено', cls: 'border-ember-500/30 bg-ember-600/10 text-ember-500' },
};

async function review(application, decision) {
    if (decision === 'reject' && !confirm(`Відхилити заявку ${application.nickname}?`)) return;

    reviewing.value = application.id;
    try {
        const { data } = await window.axios.post(
            route('admin.telegram.applications.review', { application: application.id }),
            { decision, note: notes.value[application.id] || null },
        );
        pushToast(data.ok, data.message);
        if (data.ok) {
            // Обновляем строку на месте: перезагружать всю страницу ради
            // одного решения — терять позицию в списке заявок.
            application.status = decision === 'approve' ? 'approved' : 'rejected';
            application.review_note = notes.value[application.id] || null;
            application.reviewed_at = new Date().toLocaleString('uk-UA', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
            }).replace(',', '');
            delete notes.value[application.id];
        }
    } catch (e) {
        pushToast(false, e.response?.data?.message || 'Помилка');
    } finally {
        reviewing.value = null;
    }
}
</script>

<template>
    <Head title="Telegram-бот" />

    <AdminLayout title="Telegram-бот">
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

        <div v-if="!configured" v-glow class="glass-panel-gold glass-panel mb-8 p-6">
            <p class="text-white/80">
                Спочатку вкажіть <strong>Bot Token</strong> у
                <Link :href="route('admin.settings.index')" class="text-gold-300 underline hover:text-gold-200">Налаштуваннях → Telegram</Link>.
            </p>
        </div>

        <div v-else class="grid gap-6 sm:grid-cols-3">
            <div v-glow class="glass-panel p-6">
                <p class="text-xs uppercase tracking-widest text-white/40">Бот</p>
                <p class="font-display mt-2 text-xl text-white">@{{ botUsername || '—' }}</p>
            </div>
            <div v-glow class="glass-panel p-6">
                <p class="text-xs uppercase tracking-widest text-white/40">Webhook</p>
                <p class="font-display mt-2 text-xl" :class="hasActiveWebhook ? 'text-emerald-300' : 'text-white/40'">
                    {{ hasActiveWebhook ? 'Активний' : 'Не встановлено' }}
                </p>
            </div>
            <div v-glow class="glass-panel p-6">
                <p class="text-xs uppercase tracking-widest text-white/40">Привʼязано акаунтів</p>
                <p class="font-display mt-2 text-4xl text-gold-300">{{ linkedCount }}</p>
            </div>
        </div>

        <div v-if="configured" class="mt-8 flex flex-wrap items-center gap-4">
            <button
                :disabled="busy"
                class="rounded-full bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 px-6 py-3 text-sm font-semibold uppercase tracking-widest text-obsidian-950 shadow-gold transition-transform hover:scale-[1.03] disabled:opacity-40"
                @click="setupWebhook"
            >
                {{ hasActiveWebhook ? 'Перевстановити webhook' : 'Встановити webhook' }}
            </button>
            <button
                v-if="hasActiveWebhook"
                :disabled="busy"
                class="rounded-full border border-ember-500/25 px-5 py-2.5 text-xs font-medium text-ember-500/80 hover:bg-ember-600/10 disabled:opacity-40"
                @click="removeWebhook"
            >
                Зняти webhook
            </button>
        </div>

        <!-- Группа, куда попадают одобренные. Проверяется через getChat:
             опечатка в ID или бот, не добавленный в группу, выясняются
             здесь, а не в момент одобрения заявки. -->
        <div v-if="configured" class="mt-8 max-w-xl">
            <h2 class="font-display mb-3 text-lg text-white">Група родини</h2>
            <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] text-sm">
                <div class="flex justify-between border-b border-white/5 px-5 py-3">
                    <span class="text-white/40">ID</span>
                    <span class="font-mono text-white/70">{{ group.id || 'не вказано' }}</span>
                </div>
                <div class="flex justify-between px-5 py-3">
                    <span class="text-white/40">Стан</span>
                    <span :class="group.ok ? 'text-emerald-300' : 'text-ember-500'" class="max-w-[60%] text-right">
                        {{ group.ok ? (group.title || 'доступна') : (group.error || 'недоступна') }}
                    </span>
                </div>
            </div>
            <p v-if="!group.ok" class="mt-3 text-xs leading-relaxed text-white/35">
                Вкажіть ID у Налаштуваннях → Telegram і додайте бота адміністратором групи
                з правом запрошувати. Без цього схвалена заявка не отримає посилання на вступ.
            </p>
        </div>

        <div v-if="configured && webhookInfo" class="mt-8 max-w-xl">
            <h2 class="font-display mb-3 text-lg text-white">Деталі webhook</h2>
            <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] text-sm">
                <div class="flex justify-between border-b border-white/5 px-5 py-3">
                    <span class="text-white/40">URL</span>
                    <span class="max-w-[60%] truncate text-white/70">{{ webhookInfo.url || '—' }}</span>
                </div>
                <div class="flex justify-between border-b border-white/5 px-5 py-3">
                    <span class="text-white/40">Очікує повідомлень</span>
                    <span class="text-white/70">{{ webhookInfo.pending_update_count ?? 0 }}</span>
                </div>
                <div v-if="webhookInfo.last_error_message" class="flex justify-between px-5 py-3">
                    <span class="text-white/40">Остання помилка</span>
                    <span class="max-w-[60%] text-right text-ember-500">{{ webhookInfo.last_error_message }}</span>
                </div>
            </div>
        </div>

        <!-- ================= ЗАЯВКИ З БОТА ================= -->
        <div id="applications" class="mt-12">
            <div class="mb-5 flex items-baseline gap-4">
                <h2 class="font-display text-lg text-white">Заявки з бота</h2>
                <span v-if="pendingCount" class="rounded-full border border-gold-400/30 bg-gold-500/10 px-3 py-1 text-xs text-gold-300">
                    {{ pendingCount }} на розгляді
                </span>
            </div>

            <p v-if="!applications.length" class="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 text-sm text-white/40">
                Заявок ще немає. Вони зʼявляться тут, щойно хтось заповнить анкету в боті.
            </p>

            <div v-else class="grid gap-4 lg:grid-cols-2">
                <div
                    v-for="a in applications"
                    :key="a.id"
                    v-glow
                    class="glass-panel p-5"
                    :class="a.status === 'pending' ? 'ring-1 ring-gold-400/20' : ''"
                >
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="font-display text-lg text-white">{{ a.nickname }}</p>
                            <p class="text-xs text-white/35">
                                <a
                                    v-if="a.telegram_username"
                                    :href="`https://t.me/${a.telegram_username}`"
                                    target="_blank"
                                    rel="noopener"
                                    class="text-gold-300/80 hover:text-gold-200"
                                >@{{ a.telegram_username }}</a>
                                <span v-else>без username</span>
                                · {{ a.created_at }}
                            </p>
                        </div>
                        <span class="shrink-0 rounded-full border px-3 py-1 text-[11px]" :class="STATUS[a.status].cls">
                            {{ STATUS[a.status].label }}
                        </span>
                    </div>

                    <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div><dt class="text-white/35">Вік</dt><dd class="text-white/75">{{ a.age_range }}</dd></div>
                        <div><dt class="text-white/35">Час у грі</dt><dd class="text-white/75">{{ a.playtime }}</dd></div>
                        <div><dt class="text-white/35">Досвід</dt><dd class="text-white/75">{{ a.experience }}</dd></div>
                        <div><dt class="text-white/35">Напрямок</dt><dd class="text-white/75">{{ a.direction }}</dd></div>
                    </dl>

                    <p v-if="a.about" class="mt-4 rounded-xl bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white/60">
                        {{ a.about }}
                    </p>

                    <template v-if="a.status === 'pending'">
                        <input
                            v-model="notes[a.id]"
                            type="text"
                            maxlength="500"
                            placeholder="Коментар (надійде людині в чат) — необовʼязково"
                            class="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-gold-400/40 focus:ring-0"
                        />
                        <div class="mt-3 flex gap-3">
                            <button
                                :disabled="reviewing === a.id"
                                class="rounded-full bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-obsidian-950 transition-transform hover:scale-[1.03] disabled:opacity-40"
                                @click="review(a, 'approve')"
                            >
                                Схвалити
                            </button>
                            <button
                                :disabled="reviewing === a.id"
                                class="rounded-full border border-ember-500/25 px-5 py-2 text-xs font-medium text-ember-500/80 hover:bg-ember-600/10 disabled:opacity-40"
                                @click="review(a, 'reject')"
                            >
                                Відхилити
                            </button>
                        </div>
                    </template>

                    <p v-else class="mt-4 text-xs text-white/35">
                        {{ a.reviewer ? `${a.reviewer} · ` : '' }}{{ a.reviewed_at }}
                        <span v-if="a.review_note" class="block text-white/50">«{{ a.review_note }}»</span>
                    </p>
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
