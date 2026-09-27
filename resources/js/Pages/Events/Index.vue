<script setup>
import { Head, Link, router } from '@inertiajs/vue3';
import { ref } from 'vue';

defineProps({
    events: { type: Array, default: () => [] },
});

const rsvping = ref(null);

function rsvp(event, status) {
    rsvping.value = event.id;
    router.post(route('family-events.rsvp', event.id), { status }, {
        preserveScroll: true,
        onFinish: () => { rsvping.value = null; },
    });
}

/**
 * Сервер зберігає starts_at БЕЗ конвертації (app.timezone = UTC, а адмін
 * вводить час за Києвом) — Laravel віддає ці самі київські цифри в JSON,
 * лише позначені 'Z' (UTC). Без timeZone: 'UTC' тут браузер додав би ще
 * одну конвертацію у свій локальний час поверх уже правильних цифр.
 */
function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('uk-UA', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString('uk-UA', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
    <Head title="Події родини" />

    <div class="min-h-screen bg-obsidian-950 font-sans text-white/80">
        <header class="border-b border-white/5 bg-obsidian-900/60 backdrop-blur-md">
            <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
                <div>
                    <Link :href="route('dashboard')" class="text-xs uppercase tracking-widest text-white/40 hover:text-gold-300">
                        ← Кабінет
                    </Link>
                    <h1 class="font-display mt-2 text-3xl font-light text-white">
                        Події <span class="text-gradient-gold italic">родини</span>
                    </h1>
                </div>
            </div>
        </header>

        <div class="mx-auto max-w-5xl px-6 py-10">
            <div class="space-y-5">
                <div v-for="event in events" :key="event.id" v-glow class="glass-panel p-6">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <h3 class="font-display text-xl text-white">{{ event.title }}</h3>
                        <span class="shrink-0 rounded-xl border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-gold-300">
                            {{ fmtDate(event.starts_at) }} · {{ fmtTime(event.starts_at) }}
                        </span>
                    </div>
                    <p v-if="event.location" class="mt-2 text-xs uppercase tracking-widest text-white/40">📍 {{ event.location }}</p>
                    <p v-if="event.description" class="mt-3 text-sm leading-relaxed text-white/50">{{ event.description }}</p>

                    <div class="mt-4 flex flex-wrap items-center gap-3 border-t border-white/5 pt-4">
                        <button
                            type="button"
                            :disabled="rsvping === event.id"
                            @click="rsvp(event, 'going')"
                            class="rounded-xl px-4 py-1.5 text-xs font-medium uppercase tracking-wide transition disabled:opacity-50"
                            :class="event.my_rsvp === 'going'
                                ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                                : 'border border-white/10 text-white/50 hover:border-emerald-400/30 hover:text-emerald-300'"
                        >
                            ✓ Прийду
                        </button>
                        <button
                            type="button"
                            :disabled="rsvping === event.id"
                            @click="rsvp(event, 'not_going')"
                            class="rounded-xl px-4 py-1.5 text-xs font-medium uppercase tracking-wide transition disabled:opacity-50"
                            :class="event.my_rsvp === 'not_going'
                                ? 'bg-red-400/20 text-red-300 border border-red-400/40'
                                : 'border border-white/10 text-white/50 hover:border-red-400/30 hover:text-red-300'"
                        >
                            ✕ Не прийду
                        </button>
                        <span class="ml-auto text-xs text-white/30">
                            {{ event.going_count }} підтвердили участь
                        </span>
                    </div>
                </div>

                <div v-if="events.length === 0" class="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center text-white/30">
                    Найближчих подій поки немає
                </div>
            </div>
        </div>
    </div>
</template>
