<script setup>
import { onMounted, ref } from 'vue';

const typeOptions = [
    ['foreign-movie', 'Закордонні фільми'], ['soviet-cartoon', 'Радянська анімація'],
    ['foreign-cartoon', 'Закордоння анімація'], ['russian-cartoon', 'Російська анімація'],
    ['anime', 'Аніме-фільми'], ['russian-movie', 'Російські фільми'],
    ['cartoon-serial', 'Мультсеріали'], ['documentary-serial', 'Документальні серіали'],
    ['russian-serial', 'Російські серіали'], ['foreign-serial', 'Закордонні серіали'],
    ['anime-serial', 'Аніме-серіали'], ['multi-part-film', 'Багатосерійні фільми'],
];
const listGroups = [
    { label: 'Регіони й жанри', fields: [
        ['allowed_countries', 'Дозволені країни'], ['blocked_countries', 'Заборонені країни'],
        ['allowed_genres', 'Дозволені жанри'], ['blocked_genres', 'Заборонені жанри'],
    ] },
    { label: 'Переклади', fields: [
        ['translation_ids', 'ID дозволених озвучок'], ['blocked_translation_ids', 'ID заборонених озвучок'],
        ['translation_types', 'Типи: voice, subtitles'],
    ] },
    { label: 'Аніме й дорами', fields: [
        ['anime_kinds', 'Типи аніме'], ['mydramalist_tags', 'Теги MyDramaList'],
        ['anime_statuses', 'Статуси аніме'], ['drama_statuses', 'Статуси дорам'],
        ['anime_studios', 'Студії'], ['anime_licensed_by', 'Ліцензіати'],
    ] },
    { label: 'Додаткові обмеження', fields: [
        ['rating_mpaa', 'Вікові рейтинги MPAA'], ['required_available_in', 'Доступні країни'],
        ['blacklisted_ids', 'Заборонені Kodik ID'],
    ] },
];
const booleans = [
    ['allow_camrip', 'Дозволити CAMRip'], ['allow_lgbt', 'Дозволити контент із позначкою LGBT'],
    ['require_poster', 'Вимагати постер'], ['require_description', 'Вимагати опис'],
    ['update_existing', 'Оновлювати існуючі тайтли'], ['auto_publish', 'Одразу публікувати нові тайтли'],
];
const field = 'w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white';
const policy = ref(null);
const lists = ref({});
const configured = ref(false);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const notice = ref('');

function splitList(value) {
    return value.split(/[\n,]/).map((part) => part.trim()).filter(Boolean);
}

async function load() {
    loading.value = true;
    try {
        const { data } = await window.axios.get(route('admin.cinema.kodik.settings'));
        policy.value = data.policy;
        configured.value = data.configured;
        lists.value = Object.fromEntries(listGroups.flatMap((group) => group.fields).map(([key]) => [key, (data.policy[key] ?? []).join(', ')]));
        error.value = '';
    } catch (e) {
        error.value = e.response?.data?.message ?? 'Не вдалося завантажити правила Kodik.';
    } finally {
        loading.value = false;
    }
}

async function save() {
    saving.value = true;
    error.value = '';
    notice.value = '';
    try {
        const payload = { ...policy.value };
        for (const [key, value] of Object.entries(lists.value)) payload[key] = splitList(value);
        for (const key of ['year_from', 'year_to', 'max_minimal_age']) payload[key] = payload[key] === '' || payload[key] == null ? null : Number(payload[key]);
        payload.ratings = Object.fromEntries(Object.entries(payload.ratings ?? {}).filter(([, value]) => value !== '' && value != null).map(([key, value]) => [key, Number(value)]));
        const { data } = await window.axios.put(route('admin.cinema.kodik.settings.update'), payload);
        policy.value = data.policy;
        notice.value = 'Правила імпорту збережено.';
    } catch (e) {
        const validation = e.response?.data?.errors;
        error.value = validation ? Object.values(validation).flat().join(' ') : (e.response?.data?.message ?? 'Не вдалося зберегти правила.');
    } finally {
        saving.value = false;
    }
}

onMounted(load);
</script>

<template>
    <section class="glass-panel p-4 sm:p-6">
        <h2 class="text-lg font-semibold text-white">Правила імпорту Kodik</h2>
        <p class="mt-1 text-sm text-white/50">Токен налаштовується у загальній вкладці «Налаштування» й тут не відображається.</p>
        <p v-if="!configured && !loading" class="mt-3 text-sm text-amber-200">Спершу збережіть токен Kodik.</p>
        <p v-if="error" role="alert" class="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-200">{{ error }}</p>
        <p v-if="notice" role="status" class="mt-3 text-sm text-emerald-200">{{ notice }}</p>
        <p v-if="loading" class="mt-5 text-sm text-white/50">Завантаження…</p>
        <form v-else-if="policy" class="mt-5 space-y-6" @submit.prevent="save">
            <fieldset><legend class="font-semibold text-white">Типи матеріалів</legend><p class="mb-3 text-xs text-white/40">Без вибору дозволені всі типи.</p>
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><label v-for="[value, label] in typeOptions" :key="value" class="flex items-center gap-2 text-xs text-white/70"><input v-model="policy.types" type="checkbox" :value="value" /> {{ label }}</label></div>
            </fieldset>
            <fieldset class="grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3"><legend class="font-semibold text-white">Межі</legend>
                <label class="text-xs text-white/60">Рік від<input v-model="policy.year_from" type="number" min="1900" max="2100" :class="field" class="mt-1" /></label>
                <label class="text-xs text-white/60">Рік до<input v-model="policy.year_to" type="number" min="1900" max="2100" :class="field" class="mt-1" /></label>
                <label class="text-xs text-white/60">Максимальний мінімальний вік<input v-model="policy.max_minimal_age" type="number" min="0" max="21" :class="field" class="mt-1" /></label>
            </fieldset>
            <fieldset v-for="group in listGroups" :key="group.label" class="border-t border-white/10 pt-5"><legend class="font-semibold text-white">{{ group.label }}</legend>
                <div class="mt-3 grid gap-4 md:grid-cols-2"><label v-for="[key, label] in group.fields" :key="key" class="text-xs text-white/60">{{ label }}<textarea v-model="lists[key]" rows="2" :class="field" class="mt-1" placeholder="Значення через кому або з нового рядка"></textarea></label></div>
            </fieldset>
            <fieldset class="border-t border-white/10 pt-5"><legend class="font-semibold text-white">Мінімальні оцінки</legend><div class="mt-3 grid gap-3 sm:grid-cols-4"><label v-for="source in ['kinopoisk', 'imdb', 'shikimori', 'mydramalist']" :key="source" class="text-xs text-white/60">{{ source }}<input v-model="policy.ratings[source]" type="number" min="0" max="10" step="0.1" :class="field" class="mt-1" /></label></div></fieldset>
            <fieldset class="border-t border-white/10 pt-5"><legend class="font-semibold text-white">Публікація й оновлення</legend><div class="mt-3 grid gap-3 sm:grid-cols-2"><label v-for="[key, label] in booleans" :key="key" class="flex items-center gap-2 text-sm text-white/70"><input v-model="policy[key]" type="checkbox" /> {{ label }}</label></div></fieldset>
            <button type="submit" :disabled="saving" class="rounded-lg bg-gold-400 px-5 py-2 text-sm font-semibold text-obsidian-950 disabled:opacity-40">{{ saving ? 'Зберігаю…' : 'Зберегти правила' }}</button>
        </form>
    </section>
</template>
