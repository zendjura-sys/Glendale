<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { Head, Link, router, useForm, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

// Кінопортал: ключі TMDB і Kodik (зберігаються зашифрованими й назад у
// форму не віддаються), імпорт фільмів і серіалів, керування каталогом.
const props = defineProps({
    titles: { type: Object, required: true },
    filters: { type: Object, default: () => ({}) },
    settings: { type: Object, required: true },
    stats: { type: Object, required: true },
});

const page = usePage();
const flash = computed(() => page.props.flash?.status);
const errors = computed(() => page.props.errors ?? {});

const tabs = [
    { key: 'catalog', label: 'Каталог' },
    { key: 'import', label: 'Імпорт із TMDB' },
    { key: 'settings', label: 'Налаштування' },
];
const tab = ref(props.settings.tmdbConfigured ? 'catalog' : 'settings');

/* налаштування */
const settingsForm = useForm({
    tmdbKey: '',
    kodikToken: '',
    flixcdnToken: '',
    language: props.settings.language,
    clearTmdb: false,
    clearKodik: false,
    clearFlixcdn: false,
});
const saveSettings = () =>
    settingsForm.put(route('admin.cinema.settings'), {
        preserveScroll: true,
        onSuccess: () => settingsForm.reset('tmdbKey', 'kodikToken', 'flixcdnToken', 'clearTmdb', 'clearKodik', 'clearFlixcdn'),
    });

/* імпорт за посиланням */
const importForm = useForm({ reference: '' });
const importOne = () => importForm.post(route('admin.cinema.import'), { preserveScroll: true, onSuccess: () => importForm.reset() });

/* списки TMDB */
const LISTS = [
    { key: 'trending', label: 'У тренді' },
    { key: 'popular_movies', label: 'Популярні фільми' },
    { key: 'popular_series', label: 'Популярні серіали' },
    { key: 'top_movies', label: 'Топ фільмів' },
    { key: 'top_series', label: 'Топ серіалів' },
    { key: 'now_playing', label: 'Зараз у кіно' },
    { key: 'anime', label: 'Аніме' },
    { key: 'dorama', label: 'Дорами' },
    { key: 'cartoons', label: 'Мультфільми' },
];
const list = ref('trending');
const tmdbQuery = ref('');
const tmdbPage = ref(1);
const results = ref([]);
const loading = ref(false);
const tmdbError = ref('');
const importing = ref({});

async function loadTmdb(reset = true) {
    if (reset) tmdbPage.value = 1;
    loading.value = true;
    tmdbError.value = '';
    try {
        const { data } = await window.axios.get(route('admin.cinema.tmdb'), {
            params: { list: tmdbQuery.value.trim() ? 'search' : list.value, q: tmdbQuery.value.trim() || undefined, page: tmdbPage.value },
        });
        results.value = reset ? data : [...results.value, ...data];
    } catch (e) {
        tmdbError.value = e.response?.data?.message ?? 'Не вдалося отримати список TMDB';
    } finally {
        loading.value = false;
    }
}
function pickList(key) {
    list.value = key;
    tmdbQuery.value = '';
    loadTmdb();
}
function more() {
    tmdbPage.value++;
    loadTmdb(false);
}
async function importRow(row) {
    const k = row.type + row.tmdbId;
    importing.value[k] = 'busy';
    try {
        await window.axios.post(route('admin.cinema.import'), { type: row.type, tmdbId: row.tmdbId }, { headers: { Accept: 'application/json' } });
        row.imported = true;
        importing.value[k] = 'done';
    } catch (e) {
        importing.value[k] = e.response?.data?.message ?? 'Помилка';
    }
}
function openImport() {
    tab.value = 'import';
    if (!results.value.length && props.settings.tmdbConfigured) loadTmdb();
}

const bulkForm = useForm({ list: 'popular_movies', pages: 2 });
const bulk = () => bulkForm.post(route('admin.cinema.bulk'), { preserveScroll: true });

// «Проставити Kodik/FlixCDN на всі» — окремо, кожне джерело шукається
// лише там, де його ще бракує (до 500 за клік, повторний клік — решта).
const attachingPlayers = ref(null);
function bulkAttachPlayers(source) {
    attachingPlayers.value = source;
    router.post(
        route('admin.cinema.bulk-attach-players'),
        { source },
        { preserveScroll: true, onFinish: () => (attachingPlayers.value = null) },
    );
}

/* каталог */
const q = ref(props.filters.q ?? '');
const type = ref(props.filters.type ?? '');
function filter() {
    router.get(route('admin.cinema.index'), { q: q.value || undefined, type: type.value || undefined }, { preserveState: true, preserveScroll: true, replace: true });
}
const toggle = (t, field) => router.patch(route('admin.cinema.update', t.id), { [field]: !t[field] }, { preserveScroll: true });
// tmdb_id/shikimori_id — приховані від користувачів, лише для адмінки:
// Kodik шукає плеєр саме за ними (shikimori_id найточніший для аніме/дорам).
function saveExternalIds(t, event) {
    const value = event.target.value.trim();
    router.patch(route('admin.cinema.update', t.id), { [event.target.dataset.field]: value === '' ? null : Number(value) }, { preserveScroll: true });
}
const refresh = (t) => router.post(route('admin.cinema.refresh', t.id), {}, { preserveScroll: true });
const kodik = (t) => router.post(route('admin.cinema.kodik', t.id), {}, { preserveScroll: true });
const flixcdn = (t) => router.post(route('admin.cinema.flixcdn', t.id), {}, { preserveScroll: true });
function destroy(t) {
    if (confirm(`Видалити «${t.name}» з каталогу? Оцінки й прогрес перегляду теж зникнуть.`)) router.delete(route('admin.cinema.destroy', t.id), { preserveScroll: true });
}

const field = 'w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold-400/40 focus:ring-0';
const pill = 'rounded-xl border px-4 py-1.5 text-xs transition-colors';
const pillOn = 'border-gold-400/60 bg-gold-400/15 text-gold-100';
const pillOff = 'border-white/10 text-white/60 hover:bg-white/5';
const btn = 'rounded-xl bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-obsidian-950 disabled:opacity-40';
const act = 'rounded-lg px-2 py-1 text-[11px] text-white/55 hover:bg-white/5 hover:text-white';
</script>

<template>
    <Head title="Кінопортал" />
    <AdminLayout title="Кінопортал">
        <p v-if="flash" class="mb-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{{ flash }}</p>
        <p v-for="(e, k) in errors" :key="k" class="mb-5 rounded-xl border border-ember-500/30 bg-ember-500/10 px-4 py-3 text-sm text-red-200">{{ e }}</p>

        <!-- Плитки-статистика -->
        <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div v-for="s in [
                { l: 'Фільми', v: stats.movies },
                { l: 'Серіали', v: stats.series },
                { l: 'З плеєром', v: stats.withPlayer },
                { l: 'Оцінки', v: stats.reviews },
                { l: 'У «Хочу подивитись»', v: stats.watchlist },
            ]" :key="s.l" class="glass-panel p-4">
                <div class="text-2xl font-bold text-white">{{ s.v }}</div>
                <div class="text-xs text-white/45">{{ s.l }}</div>
            </div>
        </div>

        <div v-if="!settings.tmdbConfigured" class="mb-6 rounded-xl border border-gold-400/30 bg-gold-400/10 px-4 py-3 text-sm text-gold-100">
            Щоб імпортувати фільми, вкажіть ключ TMDB у вкладці «Налаштування». Ключ безкоштовний: themoviedb.org → Settings → API.
        </div>

        <div class="mb-6 flex flex-wrap gap-2">
            <button v-for="t in tabs" :key="t.key" :class="[pill, tab === t.key ? pillOn : pillOff]" @click="t.key === 'import' ? openImport() : (tab = t.key)">
                {{ t.label }}
            </button>
            <a href="/cinema" class="ml-auto rounded-xl border border-white/10 px-4 py-1.5 text-xs text-white/60 hover:bg-white/5">Відкрити кінопортал →</a>
        </div>

        <!-- Каталог -->
        <section v-if="tab === 'catalog'" class="glass-panel p-4 sm:p-6">
            <form class="mb-4 flex flex-wrap gap-2" @submit.prevent="filter">
                <input v-model="q" :class="field" class="!w-auto flex-1" placeholder="Пошук у каталозі" />
                <select v-model="type" :class="field" class="!w-auto" @change="filter">
                    <option value="">Усі</option>
                    <option value="movie">Фільми</option>
                    <option value="series">Серіали</option>
                </select>
                <button :class="btn">Знайти</button>
            </form>

            <div v-if="settings.kodikConfigured || settings.flixcdnConfigured" class="mb-4 flex flex-wrap gap-2">
                <button
                    v-if="settings.kodikConfigured"
                    :class="[pill, pillOff]"
                    :disabled="attachingPlayers === 'kodik'"
                    @click="bulkAttachPlayers('kodik')"
                >
                    {{ attachingPlayers === 'kodik' ? 'Ставлю в чергу…' : 'Проставити Kodik на всі' }}
                </button>
                <button
                    v-if="settings.flixcdnConfigured"
                    :class="[pill, pillOff]"
                    :disabled="attachingPlayers === 'flixcdn'"
                    @click="bulkAttachPlayers('flixcdn')"
                >
                    {{ attachingPlayers === 'flixcdn' ? 'Ставлю в чергу…' : 'Проставити FlixCDN на всі' }}
                </button>
            </div>

            <div v-if="!titles.data.length" class="py-12 text-center text-sm text-white/40">
                Каталог порожній. <button class="text-gold-300 underline" @click="openImport">Імпортувати з TMDB</button>
            </div>

            <div class="divide-y divide-white/5">
                <div v-for="t in titles.data" :key="t.id" class="flex items-center gap-3 py-3">
                    <img v-if="t.poster" :src="t.poster" class="h-16 w-11 shrink-0 rounded-md object-cover" alt="" loading="lazy" />
                    <div v-else class="h-16 w-11 shrink-0 rounded-md bg-white/5"></div>
                    <div class="min-w-0 flex-1">
                        <a :href="`/cinema/title/${t.id}`" class="block truncate font-medium text-white hover:text-gold-200">{{ t.name }}</a>
                        <div class="flex flex-wrap gap-x-3 text-xs text-white/45">
                            <span>{{ t.type === 'series' ? 'Серіал' : 'Фільм' }}{{ t.year ? ' · ' + t.year : '' }}</span>
                            <span v-if="t.rating">TMDB {{ t.rating }}</span>
                            <span v-if="t.localRating" class="text-emerald-300/80">GameCon {{ t.localRating }}</span>
                            <span :class="t.hasPlayer ? 'text-emerald-300/80' : 'text-red-300/80'">{{ t.hasPlayer ? '▶ плеєр є' : 'без плеєра' }}</span>
                        </div>
                        <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/40">
                            <label class="flex items-center gap-1">
                                TMDB ID
                                <input
                                    type="number"
                                    :value="t.tmdbId"
                                    data-field="tmdb_id"
                                    class="w-20 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-white/80 focus:border-gold-400/40 focus:ring-0"
                                    @change="saveExternalIds(t, $event)"
                                />
                            </label>
                            <label class="flex items-center gap-1">
                                Shikimori ID
                                <input
                                    type="number"
                                    :value="t.shikimoriId"
                                    data-field="shikimori_id"
                                    placeholder="для аніме/дорам"
                                    class="w-28 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-white/80 placeholder:text-white/25 focus:border-gold-400/40 focus:ring-0"
                                    @change="saveExternalIds(t, $event)"
                                />
                            </label>
                        </div>
                    </div>
                    <div class="flex shrink-0 flex-wrap items-center justify-end gap-1">
                        <button :class="[act, t.published ? 'text-emerald-300' : 'text-white/35']" :title="t.published ? 'Опубліковано' : 'Приховано'" @click="toggle(t, 'published')">
                            {{ t.published ? 'Опубліковано' : 'Приховано' }}
                        </button>
                        <button :class="[act, t.featured ? 'text-gold-300' : '']" @click="toggle(t, 'featured')">{{ t.featured ? '★ На головній' : '☆ На головну' }}</button>
                        <button :class="act" @click="refresh(t)">Оновити</button>
                        <button v-if="settings.kodikConfigured" :class="act" @click="kodik(t)">Шукати Kodik</button>
                        <button v-if="settings.flixcdnConfigured" :class="act" @click="flixcdn(t)">Шукати FlixCDN</button>
                        <button :class="act" class="hover:!text-red-300" @click="destroy(t)">Видалити</button>
                    </div>
                </div>
            </div>

            <div v-if="titles.links?.length > 3" class="mt-5 flex flex-wrap gap-2">
                <Link
                    v-for="link in titles.links"
                    :key="link.label"
                    :href="link.url || ''"
                    preserve-scroll
                    class="rounded-xl border px-3 py-1.5 text-xs"
                    :class="[link.active ? pillOn : pillOff, !link.url && 'pointer-events-none opacity-30']"
                    v-html="link.label"
                />
            </div>
        </section>

        <!-- Імпорт -->
        <div v-if="tab === 'import'" class="space-y-6">
            <section class="glass-panel p-6">
                <h2 class="text-lg font-semibold text-white">За посиланням</h2>
                <p class="mb-4 text-xs text-white/45">Вставте посилання з themoviedb.org (…/movie/603 або …/tv/1399) чи «movie:603». Опис, актори, трейлер і сезони завантажаться, плеєр Kodik знайдеться автоматично.</p>
                <form class="flex flex-wrap gap-2" @submit.prevent="importOne">
                    <input v-model="importForm.reference" :class="field" class="!w-auto flex-1" placeholder="https://www.themoviedb.org/movie/603-the-matrix" />
                    <button :class="btn" :disabled="importForm.processing || !importForm.reference">{{ importForm.processing ? 'Імпортую…' : 'Імпортувати' }}</button>
                </form>
            </section>

            <section class="glass-panel p-6">
                <h2 class="text-lg font-semibold text-white">Каталог TMDB</h2>
                <div class="my-4 flex flex-wrap gap-2">
                    <button v-for="l in LISTS" :key="l.key" :class="[pill, list === l.key && !tmdbQuery ? pillOn : pillOff]" @click="pickList(l.key)">{{ l.label }}</button>
                </div>
                <form class="mb-4 flex gap-2" @submit.prevent="loadTmdb()">
                    <input v-model="tmdbQuery" :class="field" placeholder="Пошук на TMDB: назва фільму чи серіалу" />
                    <button :class="btn">Шукати</button>
                </form>
                <p v-if="tmdbError" class="mb-3 text-sm text-red-300">{{ tmdbError }}</p>
                <div class="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                    <div v-for="r in results" :key="r.type + r.tmdbId" class="min-w-0">
                        <div class="relative aspect-[2/3] overflow-hidden rounded-xl bg-white/5">
                            <img v-if="r.poster" :src="r.poster" class="h-full w-full object-cover" alt="" loading="lazy" />
                            <span class="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] uppercase text-white/80">{{ r.type === 'series' ? 'серіал' : 'фільм' }}</span>
                        </div>
                        <div class="mt-2 truncate text-sm font-medium text-white" :title="r.name">{{ r.name }}</div>
                        <div class="text-xs text-white/40">{{ r.year ?? '—' }}</div>
                        <button
                            class="mt-2 w-full rounded-lg border px-2 py-1.5 text-xs"
                            :class="r.imported ? 'border-emerald-400/30 text-emerald-300' : 'border-gold-400/40 text-gold-200 hover:bg-gold-400/10'"
                            :disabled="r.imported || importing[r.type + r.tmdbId] === 'busy'"
                            @click="importRow(r)"
                        >
                            {{ r.imported ? '✓ У каталозі' : importing[r.type + r.tmdbId] === 'busy' ? 'Імпортую…' : 'Імпортувати' }}
                        </button>
                        <p v-if="importing[r.type + r.tmdbId] && !['busy', 'done'].includes(importing[r.type + r.tmdbId])" class="mt-1 text-[11px] text-red-300">{{ importing[r.type + r.tmdbId] }}</p>
                    </div>
                </div>
                <div v-if="loading" class="py-6 text-center text-sm text-white/40">Завантаження…</div>
                <div v-else-if="results.length && !tmdbQuery" class="mt-5 text-center">
                    <button :class="[pill, pillOff]" @click="more">Показати ще</button>
                </div>
            </section>

            <section class="glass-panel p-6">
                <h2 class="text-lg font-semibold text-white">Масовий імпорт</h2>
                <p class="mb-4 text-xs text-white/45">Ставить у чергу цілий список (20 тайтлів на сторінку). Уже наявні пропускаються.</p>
                <form class="flex flex-wrap items-center gap-2" @submit.prevent="bulk">
                    <select v-model="bulkForm.list" :class="field" class="!w-auto">
                        <option v-for="l in LISTS" :key="l.key" :value="l.key">{{ l.label }}</option>
                    </select>
                    <select v-model.number="bulkForm.pages" :class="field" class="!w-auto">
                        <option v-for="n in [1, 2, 3, 5, 10]" :key="n" :value="n">{{ n * 20 }} тайтлів</option>
                    </select>
                    <button :class="btn" :disabled="bulkForm.processing">Поставити в чергу</button>
                </form>
            </section>
        </div>

        <!-- Налаштування -->
        <section v-if="tab === 'settings'" class="glass-panel max-w-2xl p-6">
            <form class="space-y-5" @submit.prevent="saveSettings">
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Ключ TMDB</label>
                    <input v-model="settingsForm.tmdbKey" type="password" autocomplete="off" :class="field" :placeholder="settings.tmdbConfigured ? '•••••••• збережено — залиште порожнім, щоб не змінювати' : 'API Key (v3) або API Read Access Token'" />
                    <p class="mt-1 text-xs text-white/35">themoviedb.org → Settings → API. Підходить короткий ключ v3 або довгий токен v4.</p>
                    <label v-if="settings.tmdbConfigured" class="mt-2 flex items-center gap-2 text-xs text-white/50">
                        <input v-model="settingsForm.clearTmdb" type="checkbox" class="rounded border-white/20 bg-obsidian-900 text-gold-400" /> Видалити збережений ключ
                    </label>
                </div>
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Токен Kodik</label>
                    <input v-model="settingsForm.kodikToken" type="password" autocomplete="off" :class="field" :placeholder="settings.kodikConfigured ? '•••••••• збережено — залиште порожнім, щоб не змінювати' : 'Токен з кабінету kodik'" />
                    <p class="mt-1 text-xs text-white/35">Потрібен для вбудованого плеєра. Без нього каталог працює, але дивитися можна лише трейлери.</p>
                    <label v-if="settings.kodikConfigured" class="mt-2 flex items-center gap-2 text-xs text-white/50">
                        <input v-model="settingsForm.clearKodik" type="checkbox" class="rounded border-white/20 bg-obsidian-900 text-gold-400" /> Видалити збережений токен
                    </label>
                </div>
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Токен FlixCDN</label>
                    <input v-model="settingsForm.flixcdnToken" type="password" autocomplete="off" :class="field" :placeholder="settings.flixcdnConfigured ? '•••••••• збережено — залиште порожнім, щоб не змінювати' : 'Токен з кабінету uacdn.live'" />
                    <p class="mt-1 text-xs text-white/35">Другий балансер плеєрів — працює паралельно з Kodik: якщо один не знайде фільм, спробує другий.</p>
                    <label v-if="settings.flixcdnConfigured" class="mt-2 flex items-center gap-2 text-xs text-white/50">
                        <input v-model="settingsForm.clearFlixcdn" type="checkbox" class="rounded border-white/20 bg-obsidian-900 text-gold-400" /> Видалити збережений токен
                    </label>
                </div>
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-white/40">Мова описів</label>
                    <select v-model="settingsForm.language" :class="field" class="!w-auto">
                        <option value="uk-UA">Українська</option>
                        <option value="en-US">English</option>
                        <option value="ru-RU">Русский</option>
                        <option value="de-DE">Deutsch</option>
                        <option value="pl-PL">Polski</option>
                    </select>
                </div>
                <p class="text-xs text-white/35">Ключі зберігаються в базі зашифрованими і після збереження не показуються.</p>
                <button :class="btn" :disabled="settingsForm.processing">Зберегти</button>
            </form>
        </section>
    </AdminLayout>
</template>
