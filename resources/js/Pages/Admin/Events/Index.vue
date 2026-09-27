<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { Head, router, useForm } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import { verb } from '@/utils/gendered';

const props = defineProps({
    events: { type: Array, required: true },
    aiEventDraftEnabled: { type: Boolean, default: false },
});

const showForm = ref(false);
const createForm = useForm({
    title: '',
    description: '',
    location: '',
    starts_at: '',
});

function toggleForm() {
    // Скидаємо поля щоразу при відкритті — інакше повторне відкриття після
    // "Скасувати" (без сабміту) тягнуло значення з попередньої спроби,
    // включно з датою/часом, які легко неправильно прочитати як "порожні".
    if (! showForm.value) {
        createForm.reset();
        eventHint.value = '';
    }
    showForm.value = ! showForm.value;
}

/* ---------- AI-чернетка назви й опису за короткою підказкою ---------- */
const eventHint = ref('');
const aiDrafting = ref(false);
const aiDraftError = ref(null);

async function draftEvent() {
    if (! eventHint.value.trim()) return;
    aiDrafting.value = true;
    aiDraftError.value = null;
    try {
        const { data } = await window.axios.post(route('admin.family-events.ai-draft'), { hint: eventHint.value });
        if (data.ok) {
            createForm.title = data.data.title;
            createForm.description = data.data.description;
        } else {
            aiDraftError.value = data.message;
        }
    } catch (e) {
        aiDraftError.value = e.response?.data?.message || 'Помилка';
    } finally {
        aiDrafting.value = false;
    }
}

/**
 * Мобільний datetime-local picker (особливо Android) легко "зʼїдає" частину
 * введеного — торкнулись не того колеса, і в полі лишається шматок від
 * поточної дати замість введеної. Без прев'ю це видно лише постфактум,
 * коли подія вже створена й розіслана всім.
 */
const startsAtPreview = computed(() => {
    if (! createForm.starts_at) return null;
    const d = new Date(createForm.starts_at);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('uk-UA', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
});

function createEvent() {
    createForm.post(route('admin.family-events.store'), {
        preserveScroll: true,
        onSuccess: () => {
            createForm.reset();
            showForm.value = false;
        },
    });
}

function destroyEvent(event) {
    if (! confirm(`Видалити подію «${event.title}»?`)) return;
    router.delete(route('admin.family-events.destroy', event.id), { preserveScroll: true });
}

/**
 * Сервер зберігає starts_at БЕЗ конвертації (app.timezone = UTC, а адмін
 * вводить час за Києвом) — Laravel віддає ці самі кияівські цифри в JSON,
 * лише позначені 'Z' (UTC). Без timeZone: 'UTC' тут браузер додав би ще
 * одну конвертацію у свій локальний час поверх уже правильних цифр —
 * і час "з'їжджав" би на кілька годин.
 */
function fmtDateTime(iso) {
    return new Date(iso).toLocaleString('uk-UA', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Порівнюємо з "зараз за Києвом", записаним у тому самому "як-UTC" форматі, що й starts_at. */
function kyivNowAsStoredEpoch() {
    const kyivDigits = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Kyiv' }).replace(' ', 'T') + 'Z';
    return new Date(kyivDigits).getTime();
}

function isPast(iso) {
    return new Date(iso).getTime() < kyivNowAsStoredEpoch();
}

/* ---------- RSVP: список підтверджень по кожній події ---------- */
const openRsvp = ref(null);
function toggleRsvp(event) {
    openRsvp.value = openRsvp.value === event.id ? null : event.id;
}

const sendingDigest = ref(false);
function sendDigest() {
    sendingDigest.value = true;
    router.post(route('admin.family-events.send-digest'), {}, {
        preserveScroll: true,
        onFinish: () => { sendingDigest.value = false; },
    });
}
</script>

<template>
    <Head title="Події родини" />

    <AdminLayout title="Події родини">
        <div class="mb-6 flex flex-wrap gap-3">
            <button
                class="rounded-full bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 px-6 py-3 text-sm font-semibold uppercase tracking-widest text-obsidian-950 shadow-gold transition-transform hover:scale-[1.03]"
                @click="toggleForm"
            >
                {{ showForm ? 'Скасувати' : 'Нова подія' }}
            </button>
            <button
                :disabled="sendingDigest || events.length === 0"
                class="rounded-full border border-white/15 px-6 py-3 text-sm font-medium uppercase tracking-widest text-white/60 transition-colors hover:border-gold-400/30 hover:text-gold-200 disabled:opacity-40"
                @click="sendDigest"
                title="Надіслати всім список усіх майбутніх подій одним повідомленням"
            >
                {{ sendingDigest ? 'Надсилаю…' : '📢 Надіслати всі події' }}
            </button>
        </div>

        <Transition name="fade-slide">
            <form v-if="showForm" class="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6" @submit.prevent="createEvent">
                <div v-if="aiEventDraftEnabled" class="mb-5 rounded-lg border border-gold-400/20 bg-gold-400/5 p-4">
                    <label class="mb-2 block text-xs uppercase tracking-widest text-gold-300/70">✨ AI-допомога: опишіть подію одним реченням</label>
                    <div class="flex flex-wrap gap-2">
                        <input
                            v-model="eventHint"
                            type="text"
                            placeholder="наприклад: збір особового складу, обов'язково всім бути"
                            class="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white"
                            @keydown.enter.prevent="draftEvent"
                        />
                        <button
                            type="button"
                            :disabled="aiDrafting || ! eventHint.trim()"
                            class="rounded-full border border-gold-400/40 px-4 py-2 text-xs font-medium tracking-widest text-gold-200 transition-all hover:border-gold-300 disabled:opacity-40"
                            @click="draftEvent"
                        >
                            {{ aiDrafting ? 'Генерую…' : 'Згенерувати назву й опис' }}
                        </button>
                    </div>
                    <p v-if="aiDraftError" class="mt-2 text-xs text-ember-500">{{ aiDraftError }}</p>
                    <p class="mt-2 text-[11px] text-white/30">Дату, час і локацію все одно вкажете самі нижче — AI їх не заповнює.</p>
                </div>

                <div class="grid gap-5 sm:grid-cols-2">
                    <div class="sm:col-span-2">
                        <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Назва</label>
                        <input v-model="createForm.title" type="text" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                        <p v-if="createForm.errors.title" class="mt-1 text-xs text-ember-500">{{ createForm.errors.title }}</p>
                    </div>
                    <div>
                        <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Дата й час</label>
                        <input v-model="createForm.starts_at" type="datetime-local" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                        <p v-if="startsAtPreview" class="mt-1 text-xs text-gold-300/70">Буде збережено: {{ startsAtPreview }}</p>
                        <p v-if="createForm.errors.starts_at" class="mt-1 text-xs text-ember-500">{{ createForm.errors.starts_at }}</p>
                    </div>
                    <div>
                        <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Локація (необов'язково)</label>
                        <input v-model="createForm.location" type="text" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white" />
                    </div>
                    <div class="sm:col-span-2">
                        <label class="mb-2 block text-xs uppercase tracking-widest text-white/40">Опис (необов'язково)</label>
                        <textarea v-model="createForm.description" rows="3" class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-white"></textarea>
                    </div>
                </div>
                <p class="mt-3 text-[11px] text-white/30">
                    Усі учасники одразу отримають сповіщення (веб + Telegram) і повідомлення в сімейний груповий чат. Нагадування прийде автоматично за день до події.
                </p>
                <button
                    type="submit"
                    :disabled="createForm.processing"
                    class="mt-5 rounded-full border border-gold-400/40 px-6 py-2.5 text-sm font-medium tracking-widest text-gold-200 transition-all hover:border-gold-300 disabled:opacity-40"
                >
                    Створити й оповістити
                </button>
            </form>
        </Transition>

        <div class="space-y-5">
            <div v-for="event in events" :key="event.id" class="glass-panel p-6" :class="isPast(event.starts_at) && 'opacity-50'">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 class="font-display text-xl text-white">{{ event.title }}</h3>
                        <p class="text-xs text-white/40">
                            {{ fmtDateTime(event.starts_at) }}
                            <span v-if="event.location">· {{ event.location }}</span>
                            · {{ verb(event.creator, 'створив', 'створила') }} {{ event.creator?.name }}
                            <span v-if="event.reminder_sent_at" class="text-gold-300/60">· нагадування надіслано</span>
                        </p>
                    </div>
                    <button
                        class="shrink-0 rounded-full border border-ember-500/25 px-4 py-1.5 text-xs font-medium text-ember-500/80 hover:bg-ember-600/10"
                        @click="destroyEvent(event)"
                    >
                        Видалити
                    </button>
                </div>
                <p v-if="event.description" class="mt-2 text-sm leading-relaxed text-white/50">{{ event.description }}</p>

                <div class="mt-3 border-t border-white/5 pt-3">
                    <button
                        type="button"
                        class="text-xs uppercase tracking-widest text-white/40 hover:text-gold-300"
                        @click="toggleRsvp(event)"
                    >
                        ✓ {{ event.going_count }} прийдуть · ✕ {{ event.not_going_count }} не прийдуть
                        <span class="text-white/20">{{ openRsvp === event.id ? '▲' : '▼' }}</span>
                    </button>
                    <div v-if="openRsvp === event.id" class="mt-2 flex flex-wrap gap-1.5">
                        <span v-if="event.rsvps.length === 0" class="text-xs text-white/25">Ще ніхто не відповів</span>
                        <span
                            v-for="r in event.rsvps"
                            :key="r.id"
                            class="rounded-full px-2.5 py-0.5 text-[11px]"
                            :class="r.status === 'going' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300'"
                        >
                            {{ r.status === 'going' ? '✓' : '✕' }} {{ r.user?.name }}
                        </span>
                    </div>
                </div>
            </div>

            <div v-if="events.length === 0" class="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center text-white/30">
                Подій ще немає — створіть першу
            </div>
        </div>
    </AdminLayout>
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
