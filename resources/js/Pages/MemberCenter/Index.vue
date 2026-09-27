<script setup>
import { Head, Link, useForm } from '@inertiajs/vue3';
import { ref } from 'vue';

defineProps({
    hrStatus: { type: String, required: true },
    leaveRequests: { type: Array, default: () => [] },
});

const statusMeta = {
    active: { label: 'Активний', class: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30' },
    probation: { label: 'На стажуванні', class: 'bg-gold-400/15 text-gold-300 border-gold-400/30' },
    leave: { label: 'У відпустці', class: 'bg-aurora-400/15 text-aurora-400 border-aurora-400/30' },
    inactive: { label: 'Неактивний', class: 'bg-white/5 text-white/40 border-white/10' },
};

const leaveStatusMeta = {
    pending: { label: 'На розгляді', class: 'bg-gold-400/15 text-gold-300 border-gold-400/30' },
    approved: { label: 'Затверджено', class: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30' },
    rejected: { label: 'Відхилено', class: 'bg-ember-500/15 text-ember-500 border-ember-500/30' },
};

const showForm = ref(false);

const form = useForm({
    starts_on: '',
    ends_on: '',
    reason: '',
});

function submit() {
    form.post(route('member-center.leave.store'), {
        preserveScroll: true,
        onSuccess: () => {
            form.reset();
            showForm.value = false;
        },
    });
}

function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<template>
    <Head title="Кадровий центр" />

    <div class="min-h-screen bg-obsidian-950 font-sans text-white/80">
        <header class="border-b border-white/5 bg-obsidian-900/60 backdrop-blur-md">
            <div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
                <div>
                    <Link :href="route('dashboard')" class="text-xs uppercase tracking-widest text-white/40 hover:text-gold-300">
                        ← Кабінет
                    </Link>
                    <h1 class="font-display mt-2 text-3xl font-light text-white">
                        Кадровий <span class="text-gradient-gold italic">центр</span>
                    </h1>
                </div>
                <button
                    class="rounded-xl bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 px-6 py-3 text-sm font-semibold uppercase tracking-widest text-obsidian-950 shadow-gold transition-transform hover:scale-[1.03]"
                    @click="showForm = !showForm"
                >
                    {{ showForm ? 'Скасувати' : 'Подати заявку' }}
                </button>
            </div>
        </header>

        <div class="mx-auto max-w-4xl px-6 py-10">
            <div v-glow class="glass-panel mb-8 flex flex-wrap items-center justify-between gap-3 p-6">
                <div>
                    <p class="text-xs uppercase tracking-widest text-white/40">Ваш статус</p>
                    <p class="font-display mt-1 text-xl text-white">Учасник родини</p>
                </div>
                <span class="shrink-0 rounded-xl border px-4 py-1.5 text-xs font-medium uppercase tracking-wide" :class="statusMeta[hrStatus]?.class">
                    {{ statusMeta[hrStatus]?.label }}
                </span>
            </div>

            <Transition name="fade-slide">
                <form v-if="showForm" class="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6" @submit.prevent="submit">
                    <div class="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Дата початку</label>
                            <input v-model="form.starts_on" type="date" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                            <p v-if="form.errors.starts_on" class="mt-1 text-xs text-ember-500">{{ form.errors.starts_on }}</p>
                        </div>
                        <div>
                            <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Дата завершення</label>
                            <input v-model="form.ends_on" type="date" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                            <p v-if="form.errors.ends_on" class="mt-1 text-xs text-ember-500">{{ form.errors.ends_on }}</p>
                        </div>
                    </div>
                    <div class="mt-5">
                        <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Причина (необов'язково)</label>
                        <textarea
                            v-model="form.reason"
                            rows="3"
                            class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white placeholder:text-white/30"
                            placeholder="Деталі..."
                        ></textarea>
                    </div>
                    <button
                        type="submit"
                        :disabled="form.processing"
                        class="mt-5 rounded-xl border border-gold-400/40 px-6 py-2.5 text-sm font-medium tracking-widest text-gold-200 transition-all hover:border-gold-300 disabled:opacity-40"
                    >
                        Надіслати на розгляд
                    </button>
                </form>
            </Transition>

            <h2 class="font-display mb-4 text-xl text-white">Мої заявки</h2>
            <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                <div
                    v-for="lr in leaveRequests"
                    :key="lr.id"
                    class="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-6 py-4 last:border-0"
                >
                    <div class="min-w-0">
                        <p class="font-medium text-white">{{ fmtDate(lr.starts_on) }} — {{ fmtDate(lr.ends_on) }}</p>
                        <p v-if="lr.reason" class="mt-1 text-sm text-white/50">{{ lr.reason }}</p>
                    </div>
                    <span class="shrink-0 rounded-xl border px-3 py-1 text-[11px] font-medium uppercase tracking-wide" :class="leaveStatusMeta[lr.status]?.class">
                        {{ leaveStatusMeta[lr.status]?.label }}
                    </span>
                </div>
                <div v-if="leaveRequests.length === 0" class="px-6 py-12 text-center text-white/30">
                    Заявок поки немає
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
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
