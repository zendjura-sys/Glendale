<script setup>
import { Head, Link, useForm } from '@inertiajs/vue3';
import { ref, watch } from 'vue';
import PhotoGallery from '@/Components/PhotoGallery.vue';
import Modal from '@/Components/Modal.vue';
import { verb } from '@/utils/gendered';

const props = defineProps({
    reports: { type: Object, required: true },
    myId: { type: Number, required: true },
    reportGuides: { type: Object, default: () => ({}) },
});

const showGuide = ref(false);

const today = new Date().toISOString().slice(0, 10);

// Погодинні слоти капта — той самий список, що й на бекенді
// (Report::KAPT_TIMES), фіксується для майбутнього підрахунку премій.
const kaptTimes = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];

const form = useForm({
    type: 'contract',
    report_date: today,
    wins_count: 0,
    losses_count: 0,
    kapt_times: [],
    light_count: 0,
    medium_count: 0,
    heavy_count: 0,
    amount: null,
    description: '',
    subject_type: 'self',
    subject_user_id: null,
    subject_first_name: '',
    subject_last_name: '',
    photos: [],
});

const showForm = ref(false);

/* ================= Фото-доказ ================= */

// Прев'ю тримаємо як object URL поруч із самим File — при видаленні чи
// успішній відправці обов'язково revokeObjectURL, інакше течуть блоби.
const photoPreviews = ref([]);

function onPhotosPicked(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';

    for (const file of files) {
        if (form.photos.length >= 30) break;
        form.photos.push(file);
        photoPreviews.value.push({ file, url: URL.createObjectURL(file) });
    }
}

function removePhoto(i) {
    URL.revokeObjectURL(photoPreviews.value[i].url);
    photoPreviews.value.splice(i, 1);
    form.photos.splice(i, 1);
}

function clearPhotos() {
    photoPreviews.value.forEach((p) => URL.revokeObjectURL(p.url));
    photoPreviews.value = [];
    form.photos = [];
}

/* ================= За себе / за друга ================= */

const friendQuery = ref('');
const friendMatches = ref([]);
const friendSelected = ref(null);
let friendSearchTimer = null;

function setSubjectType(type) {
    form.subject_type = type;
    form.subject_user_id = null;
    friendSelected.value = null;
    friendQuery.value = '';
    friendMatches.value = [];
    form.subject_first_name = '';
    form.subject_last_name = '';
}

watch(friendQuery, (q) => {
    friendSelected.value = null;
    form.subject_user_id = null;
    clearTimeout(friendSearchTimer);
    const [first, ...rest] = q.trim().split(/\s+/);
    form.subject_first_name = first || '';
    form.subject_last_name = rest.join(' ');

    if (q.trim().length < 2) {
        friendMatches.value = [];
        return;
    }
    friendSearchTimer = setTimeout(async () => {
        const { data } = await window.axios.get(route('reports.members.search'), { params: { q } });
        friendMatches.value = data.data.members;
    }, 300);
});

function pickFriend(member) {
    friendSelected.value = member;
    form.subject_user_id = member.id;
    friendQuery.value = member.name;
    friendMatches.value = [];
}

function toggleKaptTime(time) {
    const idx = form.kapt_times.indexOf(time);
    if (idx === -1) {
        form.kapt_times.push(time);
    } else {
        form.kapt_times.splice(idx, 1);
    }
}

function submit() {
    form.post(route('reports.store'), {
        preserveScroll: true,
        onSuccess: () => {
            form.reset(
                'description', 'wins_count', 'losses_count', 'kapt_times', 'light_count', 'medium_count', 'heavy_count', 'amount',
                'subject_type', 'subject_user_id', 'subject_first_name', 'subject_last_name',
            );
            clearPhotos();
            friendQuery.value = '';
            friendSelected.value = null;
            friendMatches.value = [];
            showForm.value = false;
        },
    });
}

const statusMeta = {
    pending: { label: 'На розгляді', class: 'bg-gold-400/15 text-gold-300 border-gold-400/30' },
    approved: { label: 'Затверджено', class: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30' },
    rejected: { label: 'Відхилено', class: 'bg-ember-500/15 text-ember-500 border-ember-500/30' },
};

const typeLabels = { kapt: 'Капт', contract: 'Контракт', bizwar: 'Бізвар', investment: 'Інвестиції', other: 'Інше' };

function fmtDate(iso) {
    return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDateOnly(iso) {
    return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<template>
    <Head title="Мої звіти" />

    <div class="min-h-screen bg-obsidian-950 font-sans text-white/80">
        <header class="border-b border-white/5 bg-obsidian-900/60 backdrop-blur-md">
            <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
                <div>
                    <Link :href="route('dashboard')" class="text-xs uppercase tracking-widest text-white/40 hover:text-gold-300">
                        ← Кабінет
                    </Link>
                    <h1 class="font-display mt-2 text-3xl font-light text-white">
                        Мої <span class="text-gradient-gold italic">звіти</span>
                    </h1>
                </div>
                <div class="flex items-center gap-3">
                    <Link
                        :href="route('reports.schedule')"
                        class="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium tracking-wide text-white/60 transition-colors hover:border-gold-400/40 hover:text-white"
                    >
                        Розклад капта
                    </Link>
                    <button
                        class="rounded-xl bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 px-6 py-3 text-sm font-semibold uppercase tracking-widest text-obsidian-950 shadow-gold transition-transform hover:scale-[1.03]"
                        @click="showForm = !showForm"
                    >
                        {{ showForm ? 'Скасувати' : 'Подати звіт' }}
                    </button>
                </div>
            </div>
        </header>

        <div class="mx-auto max-w-5xl px-6 py-10">
            <Transition name="fade-slide">
                <form v-if="showForm" class="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6" @submit.prevent="submit">
                    <div class="mb-5">
                        <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Подаю</label>
                        <div class="flex gap-2">
                            <button
                                type="button"
                                class="rounded-xl border px-4 py-1.5 text-xs uppercase tracking-widest transition-colors"
                                :class="form.subject_type === 'self' ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/10 text-white/40 hover:text-white'"
                                @click="setSubjectType('self')"
                            >
                                За себе
                            </button>
                            <button
                                type="button"
                                class="rounded-xl border px-4 py-1.5 text-xs uppercase tracking-widest transition-colors"
                                :class="form.subject_type === 'friend' ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/10 text-white/40 hover:text-white'"
                                @click="setSubjectType('friend')"
                            >
                                За друга
                            </button>
                        </div>

                        <div v-if="form.subject_type === 'friend'" class="relative mt-3 max-w-sm">
                            <input
                                v-model="friendQuery"
                                type="text"
                                placeholder="Ім'я та прізвище друга"
                                class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white"
                            />
                            <div v-if="friendMatches.length" class="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-obsidian-900 shadow-xl">
                                <button
                                    v-for="m in friendMatches"
                                    :key="m.id"
                                    type="button"
                                    class="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5"
                                    @click="pickFriend(m)"
                                >
                                    {{ m.name }}
                                </button>
                            </div>
                            <p v-if="friendSelected" class="mt-1 text-xs text-emerald-400/70">Обрано: {{ friendSelected.name }}</p>
                            <p v-else-if="friendQuery.trim().length >= 2 && !friendMatches.length" class="mt-1 text-xs text-white/30">
                                Збігів немає — звіт буде подано на нове ім'я «{{ friendQuery }}». Якщо друг зареєструється з таким самим ім'ям, статистика підтягнеться до нього.
                            </p>
                            <p v-if="form.errors.subject_first_name" class="mt-1 text-xs text-ember-500">{{ form.errors.subject_first_name }}</p>
                        </div>
                    </div>

                    <div>
                        <div class="flex items-center justify-between gap-3">
                            <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Тип</label>
                            <button
                                type="button"
                                class="mb-2 flex shrink-0 items-center gap-1.5 rounded-xl border border-gold-400/30 px-3 py-1 text-xs text-gold-300 transition-colors hover:border-gold-300 hover:text-gold-200"
                                @click="showGuide = true"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                                Як оформити?
                            </button>
                        </div>
                        <select v-model="form.type" class="w-full max-w-xs rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white">
                            <option value="contract">Контракт</option>
                            <option value="bizwar">Бізвар</option>
                            <option value="investment">Інвестиції</option>
                            <option value="other">Інше</option>
                        </select>
                    </div>

                    <!-- Бізвар: дата, перемоги/поразки, час капта -->
                    <div v-if="form.type === 'bizwar'" class="mt-5 space-y-5">
                        <div class="grid gap-5 sm:grid-cols-3">
                            <div>
                                <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Дата</label>
                                <input v-model="form.report_date" type="date" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                                <p v-if="form.errors.report_date" class="mt-1 text-xs text-ember-500">{{ form.errors.report_date }}</p>
                            </div>
                            <div>
                                <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Перемог</label>
                                <input v-model.number="form.wins_count" type="number" min="0" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                                <p v-if="form.errors.wins_count" class="mt-1 text-xs text-ember-500">{{ form.errors.wins_count }}</p>
                            </div>
                            <div>
                                <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Поразок</label>
                                <input v-model.number="form.losses_count" type="number" min="0" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                                <p v-if="form.errors.losses_count" class="mt-1 text-xs text-ember-500">{{ form.errors.losses_count }}</p>
                            </div>
                        </div>
                        <div>
                            <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Час капта</label>
                            <div class="flex flex-wrap gap-2">
                                <label
                                    v-for="time in kaptTimes"
                                    :key="time"
                                    class="cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-medium tracking-wide transition-colors"
                                    :class="form.kapt_times.includes(time)
                                        ? 'border-gold-400/50 bg-gold-400/10 text-gold-200'
                                        : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white'"
                                >
                                    <input type="checkbox" class="hidden" :checked="form.kapt_times.includes(time)" @change="toggleKaptTime(time)" />
                                    {{ time }}
                                </label>
                            </div>
                            <p v-if="form.errors.kapt_times" class="mt-1 text-xs text-ember-500">{{ form.errors.kapt_times }}</p>
                        </div>
                    </div>

                    <!-- Контракт: дата виконання й кількість за кожною вагою -->
                    <div v-else-if="form.type === 'contract'" class="mt-5 space-y-5">
                        <div>
                            <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Дата виконання контрактів</label>
                            <input v-model="form.report_date" type="date" class="w-full max-w-xs rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                            <p v-if="form.errors.report_date" class="mt-1 text-xs text-ember-500">{{ form.errors.report_date }}</p>
                        </div>
                        <div class="grid gap-5 sm:grid-cols-3">
                            <div>
                                <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Легкий</label>
                                <input v-model.number="form.light_count" type="number" min="0" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                                <p v-if="form.errors.light_count" class="mt-1 text-xs text-ember-500">{{ form.errors.light_count }}</p>
                            </div>
                            <div>
                                <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Середній</label>
                                <input v-model.number="form.medium_count" type="number" min="0" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                                <p v-if="form.errors.medium_count" class="mt-1 text-xs text-ember-500">{{ form.errors.medium_count }}</p>
                            </div>
                            <div>
                                <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Тяжкий</label>
                                <input v-model.number="form.heavy_count" type="number" min="0" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                                <p v-if="form.errors.heavy_count" class="mt-1 text-xs text-ember-500">{{ form.errors.heavy_count }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Інвестиції: сума -->
                    <div v-else-if="form.type === 'investment'" class="mt-5 max-w-xs">
                        <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Сума</label>
                        <input
                            v-model.number="form.amount"
                            type="number"
                            min="0"
                            class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white placeholder:text-white/30"
                            placeholder="0"
                        />
                        <p v-if="form.errors.amount" class="mt-1 text-xs text-ember-500">{{ form.errors.amount }}</p>
                    </div>

                    <div class="mt-5">
                        <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">
                            Опис {{ form.type === 'bizwar' ? '(необов\'язково — напр. причина поразки)' : '(необов\'язково)' }}
                        </label>
                        <textarea
                            v-model="form.description"
                            rows="3"
                            class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white placeholder:text-white/30"
                            placeholder="Деталі операції..."
                        ></textarea>
                        <p v-if="form.errors.description" class="mt-1 text-xs text-ember-500">{{ form.errors.description }}</p>
                    </div>

                    <div class="mt-5">
                        <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">
                            Фото-доказ (до 30 шт.)
                        </label>
                        <div class="flex flex-wrap gap-3">
                            <div v-for="(p, i) in photoPreviews" :key="p.url" class="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10">
                                <img :src="p.url" class="h-full w-full object-cover" />
                                <button
                                    type="button"
                                    class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-obsidian-950/80 text-xs text-white/70 opacity-0 transition-opacity hover:text-ember-500 group-hover:opacity-100"
                                    aria-label="Видалити фото"
                                    @click="removePhoto(i)"
                                >
                                    ✕
                                </button>
                            </div>
                            <label
                                v-if="photoPreviews.length < 30"
                                class="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/15 text-2xl text-white/30 transition-colors hover:border-gold-400/40 hover:text-gold-300"
                            >
                                +
                                <input type="file" accept="image/jpeg,image/png,image/webp" multiple class="hidden" @change="onPhotosPicked" />
                            </label>
                        </div>
                        <p class="mt-1 text-xs text-white/30">JPG, PNG чи WebP, до 20 МБ кожне. Оригінали зберігаються без стиснення.</p>
                        <p v-if="form.errors.photos" class="mt-1 text-xs text-ember-500">{{ form.errors.photos }}</p>
                        <p v-if="form.errors['photos.0']" class="mt-1 text-xs text-ember-500">{{ form.errors['photos.0'] }}</p>
                    </div>

                    <button
                        type="submit"
                        :disabled="form.processing"
                        class="mt-5 rounded-xl border border-gold-400/40 px-6 py-2.5 text-sm font-medium tracking-widest text-gold-200 transition-all hover:border-gold-300 disabled:opacity-40"
                    >
                        Надіслати на розгляд
                    </button>
                </form>
            </Transition>

            <div v-reveal v-glow class="glass-panel overflow-hidden">
                <div
                    v-for="report in reports.data"
                    :key="report.id"
                    class="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-6 py-4 last:border-0"
                >
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="font-medium text-white">{{ typeLabels[report.type] }}</span>
                            <span v-if="report.user?.id !== myId" class="rounded-xl border border-gold-400/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gold-300/80">
                                за {{ report.user?.name }}
                            </span>
                            <span v-if="report.outcome" class="text-xs uppercase text-white/40">{{ report.outcome }}</span>
                            <span v-if="report.weight" class="text-xs uppercase text-white/40">{{ report.weight }}</span>
                            <span v-if="report.wins_count !== null" class="text-xs uppercase text-white/40">W: {{ report.wins_count }}</span>
                            <span v-if="report.losses_count !== null" class="text-xs uppercase text-white/40">L: {{ report.losses_count }}</span>
                            <span v-if="report.kapt_times?.length" class="text-xs uppercase text-white/40">{{ report.kapt_times.join(', ') }}</span>
                            <span v-if="report.light_count !== null" class="text-xs uppercase text-white/40">
                                л:{{ report.light_count }} с:{{ report.medium_count }} т:{{ report.heavy_count }}
                            </span>
                            <span v-if="report.amount" class="text-xs uppercase text-white/40">{{ report.amount.toLocaleString('uk-UA') }}</span>
                        </div>
                        <p class="mt-1 text-xs text-white/30">
                            {{ report.report_date ? fmtDateOnly(report.report_date) + ' · подано ' : '' }}{{ fmtDate(report.created_at) }}
                            <span v-if="report.submitter?.id !== myId && report.submitter?.id !== report.user?.id">· {{ verb(report.submitter, 'подав', 'подала') }} {{ report.submitter?.name }}</span>
                        </p>
                        <PhotoGallery v-if="report.attachments?.length" :photos="report.attachments" class="mt-3" />
                    </div>
                    <span class="shrink-0 rounded-xl border px-3 py-1 text-[11px] font-medium uppercase tracking-wide" :class="statusMeta[report.status]?.class">
                        {{ statusMeta[report.status]?.label }}
                    </span>
                </div>
                <div v-if="reports.data.length === 0" class="px-6 py-12 text-center text-white/30">
                    Звітів поки немає — подайте перший
                </div>
            </div>
        </div>

        <Modal :show="showGuide" max-width="lg" @close="showGuide = false">
            <div class="p-6">
                <h3 class="font-display mb-4 text-lg text-white">Як оформити «{{ typeLabels[form.type] }}»</h3>
                <p class="whitespace-pre-line text-sm leading-relaxed text-white/60">{{ reportGuides[form.type] || 'Для цього типу звіту поки немає окремої пам\'ятки.' }}</p>
                <button
                    type="button"
                    class="mt-6 rounded-xl border border-white/15 px-5 py-2 text-sm text-white/60 hover:border-white/30"
                    @click="showGuide = false"
                >
                    Зрозуміло
                </button>
            </div>
        </Modal>
    </div>
</template>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
    transition: all 0.3s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}
</style>
