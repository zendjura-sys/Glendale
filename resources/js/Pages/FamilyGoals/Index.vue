<script setup>
import { Head, Link } from '@inertiajs/vue3';

defineProps({
    goals: { type: Array, default: () => [] },
    activity: { type: Array, default: () => [] },
    metrics: { type: Object, default: () => ({}) },
});

const statusMeta = {
    active: { label: 'Активна', class: 'bg-gold-400/15 text-gold-300 border-gold-400/30' },
    completed: { label: 'Досягнута', class: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30' },
};

function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateTime(iso) {
    return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
    <Head title="Родина" />

    <div class="min-h-screen bg-obsidian-950 font-sans text-white/80">
        <header class="border-b border-white/5 bg-obsidian-900/60 backdrop-blur-md">
            <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
                <div>
                    <Link :href="route('dashboard')" class="text-xs uppercase tracking-widest text-white/40 hover:text-gold-300">
                        ← Кабінет
                    </Link>
                    <h1 class="font-display mt-2 text-3xl font-light text-white">
                        Цілі <span class="text-gradient-gold italic">родини</span>
                    </h1>
                </div>
            </div>
        </header>

        <div class="mx-auto grid max-w-5xl gap-10 px-6 py-10 lg:grid-cols-[1.4fr_1fr]">
            <!-- ================= ЦІЛІ ================= -->
            <div class="space-y-5">
                <div
                    v-for="goal in goals"
                    :key="goal.id"
                    v-glow class="glass-panel p-6"
                >
                    <div class="flex items-start justify-between gap-3">
                        <h3 class="font-display text-xl text-white">{{ goal.title }}</h3>
                        <span class="shrink-0 rounded-xl border px-3 py-1 text-[11px] font-medium uppercase tracking-wide" :class="statusMeta[goal.status]?.class">
                            {{ statusMeta[goal.status]?.label }}
                        </span>
                    </div>
                    <p v-if="goal.metric" class="mt-1 text-[11px] uppercase tracking-widest text-gold-300/60">
                        Прогрес рухається сам: {{ metrics[goal.metric] || goal.metric }}
                    </p>
                    <p v-if="goal.description" class="mt-2 text-sm leading-relaxed text-white/50">{{ goal.description }}</p>

                    <div v-if="goal.target_value" class="mt-5">
                        <div class="mb-2 flex items-center justify-between text-xs text-white/40">
                            <span>{{ goal.current_value }}{{ goal.unit ? ` ${goal.unit}` : '' }} з {{ goal.target_value }}{{ goal.unit ? ` ${goal.unit}` : '' }}</span>
                            <span>{{ goal.progress_percent }}%</span>
                        </div>
                        <div class="h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                                class="h-full rounded-full bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 transition-all duration-700"
                                :style="{ width: goal.progress_percent + '%' }"
                            ></div>
                        </div>
                    </div>
                    <p v-else class="mt-4 font-display text-2xl text-gold-300">{{ goal.current_value }}</p>

                    <p v-if="goal.deadline" class="mt-4 text-xs text-white/30">До {{ fmtDate(goal.deadline) }}</p>
                </div>

                <div v-if="goals.length === 0" class="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center text-white/30">
                    Активних цілей поки немає
                </div>
            </div>

            <!-- ================= АКТИВНІСТЬ ================= -->
            <div>
                <h2 class="font-display mb-4 text-xl text-white">Стрічка активності</h2>
                <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                    <div
                        v-for="event in activity"
                        :key="event.id"
                        class="border-b border-white/5 px-5 py-3 text-sm last:border-0"
                    >
                        <p class="text-white/60">{{ event.message }}</p>
                        <p class="mt-1 text-[11px] text-white/30">{{ fmtDateTime(event.created_at) }}</p>
                    </div>
                    <div v-if="activity.length === 0" class="px-5 py-8 text-center text-sm text-white/30">
                        Поки що пусто
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
