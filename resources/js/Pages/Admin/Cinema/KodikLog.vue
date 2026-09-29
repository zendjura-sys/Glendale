<script setup>
import { onMounted, ref } from 'vue';

const runs = ref([]);
const events = ref([]);
const selectedRun = ref(null);
const runPage = ref(1);
const eventPage = ref(1);
const runLastPage = ref(1);
const eventLastPage = ref(1);
const status = ref('');
const action = ref('');
const error = ref('');
const loading = ref(false);

async function loadRuns(page = 1) {
    loading.value = true;
    try {
        const { data } = await window.axios.get(route('admin.cinema.kodik.runs'), { params: { page, per_page: 20 } });
        runs.value = data.data;
        runPage.value = data.current_page;
        runLastPage.value = data.last_page;
        error.value = '';
    } catch (e) {
        error.value = e.response?.data?.message ?? 'Не вдалося отримати журнал.';
    } finally {
        loading.value = false;
    }
}

async function loadEvents(page = 1) {
    if (!selectedRun.value) return;
    loading.value = true;
    try {
        const { data } = await window.axios.get(route('admin.cinema.kodik.events', { run: selectedRun.value.id }), {
            params: { page, per_page: 20, status: status.value || undefined, action: action.value || undefined },
        });
        events.value = data.data;
        eventPage.value = data.current_page;
        eventLastPage.value = data.last_page;
        error.value = '';
    } catch (e) {
        error.value = e.response?.data?.message ?? 'Не вдалося отримати події.';
    } finally {
        loading.value = false;
    }
}

function selectRun(run) {
    selectedRun.value = run;
    status.value = '';
    action.value = '';
    events.value = [];
    loadEvents();
}

onMounted(() => loadRuns());
</script>

<template>
    <section class="space-y-5">
        <div class="glass-panel p-4 sm:p-6">
            <div class="flex items-center justify-between"><h2 class="text-lg font-semibold text-white">Журнал Kodik</h2><button class="text-xs text-gold-300" @click="loadRuns(runPage)">Оновити</button></div>
            <p class="mt-1 text-xs text-white/45">Історія запусків зберігається 90 днів, події — 30 днів.</p>
            <p v-if="error" role="alert" class="mt-3 text-sm text-red-200">{{ error }}</p>
            <p v-if="loading && !runs.length" class="mt-4 text-sm text-white/50">Завантаження…</p>
            <p v-else-if="!runs.length" class="mt-4 text-sm text-white/50">Запусків немає.</p>
            <div v-else class="mt-4 space-y-2">
                <button v-for="run in runs" :key="run.id" type="button" class="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-3 text-left text-sm" :class="selectedRun?.id === run.id ? 'border-gold-400/50 bg-gold-400/10 text-white' : 'border-white/10 text-white/70 hover:bg-white/5'" @click="selectRun(run)">
                    <span>#{{ run.id }} · {{ run.mode }} · {{ run.status }}</span>
                    <span class="text-xs text-white/45">{{ run.events_count }} подій · {{ run.created_at ? new Date(run.created_at).toLocaleString('uk-UA') : '—' }}</span>
                </button>
                <div class="flex items-center gap-3 pt-2 text-xs text-white/50"><button :disabled="runPage <= 1" class="disabled:opacity-30" @click="loadRuns(runPage - 1)">← Назад</button><span>{{ runPage }} / {{ runLastPage }}</span><button :disabled="runPage >= runLastPage" class="disabled:opacity-30" @click="loadRuns(runPage + 1)">Далі →</button></div>
            </div>
        </div>
        <div v-if="selectedRun" class="glass-panel p-4 sm:p-6">
            <h3 class="font-semibold text-white">Події запуску #{{ selectedRun.id }}</h3>
            <div class="mt-4 flex flex-wrap gap-2">
                <input v-model="status" class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white" placeholder="Статус" @keyup.enter="loadEvents()" />
                <input v-model="action" class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white" placeholder="Дія" @keyup.enter="loadEvents()" />
                <button class="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/80" @click="loadEvents()">Фільтрувати</button>
            </div>
            <p v-if="!events.length" class="mt-5 text-sm text-white/50">Подій за цими фільтрами немає.</p>
            <div v-else class="mt-4 space-y-3">
                <details v-for="event in events" :key="event.id" class="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm text-white/70">
                    <summary class="cursor-pointer">{{ event.action }} · {{ event.status }} <span class="text-white/40">#{{ event.title_id ?? '—' }} · {{ event.created_at ? new Date(event.created_at).toLocaleString('uk-UA') : '' }}</span></summary>
                    <p v-if="event.message" class="mt-2">{{ event.message }}</p>
                    <pre v-if="event.identifiers || event.context" class="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-black/20 p-3 text-xs text-white/60">{{ JSON.stringify({ identifiers: event.identifiers, context: event.context }, null, 2) }}</pre>
                </details>
                <div class="flex items-center gap-3 pt-2 text-xs text-white/50"><button :disabled="eventPage <= 1" class="disabled:opacity-30" @click="loadEvents(eventPage - 1)">← Назад</button><span>{{ eventPage }} / {{ eventLastPage }}</span><button :disabled="eventPage >= eventLastPage" class="disabled:opacity-30" @click="loadEvents(eventPage + 1)">Далі →</button></div>
            </div>
        </div>
    </section>
</template>
