<script setup>
import { Head, Link, router } from '@inertiajs/vue3';
import KaptSessionCard from './Partials/KaptSessionCard.vue';

const props = defineProps({
    view: { type: String, default: 'day' },
    date: { type: String, required: true },
    sessions: { type: Array, default: () => [] },
    days: { type: Array, default: () => [] },
    weekStart: { type: String, default: null },
    weekEnd: { type: String, default: null },
});

function go(extra) {
    router.get(route('reports.schedule'), { view: props.view, date: props.date, ...extra }, { preserveState: true });
}

function switchView(view) {
    router.get(route('reports.schedule'), { view, date: props.date }, { preserveState: true });
}

function changeDate(event) {
    go({ date: event.target.value });
}

function shiftDate(steps) {
    const days = props.view === 'week' ? steps * 7 : steps;
    const d = new Date(props.date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    go({ date: d.toISOString().slice(0, 10) });
}

const weekdayNames = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];

function fmtDayLabel(iso) {
    const d = new Date(iso + 'T00:00:00');
    const name = weekdayNames[(d.getDay() + 6) % 7];
    const label = d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
    return `${name}, ${label}`;
}

function fmtRange(a, b) {
    const da = new Date(a + 'T00:00:00').toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
    const db = new Date(b + 'T00:00:00').toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${da} – ${db}`;
}

function isToday(iso) {
    return iso === new Date().toISOString().slice(0, 10);
}
</script>

<template>
    <Head title="Розклад капта" />

    <div class="min-h-screen bg-obsidian-950 font-sans text-white/80">
        <header class="border-b border-white/5 bg-obsidian-900/60 backdrop-blur-md">
            <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-6">
                <div>
                    <Link :href="route('reports.index')" class="text-xs uppercase tracking-widest text-white/40 hover:text-gold-300">
                        ← Мої звіти
                    </Link>
                    <h1 class="font-display mt-2 text-3xl font-light text-white">
                        Розклад <span class="text-gradient-gold italic">капта</span>
                    </h1>
                </div>
            </div>
        </header>

        <div class="mx-auto max-w-5xl px-6 py-10">
            <p class="mb-6 text-sm text-white/40">
                Хто був присутній на капті і який фактичний результат бою — без подвоєння,
                коли за один і той самий бій звітує кілька людей.
            </p>

            <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div class="flex gap-2">
                    <button
                        class="rounded-xl border px-4 py-1.5 text-xs font-medium uppercase tracking-widest transition-colors"
                        :class="view === 'day' ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/10 text-white/40 hover:text-white'"
                        @click="switchView('day')"
                    >
                        День
                    </button>
                    <button
                        class="rounded-xl border px-4 py-1.5 text-xs font-medium uppercase tracking-widest transition-colors"
                        :class="view === 'week' ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/10 text-white/40 hover:text-white'"
                        @click="switchView('week')"
                    >
                        Тиждень
                    </button>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                    <button
                        class="rounded-xl border border-white/10 px-3 py-1.5 text-sm text-white/60 transition-colors hover:border-gold-400/40 hover:text-white"
                        @click="shiftDate(-1)"
                    >
                        ← {{ view === 'week' ? 'Попередній тиждень' : 'Попередній день' }}
                    </button>
                    <input
                        v-if="view === 'day'"
                        type="date"
                        :value="date"
                        class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white"
                        @change="changeDate"
                    />
                    <span v-else class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white">
                        {{ fmtRange(weekStart, weekEnd) }}
                    </span>
                    <button
                        class="rounded-xl border border-white/10 px-3 py-1.5 text-sm text-white/60 transition-colors hover:border-gold-400/40 hover:text-white"
                        @click="shiftDate(1)"
                    >
                        {{ view === 'week' ? 'Наступний тиждень' : 'Наступний день' }} →
                    </button>
                </div>
            </div>

            <!-- ================= ДЕНЬ ================= -->
            <template v-if="view === 'day'">
                <div v-if="sessions.length === 0" class="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-12 text-center text-white/30">
                    На цю дату бізвар-звітів немає.
                </div>
                <KaptSessionCard v-for="session in sessions" :key="session.times.join(',')" :session="session" />
            </template>

            <!-- ================= ТИЖДЕНЬ ================= -->
            <template v-else>
                <div v-for="day in days" :key="day.date" class="mb-8">
                    <h2
                        class="font-display mb-3 flex items-center gap-2 text-lg text-white"
                        :class="isToday(day.date) ? 'text-gold-300' : ''"
                    >
                        {{ fmtDayLabel(day.date) }}
                        <span v-if="isToday(day.date)" class="rounded-xl border border-gold-400/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-gold-300">
                            Сьогодні
                        </span>
                    </h2>

                    <div v-if="day.sessions.length === 0" class="rounded-xl border border-white/5 bg-white/[0.01] px-5 py-3 text-sm text-white/25">
                        Бізвар-звітів немає
                    </div>
                    <KaptSessionCard v-for="session in day.sessions" :key="session.times.join(',')" :session="session" />
                </div>
            </template>
        </div>
    </div>
</template>
