<script setup>
import { computed, onMounted, ref } from 'vue';

const props = defineProps({ title: { type: Object, required: true } });
const emit = defineEmits(['close']);
const seasons = ref([]);
const selectedId = ref(null);
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const notice = ref('');
const seasonForm = ref({ id: null, number: 1, name: '', overview: '' });
const episodeForm = ref({ id: null, number: 1, name: '', overview: '', air_date: '', runtime: '' });
const selected = computed(() => seasons.value.find((season) => season.id === selectedId.value));
const field = 'w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white';

async function load() {
    loading.value = true;
    try {
        const { data } = await window.axios.get(route('admin.cinema.seasons.index', { id: props.title.id }));
        seasons.value = data;
        if (!data.some((season) => season.id === selectedId.value)) selectedId.value = data[0]?.id ?? null;
        error.value = '';
    } catch (e) {
        error.value = e.response?.data?.message ?? 'Не вдалося завантажити сезони.';
    } finally {
        loading.value = false;
    }
}

function resetSeason() { seasonForm.value = { id: null, number: (Math.max(0, ...seasons.value.map((s) => s.number)) + 1), name: '', overview: '' }; }
function resetEpisode() { episodeForm.value = { id: null, number: (Math.max(0, ...(selected.value?.episodes ?? []).map((e) => e.number)) + 1), name: '', overview: '', air_date: '', runtime: '' }; }
function chooseSeason(id) { selectedId.value = id; resetEpisode(); }
function editSeason(season) { seasonForm.value = { id: season.id, number: season.number, name: season.name ?? '', overview: season.overview ?? '' }; }
function editEpisode(episode) { episodeForm.value = { id: episode.id, number: episode.number, name: episode.name ?? '', overview: episode.overview ?? '', air_date: episode.air_date?.slice(0, 10) ?? '', runtime: episode.runtime ?? '' }; }

function showError(e) {
    const errors = e.response?.data?.errors;
    error.value = errors ? Object.values(errors).flat().join(' ') : (e.response?.data?.message ?? 'Операцію не виконано.');
}

async function saveSeason() {
    if (busy.value) return;
    busy.value = true; error.value = ''; notice.value = '';
    const data = { number: Number(seasonForm.value.number), name: seasonForm.value.name || null, overview: seasonForm.value.overview || null };
    try {
        if (seasonForm.value.id) await window.axios.put(route('admin.cinema.seasons.update', { seasonId: seasonForm.value.id }), data);
        else await window.axios.post(route('admin.cinema.seasons.store', { id: props.title.id }), data);
        await load(); resetSeason(); notice.value = 'Сезон збережено.';
    } catch (e) { showError(e); }
    finally { busy.value = false; }
}

async function saveEpisode() {
    if (busy.value || !selected.value) return;
    busy.value = true; error.value = ''; notice.value = '';
    const data = { number: Number(episodeForm.value.number), name: episodeForm.value.name || null, overview: episodeForm.value.overview || null, air_date: episodeForm.value.air_date || null, runtime: episodeForm.value.runtime === '' ? null : Number(episodeForm.value.runtime) };
    try {
        if (episodeForm.value.id) await window.axios.put(route('admin.cinema.episodes.update', { episodeId: episodeForm.value.id }), data);
        else await window.axios.post(route('admin.cinema.episodes.store', { seasonId: selectedId.value }), data);
        await load(); resetEpisode(); notice.value = 'Серію збережено.';
    } catch (e) { showError(e); }
    finally { busy.value = false; }
}

async function removeSeason(season) {
    if (busy.value || !window.confirm(`Видалити сезон ${season.number} разом із серіями?`)) return;
    busy.value = true; error.value = '';
    try { await window.axios.delete(route('admin.cinema.seasons.destroy', { seasonId: season.id })); await load(); resetSeason(); resetEpisode(); notice.value = 'Сезон видалено.'; }
    catch (e) { showError(e); }
    finally { busy.value = false; }
}

async function removeEpisode(episode) {
    if (busy.value || !window.confirm(`Видалити серію ${episode.number}?`)) return;
    busy.value = true; error.value = '';
    try { await window.axios.delete(route('admin.cinema.episodes.destroy', { episodeId: episode.id })); await load(); resetEpisode(); notice.value = 'Серію видалено.'; }
    catch (e) { showError(e); }
    finally { busy.value = false; }
}

onMounted(async () => { await load(); resetSeason(); resetEpisode(); });
</script>

<template>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6" @click.self="emit('close')" @keydown.esc="emit('close')">
        <section role="dialog" aria-modal="true" :aria-label="`Сезони і серії: ${title.name}`" tabindex="-1" class="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-white/15 bg-obsidian-950 p-4 shadow-2xl sm:p-6">
            <div class="flex items-center justify-between gap-3"><div><h2 class="text-xl font-semibold text-white">Сезони й серії</h2><p class="text-sm text-white/50">{{ title.name }}</p></div><button type="button" class="rounded-lg border border-white/15 px-3 py-2 text-sm text-white" @click="emit('close')">Закрити</button></div>
            <p v-if="error" role="alert" class="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-200">{{ error }}</p>
            <p v-if="notice" role="status" class="mt-3 text-sm text-emerald-200">{{ notice }}</p>
            <p v-if="loading" class="mt-5 text-sm text-white/50">Завантаження…</p>
            <div v-else class="mt-5 grid gap-6 lg:grid-cols-[minmax(220px,1fr)_2fr]">
                <div class="space-y-4">
                    <div class="space-y-2"><div v-for="season in seasons" :key="season.id" class="flex items-center gap-1 rounded-lg border border-white/10 p-2" :class="selectedId === season.id ? 'bg-gold-400/10' : ''">
                        <button type="button" class="min-w-0 flex-1 truncate text-left text-sm text-white/80" @click="chooseSeason(season.id)">{{ season.number }} сезон · {{ season.name || 'Без назви' }}</button>
                        <button type="button" class="text-xs text-gold-300" @click="editSeason(season)">Змінити</button>
                        <button type="button" class="text-xs text-red-300" @click="removeSeason(season)">×</button>
                    </div><p v-if="!seasons.length" class="text-sm text-white/45">Сезонів поки немає.</p></div>
                    <form class="space-y-2 border-t border-white/10 pt-4" @submit.prevent="saveSeason">
                        <h3 class="text-sm font-semibold text-white">{{ seasonForm.id ? 'Редагувати сезон' : 'Новий сезон' }}</h3>
                        <label class="block text-xs text-white/60">Номер<input v-model.number="seasonForm.number" type="number" min="0" max="200" required :class="field" class="mt-1" /></label>
                        <label class="block text-xs text-white/60">Назва<input v-model="seasonForm.name" maxlength="200" :class="field" class="mt-1" /></label>
                        <label class="block text-xs text-white/60">Опис<textarea v-model="seasonForm.overview" maxlength="2000" rows="2" :class="field" class="mt-1"></textarea></label>
                        <div class="flex gap-2"><button :disabled="busy" class="rounded-lg bg-gold-400 px-3 py-2 text-xs font-semibold text-obsidian-950 disabled:opacity-40">Зберегти</button><button v-if="seasonForm.id" type="button" class="text-xs text-white/50" @click="resetSeason">Скасувати</button></div>
                    </form>
                </div>
                <div v-if="selected" class="space-y-4 lg:border-l lg:border-white/10 lg:pl-6">
                    <h3 class="font-semibold text-white">{{ selected.number }} сезон · серії</h3>
                    <div class="max-h-64 space-y-2 overflow-y-auto"><div v-for="episode in selected.episodes" :key="episode.id" class="flex items-center gap-2 rounded-lg border border-white/10 p-2 text-sm text-white/70"><span class="min-w-0 flex-1 truncate">{{ episode.number }} · {{ episode.name || 'Без назви' }}</span><button class="text-xs text-gold-300" @click="editEpisode(episode)">Змінити</button><button class="text-xs text-red-300" @click="removeEpisode(episode)">×</button></div><p v-if="!selected.episodes?.length" class="text-sm text-white/45">Серій поки немає.</p></div>
                    <form class="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2" @submit.prevent="saveEpisode">
                        <h4 class="sm:col-span-2 text-sm font-semibold text-white">{{ episodeForm.id ? 'Редагувати серію' : 'Нова серія' }}</h4>
                        <label class="text-xs text-white/60">Номер<input v-model.number="episodeForm.number" type="number" min="1" max="2000" required :class="field" class="mt-1" /></label>
                        <label class="text-xs text-white/60">Назва<input v-model="episodeForm.name" maxlength="200" :class="field" class="mt-1" /></label>
                        <label class="text-xs text-white/60">Дата виходу<input v-model="episodeForm.air_date" type="date" :class="field" class="mt-1" /></label>
                        <label class="text-xs text-white/60">Тривалість, хв<input v-model="episodeForm.runtime" type="number" min="1" max="600" :class="field" class="mt-1" /></label>
                        <label class="sm:col-span-2 text-xs text-white/60">Опис<textarea v-model="episodeForm.overview" maxlength="2000" rows="2" :class="field" class="mt-1"></textarea></label>
                        <div class="sm:col-span-2 flex gap-3"><button :disabled="busy" class="rounded-lg bg-gold-400 px-4 py-2 text-xs font-semibold text-obsidian-950 disabled:opacity-40">Зберегти</button><button v-if="episodeForm.id" type="button" class="text-xs text-white/50" @click="resetEpisode">Скасувати</button></div>
                    </form>
                </div>
                <p v-else class="text-sm text-white/45">Оберіть або додайте сезон для керування серіями.</p>
            </div>
        </section>
    </div>
</template>
