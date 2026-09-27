<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { Head, useForm } from '@inertiajs/vue3';
import { ref } from 'vue';
import { verb } from '@/utils/gendered';

const props = defineProps({
    goals: { type: Array, required: true },
    metrics: { type: Object, default: () => ({}) },
});

const statusMeta = {
    active: { label: 'Активна', class: 'bg-gold-400/15 text-gold-300 border-gold-400/30' },
    completed: { label: 'Досягнута', class: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30' },
    failed: { label: 'Закрита', class: 'bg-white/5 text-white/40 border-white/10' },
};

const showForm = ref(false);
const createForm = useForm({
    title: '',
    description: '',
    target_value: '',
    unit: '',
    metric: '',
    deadline: '',
});

function createGoal() {
    createForm.post(route('admin.family-goals.store'), {
        preserveScroll: true,
        onSuccess: () => {
            createForm.reset();
            showForm.value = false;
        },
    });
}

/* ---------- сповіщення ---------- */
const toasts = ref([]);
let toastId = 0;
function pushToast(ok, message) {
    const id = ++toastId;
    toasts.value.push({ id, ok, message });
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 4000);
}

/* ---------- прогрес ---------- */
const busyGoal = ref(null);
const progressInput = ref({});

async function updateProgress(goal) {
    const value = progressInput.value[goal.id];
    if (value === undefined || value === '') return;
    busyGoal.value = goal.id;
    try {
        const { data } = await window.axios.put(route('admin.family-goals.progress', goal.id), { current_value: Number(value) });
        pushToast(data.ok, data.message);
        if (data.ok) {
            goal.current_value = data.data.goal.current_value;
            goal.status = data.data.goal.status;
            goal.progress_percent = data.data.goal.progress_percent;
        }
    } catch (e) {
        pushToast(false, e.response?.data?.message || 'Помилка');
    } finally {
        busyGoal.value = null;
    }
}

async function closeGoal(goal) {
    if (!confirm(`Закрити ціль «${goal.title}» без досягнення?`)) return;
    busyGoal.value = goal.id;
    try {
        const { data } = await window.axios.post(route('admin.family-goals.close', goal.id));
        pushToast(data.ok, data.message);
        if (data.ok) goal.status = 'failed';
    } catch (e) {
        pushToast(false, e.response?.data?.message || 'Помилка');
    } finally {
        busyGoal.value = null;
    }
}
</script>

<template>
    <Head title="Цілі родини" />

    <AdminLayout title="Цілі родини">
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

        <div class="mb-6">
            <button
                class="rounded-xl bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 px-6 py-3 text-sm font-semibold uppercase tracking-widest text-obsidian-950 shadow-gold transition-transform hover:scale-[1.03]"
                @click="showForm = !showForm"
            >
                {{ showForm ? 'Скасувати' : 'Нова ціль' }}
            </button>
        </div>

        <Transition name="fade-slide">
            <form v-if="showForm" class="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6" @submit.prevent="createGoal">
                <div class="grid gap-5 sm:grid-cols-2">
                    <div class="sm:col-span-2">
                        <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Назва</label>
                        <input v-model="createForm.title" type="text" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                        <p v-if="createForm.errors.title" class="mt-1 text-xs text-ember-500">{{ createForm.errors.title }}</p>
                    </div>
                    <div>
                        <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Ціль (число, необов'язково)</label>
                        <input v-model="createForm.target_value" type="number" min="1" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                    </div>
                    <div>
                        <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Одиниця (напр. "перемог")</label>
                        <input v-model="createForm.unit" type="text" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                    </div>
                    <div class="sm:col-span-2">
                        <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Автоматичний прогрес (необов'язково)</label>
                        <select v-model="createForm.metric" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white">
                            <option value="">Вручну (як зараз)</option>
                            <option v-for="(label, key) in metrics" :key="key" :value="key">{{ label }}</option>
                        </select>
                        <p class="mt-1 text-[11px] text-white/30">
                            Якщо обрано — прогрес рухатиметься сам із затверджених звітів, без "Оновити прогрес".
                        </p>
                    </div>
                    <div class="sm:col-span-2">
                        <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Дедлайн (необов'язково)</label>
                        <input v-model="createForm.deadline" type="date" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                    </div>
                    <div class="sm:col-span-2">
                        <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Опис (необов'язково)</label>
                        <textarea v-model="createForm.description" rows="2" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white"></textarea>
                    </div>
                </div>
                <button
                    type="submit"
                    :disabled="createForm.processing"
                    class="mt-5 rounded-xl border border-gold-400/40 px-6 py-2.5 text-sm font-medium tracking-widest text-gold-200 transition-all hover:border-gold-300 disabled:opacity-40"
                >
                    Створити
                </button>
            </form>
        </Transition>

        <div class="space-y-5">
            <div v-for="goal in goals" :key="goal.id" class="glass-panel p-6" :class="busyGoal === goal.id && 'opacity-60'">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 class="font-display text-xl text-white">{{ goal.title }}</h3>
                        <p class="text-xs text-white/40">
                            {{ verb(goal.creator, 'створив', 'створила') }} {{ goal.creator?.name }}
                            <span v-if="goal.metric" class="text-gold-300/70">· автоматично: {{ metrics[goal.metric] || goal.metric }}</span>
                        </p>
                    </div>
                    <span class="shrink-0 rounded-xl border px-3 py-1 text-[11px] font-medium uppercase tracking-wide" :class="statusMeta[goal.status]?.class">
                        {{ statusMeta[goal.status]?.label }}
                    </span>
                </div>
                <p v-if="goal.description" class="mt-2 text-sm leading-relaxed text-white/50">{{ goal.description }}</p>

                <div v-if="goal.target_value" class="mt-4">
                    <div class="mb-2 flex items-center justify-between text-xs text-white/40">
                        <span>{{ goal.current_value }} з {{ goal.target_value }}{{ goal.unit ? ` ${goal.unit}` : '' }}</span>
                        <span>{{ goal.progress_percent }}%</span>
                    </div>
                    <div class="h-2 overflow-hidden rounded-full bg-white/10">
                        <div class="h-full rounded-full bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 transition-all duration-700" :style="{ width: goal.progress_percent + '%' }"></div>
                    </div>
                </div>

                <div v-if="goal.status === 'active'" class="mt-5 flex flex-wrap items-center gap-3">
                    <input
                        v-model="progressInput[goal.id]"
                        type="number"
                        min="0"
                        :placeholder="goal.metric ? 'Ручна корекція…' : 'Новий прогрес…'"
                        class="w-40 rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white"
                        @keyup.enter="updateProgress(goal)"
                    />
                    <button
                        :disabled="busyGoal === goal.id"
                        class="rounded-xl border border-gold-400/30 bg-gold-400/10 px-4 py-1.5 text-xs font-medium text-gold-300 hover:bg-gold-400/20 disabled:opacity-40"
                        @click="updateProgress(goal)"
                    >
                        {{ goal.metric ? 'Скоригувати' : 'Оновити' }}
                    </button>
                    <button
                        :disabled="busyGoal === goal.id"
                        class="rounded-xl border border-ember-500/25 px-4 py-1.5 text-xs font-medium text-ember-500/80 hover:bg-ember-600/10 disabled:opacity-40"
                        @click="closeGoal(goal)"
                    >
                        Закрити без досягнення
                    </button>
                </div>
            </div>

            <div v-if="goals.length === 0" class="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center text-white/30">
                Цілей ще немає — створіть першу
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
.fade-slide-enter-active,
.fade-slide-leave-active {
    transition: all 0.3s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}
</style>
