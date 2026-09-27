<script setup>
import { Head, Link } from '@inertiajs/vue3';
import Sparkline from '@/Components/Sparkline.vue';

const props = defineProps({
    profile: { type: Object, required: true },
    achievements: { type: Array, default: () => [] },
    battleLog: { type: Array, default: () => [] },
});

function fmtDate(iso) {
    return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const sourceLabels = { report: 'звіт', weekly_bonus: 'тижневий бонус', manual: 'коригування' };
</script>

<template>
    <Head title="Мій прогрес" />

    <div class="min-h-screen bg-obsidian-950 font-sans text-white/80">
        <header class="border-b border-white/5 bg-obsidian-900/60 backdrop-blur-md">
            <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
                <div>
                    <Link :href="route('dashboard')" class="text-xs uppercase tracking-widest text-white/40 hover:text-gold-300">
                        ← Кабінет
                    </Link>
                    <h1 class="font-display mt-2 text-3xl font-light text-white">
                        Мій <span class="text-gradient-gold italic">прогрес</span>
                    </h1>
                </div>
                <Link
                    v-if="route().has('progression.leaderboard')"
                    :href="route('progression.leaderboard')"
                    class="rounded-xl border border-gold-400/40 px-5 py-2 text-xs font-medium tracking-widest text-gold-200 hover:border-gold-300"
                >
                    РЕЙТИНГ
                </Link>
            </div>
        </header>

        <div class="mx-auto max-w-5xl px-6 py-10">
            <!-- Основная карточка: досвід / рівень / ранг -->
            <div v-reveal v-glow class="glass-panel-gold glass-panel mb-10 p-8 text-center">
                <p class="text-xs uppercase tracking-[0.4em] text-gold-300/80">
                    {{ profile.position || 'Посаду ще не призначено' }}
                </p>
                <div class="font-display mt-3 text-6xl font-light text-gradient-gold">{{ profile.xp }}</div>
                <p class="mt-1 text-sm text-white/40">Досвід · Рівень активності {{ profile.level }}</p>

                <div v-if="profile.xpTrend?.length > 1" class="mx-auto mt-6 max-w-lg">
                    <Sparkline :points="profile.xpTrend" />
                    <p class="mt-1 text-[10px] uppercase tracking-widest text-white/25">Динаміка за останні нарахування</p>
                </div>

                <div class="mx-auto mt-8 grid max-w-lg grid-cols-4 gap-4 border-t border-white/10 pt-6 text-center">
                    <div>
                        <div class="font-display text-2xl text-white">{{ profile.kapt_wins }}</div>
                        <div class="text-[10px] uppercase tracking-widest text-white/40">Перемоги</div>
                    </div>
                    <div>
                        <div class="font-display text-2xl text-white">{{ profile.kapt_losses }}</div>
                        <div class="text-[10px] uppercase tracking-widest text-white/40">Поразки</div>
                    </div>
                    <div>
                        <div class="font-display text-2xl text-white">{{ profile.contracts_count }}</div>
                        <div class="text-[10px] uppercase tracking-widest text-white/40">Контракти</div>
                    </div>
                    <div>
                        <div class="font-display text-2xl text-white">{{ profile.current_streak }}</div>
                        <div class="text-[10px] uppercase tracking-widest text-white/40">Серія</div>
                    </div>
                </div>
            </div>

            <!-- Досягнення -->
            <h2 class="font-display mb-4 text-xl text-white">Досягнення</h2>
            <div v-reveal:80 class="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div
                    v-for="a in achievements"
                    :key="a.code"
                    class="rounded-xl border p-4 text-center transition-all"
                    :class="a.earned ? 'border-gold-400/40 bg-gold-400/10' : 'border-white/10 bg-white/[0.02] opacity-40'"
                >
                    <p class="text-sm font-medium" :class="a.earned ? 'text-gold-200' : 'text-white/50'">{{ a.name }}</p>
                    <p class="mt-1 text-[11px] text-white/40">{{ a.description }}</p>
                </div>
            </div>

            <!-- Історія нарахувань -->
            <h2 class="font-display mb-4 text-xl text-white">Історія нарахувань</h2>
            <div v-reveal:160 v-glow class="glass-panel overflow-hidden">
                <div
                    v-for="entry in battleLog"
                    :key="entry.id"
                    class="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-5 py-3 text-sm last:border-0"
                >
                    <div class="min-w-0">
                        <span class="text-white/70">{{ entry.reason }}</span>
                        <span class="ml-2 text-xs text-white/30">({{ sourceLabels[entry.source_type] }})</span>
                    </div>
                    <div class="flex shrink-0 flex-wrap items-center gap-3">
                        <span class="whitespace-nowrap" :class="entry.amount >= 0 ? 'text-emerald-300' : 'text-ember-500'">
                            {{ entry.amount >= 0 ? '+' : '' }}{{ entry.amount }} очок досвіду
                        </span>
                        <span class="whitespace-nowrap text-xs text-white/30">{{ fmtDate(entry.created_at) }}</span>
                    </div>
                </div>
                <div v-if="battleLog.length === 0" class="px-5 py-10 text-center text-white/30">
                    Ще немає записів
                </div>
            </div>
        </div>
    </div>
</template>
