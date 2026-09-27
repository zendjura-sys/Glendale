<script setup>
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, ref, watch } from 'vue';

const props = defineProps({
    books: { type: Array, default: () => [] },
    levels: { type: Array, default: () => [] },
});

// Колір бейджа покарання: шкала родини (remark…blacklist) і спрощена
// шкала правил проєкту (jail / ban).
const levelStyle = {
    remark: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
    fine: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
    reprimand: 'border-orange-500/45 bg-orange-500/10 text-orange-200',
    demotion: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200',
    kick: 'border-red-500/50 bg-red-500/10 text-red-200',
    blacklist: 'border-red-700/70 bg-red-900/40 text-red-100',
    jail: 'border-orange-500/45 bg-orange-500/10 text-orange-200',
    ban: 'border-red-600/60 bg-red-600/15 text-red-100',
};

const activeSlug = ref(props.books[0]?.slug ?? null);
const query = ref('');
const showLegend = ref(true);

onMounted(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('book');
    if (fromUrl && props.books.some((b) => b.slug === fromUrl)) activeSlug.value = fromUrl;
});

watch(activeSlug, (slug) => {
    const url = new URL(window.location.href);
    url.searchParams.set('book', slug);
    window.history.replaceState(window.history.state, '', url);
});

const book = computed(() => props.books.find((b) => b.slug === activeSlug.value) ?? props.books[0]);

// Пошук — по номеру пункту, тексту, приміткам і покаранню в межах книги.
const sections = computed(() => {
    const q = query.value.trim().toLowerCase();
    if (!book.value) return [];
    if (!q) return book.value.sections;
    return book.value.sections
        .map((s) => ({
            ...s,
            rules: s.rules.filter((r) =>
                [r.code, r.text, ...r.notes, ...r.penalties.map((p) => p.text)].join(' ').toLowerCase().includes(q),
            ),
        }))
        .filter((s) => s.rules.length);
});

const totalFound = computed(() => sections.value.reduce((n, s) => n + s.rules.length, 0));

function formatDate(iso) {
    const [y, m, d] = (iso ?? '').split('-');
    return d ? `${d}.${m}.${y}` : '';
}
</script>

<template>
    <Head title="Правила" />

    <AuthenticatedLayout>
        <template #header>
            <h2 class="font-display text-2xl font-light text-white">Правила</h2>
        </template>

        <div class="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
            <!-- Вибір книги правил -->
            <nav class="flex gap-2 overflow-x-auto pb-1">
                <button
                    v-for="b in books"
                    :key="b.slug"
                    type="button"
                    class="shrink-0 rounded-xl border px-4 py-2 text-sm transition-colors"
                    :class="b.slug === activeSlug
                        ? 'border-gold-400/60 bg-gold-400/15 text-gold-200'
                        : 'border-white/10 text-white/60 hover:border-gold-400/40 hover:text-gold-300'"
                    @click="activeSlug = b.slug; query = ''"
                >
                    {{ b.icon }} {{ b.short }}
                </button>
            </nav>

            <div v-if="book" class="glass-panel p-6 sm:p-8">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                        <h3 class="font-display text-xl font-normal text-white">{{ book.icon }} {{ book.title }}</h3>
                        <p class="mt-2 text-sm leading-relaxed text-white/50">{{ book.description }}</p>
                    </div>
                    <span class="shrink-0 rounded-xl border border-white/10 px-3 py-1 text-[11px] text-white/40">
                        Оновлено {{ formatDate(book.updatedAt) }}
                    </span>
                </div>

                <input
                    v-model="query"
                    type="search"
                    placeholder="Пошук: номер пункту, слово, покарання…"
                    class="mt-5 w-full rounded-xl border border-white/10 bg-obsidian-900/60 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-gold-400/50 focus:outline-none focus:ring-0"
                />
                <p v-if="query.trim()" class="mt-2 text-xs text-white/40">Знайдено пунктів: {{ totalFound }}</p>
            </div>

            <!-- Шкала покарань родини -->
            <div v-if="book?.kind === 'family'" class="glass-panel p-6 sm:p-8">
                <button type="button" class="flex w-full items-center justify-between text-left" @click="showLegend = !showLegend">
                    <span class="font-display text-lg font-normal text-white">⚖️ Шкала покарань</span>
                    <span class="text-white/40 transition-transform" :class="showLegend ? 'rotate-45' : ''">＋</span>
                </button>
                <div v-if="showLegend" class="mt-5 grid gap-3 sm:grid-cols-2">
                    <div v-for="level in levels" :key="level.key" class="rounded-xl border border-white/10 bg-obsidian-900/40 p-4">
                        <span class="inline-block rounded-xl border px-2.5 py-0.5 text-xs font-medium" :class="levelStyle[level.key]">
                            {{ level.title }}
                        </span>
                        <p class="mt-2 text-xs leading-relaxed text-white/55">{{ level.description }}</p>
                    </div>
                </div>
            </div>
            <div v-else-if="book" class="flex flex-wrap items-center gap-2 px-1 text-xs text-white/40">
                <span class="rounded-xl border px-2.5 py-0.5" :class="levelStyle.jail">Jail / мут / kick</span>
                <span class="rounded-xl border px-2.5 py-0.5" :class="levelStyle.ban">Бан / блокування / втрата бізнесу</span>
                <span>— покарання адміністрації проєкту</span>
            </div>

            <div
                v-for="section in sections"
                :key="section.title"
                v-reveal
                class="glass-panel p-6 sm:p-8"
            >
                <h3 class="font-display text-lg font-normal text-white">{{ section.title }}</h3>

                <div class="mt-5 space-y-3">
                    <div
                        v-for="rule in section.rules"
                        :key="rule.code"
                        class="rounded-xl border border-white/10 bg-obsidian-900/40 p-4"
                    >
                        <div class="flex gap-3">
                            <span class="h-fit shrink-0 rounded-lg border border-gold-400/30 bg-gold-400/10 px-2 py-0.5 font-mono text-xs text-gold-300">
                                {{ rule.code }}
                            </span>
                            <p class="min-w-0 text-sm leading-relaxed text-white/80 [overflow-wrap:anywhere]">{{ rule.text }}</p>
                        </div>
                        <p
                            v-for="(note, i) in rule.notes"
                            :key="'n' + i"
                            class="mt-3 rounded-lg border-l-2 border-amber-400/50 bg-amber-400/5 px-3 py-2 text-xs leading-relaxed text-amber-100/70"
                        >
                            {{ note }}
                        </p>
                        <div v-if="rule.penalties.length" class="mt-3 flex flex-wrap gap-2">
                            <span
                                v-for="(p, i) in rule.penalties"
                                :key="'p' + i"
                                class="rounded-xl border px-3 py-1 text-xs"
                                :class="levelStyle[p.level] ?? levelStyle.jail"
                            >
                                {{ p.text }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <p v-if="query.trim() && !totalFound" class="text-center text-sm text-white/40">Нічого не знайдено.</p>
        </div>
    </AuthenticatedLayout>
</template>
