<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';

const modes = [
    { key: 'incremental', label: 'Нові та оновлені' },
    { key: 'reconcile', label: 'Звірити каталог' },
    { key: 'missing', label: 'Заповнити пропуски' },
    { key: 'full', label: 'Повна синхронізація' },
];
const mode = ref('incremental');
const batch = ref(100);
const dryRun = ref(false);
const runs = ref([]);
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const notice = ref('');
let timer;
const activeMode = computed(() => runs.value.some((run) => run.mode === mode.value && ['queued', 'running'].includes(run.status)));

async function loadRuns() {
    try {
        const { data } = await window.axios.get(route('admin.cinema.kodik.runs'), { params: { per_page: 20 } });
        runs.value = data.data;
        error.value = '';
    } catch (e) {
        error.value = e.response?.data?.message ?? 'Не вдалося отримати запуски Kodik.';
    } finally {
        loading.value = false;
    }
}

async function start() {
    if (busy.value || activeMode.value) return;
    if (mode.value === 'full' && !window.confirm('Повністю пройти каталог Kodik? Це може тривати довго.')) return;
    busy.value = true;
    notice.value = '';
    error.value = '';
    try {
        await window.axios.post(route('admin.cinema.kodik.sync'), {
            mode: mode.value,
            batch: Number(batch.value),
            dry_run: dryRun.value,
            ...(mode.value === 'full' ? { confirm_full: true } : {}),
        });
        notice.value = dryRun.value ? 'Перевірку поставлено в чергу. Дані не будуть змінені.' : 'Синхронізацію поставлено в чергу.';
        await loadRuns();
    } catch (e) {
        error.value = e.response?.data?.message ?? 'Не вдалося запустити синхронізацію.';
    } finally {
        busy.value = false;
    }
}

async function rebind(scope) {
    if (busy.value) return;
    if (scope === 'all' && !window.confirm('Повторно знайти плеєри для всіх тайтлів? Обробка піде у фонову чергу.')) return;
    busy.value = true;
    notice.value = '';
    error.value = '';
    try {
        const { data } = await window.axios.post(route('admin.cinema.kodik.rebind'), {
            scope, ...(scope === 'all' ? { confirm: true } : {}),
        });
        notice.value = `У черзі: ${data.queued} тайтлів. Переглядайте прогрес нижче.`;
        await loadRuns();
    } catch (e) {
        error.value = e.response?.data?.message ?? 'Не вдалося поставити тайтли в чергу.';
    } finally {
        busy.value = false;
    }
}

onMounted(() => { loadRuns(); timer = window.setInterval(loadRuns, 8000); });
onUnmounted(() => window.clearInterval(timer));
</script>

<template>
    <section class="space-y-5">
        <div class="glass-panel p-4 sm:p-6">
            <h2 class="text-lg font-semibold text-white">Синхронізація Kodik</h2>
            <p class="mt-1 text-sm text-white/50">Каталог обробляється у фоновій черзі. Повторний запуск активного режиму вимкнено.</p>
            <p v-if="error" role="alert" class="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-200">{{ error }}</p>
            <p v-if="notice" role="status" class="mt-4 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-200">{{ notice }}</p>
            <div class="mt-5 flex flex-wrap items-end gap-3">
                <label class="text-xs text-white/60">Режим
                    <select v-model="mode" class="mt-1 block rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white">
                        <option v-for="item in modes" :key="item.key" :value="item.key">{{ item.label }}</option>
                    </select>
                </label>
                <label class="text-xs text-white/60">Записів на запит (1–100)
                    <input v-model.number="batch" type="number" min="1" max="100" class="mt-1 block w-36 rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white" />
                </label>
                <label class="flex items-center gap-2 pb-2 text-sm text-white/70"><input v-model="dryRun" type="checkbox" /> Лише перевірка</label>
                <button type="button" :disabled="busy || activeMode || batch < 1 || batch > 100" class="rounded-lg bg-gold-400 px-4 py-2 text-sm font-semibold text-obsidian-950 disabled:opacity-40" @click="start">
                    {{ activeMode ? 'Режим уже працює' : busy ? 'Запускаю…' : 'Запустити' }}
                </button>
            </div>
            <div class="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
                <button type="button" :disabled="busy" class="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 disabled:opacity-40" @click="rebind('missing')">Пошук для відсутніх плеєрів</button>
                <button type="button" :disabled="busy" class="rounded-lg border border-amber-400/30 px-4 py-2 text-sm text-amber-100 disabled:opacity-40" @click="rebind('all')">Повторний пошук для всіх</button>
            </div>
        </div>
        <div class="glass-panel overflow-x-auto p-4 sm:p-6">
            <div class="mb-4 flex items-center justify-between gap-3"><h3 class="font-semibold text-white">Останні запуски</h3><button class="text-xs text-gold-300" @click="loadRuns">Оновити</button></div>
            <p v-if="loading" class="text-sm text-white/50">Завантаження…</p>
            <p v-else-if="!runs.length" class="text-sm text-white/50">Запусків поки немає.</p>
            <table v-else class="w-full min-w-[650px] text-left text-xs text-white/70">
                <thead class="border-b border-white/10 text-white/40"><tr><th class="py-2">№</th><th>Режим</th><th>Статус</th><th>Оброблено</th><th>Події</th><th>Початок</th></tr></thead>
                <tbody><tr v-for="run in runs" :key="run.id" class="border-b border-white/5"><td class="py-3">{{ run.id }}</td><td>{{ run.mode }}</td><td>{{ run.status }}</td><td>{{ run.counters?.completed ?? run.counters?.processed ?? 0 }} / {{ run.counters?.queued ?? '—' }}</td><td>{{ run.events_count }}</td><td>{{ run.started_at ? new Date(run.started_at).toLocaleString('uk-UA') : '—' }}</td></tr></tbody>
            </table>
        </div>
    </section>
</template>
