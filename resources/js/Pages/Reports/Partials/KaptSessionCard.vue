<script setup>
defineProps({
    session: { type: Object, required: true },
});

function fmtTimes(times) {
    if (!times.length) return '—';
    return times.join(', ');
}

const statusMeta = {
    pending: { label: 'На розгляді', class: 'bg-gold-400/15 text-gold-300 border-gold-400/30' },
    approved: { label: 'Затверджено', class: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30' },
    rejected: { label: 'Відхилено', class: 'bg-ember-500/15 text-ember-500 border-ember-500/30' },
};
</script>

<template>
    <div v-reveal v-glow class="glass-panel mb-3 overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-6 py-4">
            <div>
                <p class="text-xs uppercase tracking-widest text-white/40">Час капта</p>
                <p class="mt-1 text-lg font-medium text-white">{{ fmtTimes(session.times) }}</p>
            </div>

            <div class="text-right">
                <p class="text-xs uppercase tracking-widest text-white/40">Підсумок бою</p>
                <p class="mt-1 text-2xl font-semibold">
                    <span class="text-emerald-300">{{ session.result.wins }}</span>
                    <span class="text-white/30"> – </span>
                    <span class="text-ember-500">{{ session.result.losses }}</span>
                </p>
            </div>
        </div>

        <div v-if="!session.agreement" class="border-b border-gold-400/20 bg-gold-400/5 px-6 py-3 text-xs text-gold-300">
            ⚠ Учасники назвали різний рахунок —
            <span v-for="(b, i) in session.result_breakdown" :key="i">
                {{ b.wins }}–{{ b.losses }} ({{ b.count }}){{ i < session.result_breakdown.length - 1 ? ', ' : '' }}
            </span>
            . Показано найпоширеніший варіант; варто уточнити в модерації.
        </div>

        <div class="divide-y divide-white/5">
            <div
                v-for="p in session.participants"
                :key="p.report_id"
                class="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
            >
                <span class="min-w-0 truncate text-sm text-white/80">{{ p.name ?? '—' }}</span>
                <div class="flex shrink-0 items-center gap-3">
                    <span class="text-xs text-white/40">{{ p.wins }}–{{ p.losses }}</span>
                    <span class="shrink-0 rounded-xl border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide" :class="statusMeta[p.status]?.class">
                        {{ statusMeta[p.status]?.label }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>
