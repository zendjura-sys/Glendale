<script setup>
import { Head, Link, router } from '@inertiajs/vue3';

const props = defineProps({
    leaderboard: { type: Array, default: () => [] },
    category: { type: String, default: 'xp' },
    categories: { type: Object, default: () => ({}) },
});

function switchCategory(key) {
    if (key === props.category) return;
    router.get(route('progression.leaderboard'), { category: key }, { preserveState: true, preserveScroll: true });
}

function winrate(entry) {
    const total = (entry.kapt_wins ?? 0) + (entry.kapt_losses ?? 0);
    if (total === 0) return null;
    return Math.round((entry.kapt_wins / total) * 100);
}
</script>

<template>
    <Head title="Рейтинг родини" />

    <div class="min-h-screen bg-obsidian-950 font-sans text-white/80">
        <header class="border-b border-white/5 bg-obsidian-900/60 backdrop-blur-md">
            <div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
                <div>
                    <Link
                        v-if="route().has('progression.index')"
                        :href="route('progression.index')"
                        class="text-xs uppercase tracking-widest text-white/40 hover:text-gold-300"
                    >
                        ← Мій прогрес
                    </Link>
                    <h1 class="font-display mt-2 text-3xl font-light text-white">
                        Рейтинг <span class="text-gradient-gold italic">родини</span>
                    </h1>
                </div>
                <Link
                    v-if="route().has('progression.hall-of-fame')"
                    :href="route('progression.hall-of-fame')"
                    class="rounded-xl border border-gold-400/40 px-5 py-2 text-xs font-medium tracking-widest text-gold-200 hover:border-gold-300"
                >
                    ЗАЛ СЛАВИ
                </Link>
            </div>
        </header>

        <div class="mx-auto max-w-3xl px-6 py-10">
            <div class="mb-6 flex flex-wrap gap-2">
                <button
                    v-for="(label, key) in categories"
                    :key="key"
                    class="rounded-xl border px-4 py-1.5 text-xs font-medium uppercase tracking-widest transition-colors"
                    :class="key === category
                        ? 'border-gold-400/50 bg-gold-400/10 text-gold-200'
                        : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white'"
                    @click="switchCategory(key)"
                >
                    {{ label }}
                </button>
            </div>

            <div v-reveal v-glow class="glass-panel overflow-hidden">
                <div
                    v-for="(entry, i) in leaderboard"
                    :key="i"
                    class="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-6 py-4 last:border-0"
                    :class="i < 3 ? 'bg-gold-400/[0.04]' : ''"
                >
                    <div class="flex min-w-0 items-center gap-4">
                        <span
                            class="font-display w-8 shrink-0 text-center text-xl"
                            :class="i === 0 ? 'text-gold-300' : i < 3 ? 'text-gold-400/60' : 'text-white/30'"
                        >
                            {{ i + 1 }}
                        </span>
                        <div class="min-w-0">
                            <div class="truncate font-medium text-white">{{ entry.name }}</div>
                            <div class="truncate text-xs text-white/40">
                                {{ entry.position || 'без посади' }}
                                <template v-if="category === 'xp'"> · рівень активності {{ entry.level }}</template>
                            </div>
                        </div>
                    </div>

                    <span v-if="category === 'xp'" class="shrink-0 whitespace-nowrap font-display text-xl text-gold-300">{{ entry.xp }} очок досвіду</span>
                    <span v-else-if="category === 'bizwar'" class="shrink-0 text-right font-display text-xl text-gold-300">
                        {{ entry.kapt_wins }}–{{ entry.kapt_losses }}
                        <span v-if="winrate(entry) !== null" class="block text-xs font-normal text-white/40">{{ winrate(entry) }}% перемог</span>
                    </span>
                    <span v-else-if="category === 'contracts'" class="shrink-0 text-right font-display text-xl text-gold-300">
                        {{ entry.contracts_count }}
                        <span v-if="entry.heavy_contracts_count" class="block text-xs font-normal text-white/40">{{ entry.heavy_contracts_count }} важких</span>
                    </span>
                    <span v-else-if="category === 'streak'" class="shrink-0 text-right font-display text-xl text-gold-300">
                        {{ entry.current_streak }}
                        <span class="block text-xs font-normal text-white/40">найдовша: {{ entry.longest_streak }}</span>
                    </span>
                    <span v-else-if="category === 'bonuses'" class="shrink-0 whitespace-nowrap font-display text-xl text-gold-300">
                        {{ entry.total_amount.toLocaleString('uk-UA') }} ₴
                    </span>
                    <span v-else-if="category === 'balance'" class="shrink-0 whitespace-nowrap font-display text-xl text-gold-300">
                        {{ entry.balance.toLocaleString('uk-UA') }} ₴
                    </span>
                </div>
                <div v-if="leaderboard.length === 0" class="px-6 py-12 text-center text-white/30">
                    Поки що порожньо
                </div>
            </div>
        </div>
    </div>
</template>
