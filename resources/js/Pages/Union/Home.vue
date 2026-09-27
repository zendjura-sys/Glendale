<script setup>
import { Head, Link } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import ApplicationLogo from '@/Components/ApplicationLogo.vue';
import AmbientBackground from '@/Components/AmbientBackground.vue';
import SocialIcon from '@/Components/SocialIcon.vue';
import { Handshake, ScrollText, ShieldCheck } from '@lucide/vue';

const props = defineProps({
    canLogin: { type: Boolean, default: false },
    canRegister: { type: Boolean, default: false },
    title: { type: String, required: true },
    tagline: { type: String, default: null },
    about: { type: Array, default: () => [] },
    rules: { type: Array, default: () => [] },
    terms: { type: Array, default: () => [] },
    socialLinks: { type: Array, default: () => [] },
});

const SOCIAL_LABELS = {
    telegram: 'Telegram',
    discord: 'Discord',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    instagram: 'Instagram',
    twitter: 'X (Twitter)',
    vk: 'VK',
    website: 'Посилання',
};

const year = computed(() => new Date().getFullYear());

const navLinks = computed(() => [
    { id: 'about', label: 'Про союз', show: props.about.length > 0 },
    { id: 'rules', label: 'Правила', show: props.rules.length > 0 },
    { id: 'terms', label: 'Умови', show: props.terms.length > 0 },
].filter((l) => l.show));

const mobileNavOpen = ref(false);
</script>

<template>
    <Head :title="title" />

    <div class="relative min-h-screen font-sans text-white/80 antialiased">
        <AmbientBackground mobile intensity="soft" />

        <!-- ================= ШАПКА ================= -->
        <header class="relative px-4 pb-6 pt-8 sm:px-6">
            <div class="mx-auto flex max-w-5xl items-center justify-between">
                <a href="/" class="flex items-center gap-2.5">
                    <ApplicationLogo mark class="h-8 w-8 text-base" />
                    <div class="leading-tight">
                        <span class="block font-display text-base tracking-[0.2em] text-white">MONSORY</span>
                        <span class="block text-[9px] tracking-[0.35em] text-gold-300/70">СОЮЗ</span>
                    </div>
                </a>

                <nav class="hidden items-center gap-7 lg:flex">
                    <a
                        v-for="link in navLinks"
                        :key="link.id"
                        :href="`#${link.id}`"
                        class="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50 transition-colors hover:text-gold-200"
                    >
                        {{ link.label }}
                    </a>
                </nav>

                <div class="flex items-center gap-3">
                    <Link
                        v-if="$page.props.auth?.user"
                        :href="route('dashboard')"
                        class="glass-pill btn-ghost px-4 py-2 text-[11px] font-medium tracking-[0.2em] text-white/80"
                    >
                        КАБІНЕТ
                    </Link>
                    <template v-else>
                        <Link
                            v-if="canLogin"
                            :href="route('login')"
                            class="glass-pill btn-ghost px-4 py-2 text-[11px] font-medium tracking-[0.2em] text-gold-200"
                        >
                            УВІЙТИ
                        </Link>
                        <button
                            class="text-white/60 lg:hidden"
                            aria-label="Меню"
                            @click="mobileNavOpen = !mobileNavOpen"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                        </button>
                    </template>
                </div>
            </div>

            <div v-if="mobileNavOpen && navLinks.length > 0" class="glass-panel mx-auto mt-4 flex max-w-5xl flex-col gap-1 p-3 lg:hidden">
                <a
                    v-for="link in navLinks"
                    :key="link.id"
                    :href="`#${link.id}`"
                    class="rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
                    @click="mobileNavOpen = false"
                >
                    {{ link.label }}
                </a>
            </div>
        </header>

        <!-- ================= HERO ================= -->
        <section class="relative overflow-hidden px-4 py-20 sm:px-6 sm:py-28">
            <div class="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-gold-500/10 blur-[120px]"></div>

            <div class="mx-auto max-w-2xl text-center">
                <p v-reveal class="mb-4 inline-flex items-center gap-2 rounded-xl border border-gold-400/20 bg-gold-400/[0.06] px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-gold-300/90">
                    <Handshake class="h-3.5 w-3.5" /> Союз Monsory
                </p>
                <h1 v-reveal:80 class="font-display text-4xl font-light text-white sm:text-6xl">{{ title }}</h1>
                <p v-if="tagline" v-reveal:160 class="mt-5 text-lg text-white/50">{{ tagline }}</p>

                <div v-if="!$page.props.auth?.user" v-reveal:240 class="mt-10 flex flex-wrap items-center justify-center gap-3">
                    <Link
                        v-if="canRegister"
                        :href="route('register')"
                        class="btn-gold inline-flex items-center justify-center px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.18em]"
                    >
                        Зареєструватись
                    </Link>
                    <Link
                        v-if="canLogin"
                        :href="route('login')"
                        class="glass-pill btn-ghost px-7 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-white/70"
                    >
                        Увійти
                    </Link>
                </div>
            </div>
        </section>

        <!-- ================= ПРО СОЮЗ ================= -->
        <section v-if="about.length > 0" id="about" class="relative mx-auto max-w-3xl px-4 py-16 sm:px-6">
            <div v-reveal v-glow class="glass-panel space-y-4 p-6 text-left sm:p-10">
                <p v-for="(paragraph, i) in about" :key="i" class="text-sm leading-relaxed text-white/60 sm:text-[15px]">
                    {{ paragraph }}
                </p>
            </div>
        </section>

        <!-- ================= ПРАВИЛА ТА УМОВИ ================= -->
        <section v-if="rules.length > 0 || terms.length > 0" class="relative mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <div class="grid gap-5" :class="rules.length > 0 && terms.length > 0 ? 'lg:grid-cols-2' : ''">
                <div v-if="rules.length > 0" id="rules" v-reveal="'left'" v-glow class="glass-panel px-7 py-8 sm:px-9 sm:py-10">
                    <div class="mb-5 flex items-center gap-2.5">
                        <ScrollText class="h-5 w-5 text-gold-300/80" />
                        <h2 class="font-display text-xl text-white">Правила союзу</h2>
                    </div>
                    <ul class="space-y-3">
                        <li v-for="(rule, i) in rules" :key="i" class="flex items-start gap-3 text-sm leading-relaxed text-white/60">
                            <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-400/80"></span>
                            {{ rule }}
                        </li>
                    </ul>
                </div>

                <div v-if="terms.length > 0" id="terms" v-reveal="'right'" v-glow class="glass-panel-gold glass-panel px-7 py-8 sm:px-9 sm:py-10">
                    <div class="mb-5 flex items-center gap-2.5">
                        <ShieldCheck class="h-5 w-5 text-gold-300/80" />
                        <h2 class="font-display text-xl text-white">Умови участі</h2>
                    </div>
                    <ul class="space-y-3">
                        <li v-for="(term, i) in terms" :key="i" class="flex items-start gap-3 text-sm leading-relaxed text-white/60">
                            <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-400/80"></span>
                            {{ term }}
                        </li>
                    </ul>
                </div>
            </div>
        </section>

        <!-- ================= CTA ================= -->
        <section v-if="!$page.props.auth?.user" class="relative mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
            <div v-reveal v-glow class="glass-panel px-6 py-10 sm:px-10">
                <h2 class="font-display text-2xl font-light text-white">Готові приєднатись?</h2>
                <p class="mt-3 text-sm text-white/50">Реєстрація займає хвилину — вкажете назву своєї родини та позицію в ній.</p>
                <div class="mt-7 flex flex-wrap items-center justify-center gap-3">
                    <Link
                        v-if="canRegister"
                        :href="route('register')"
                        class="btn-gold inline-flex items-center justify-center px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.18em]"
                    >
                        Зареєструватись
                    </Link>
                    <Link
                        v-if="canLogin"
                        :href="route('login')"
                        class="glass-pill btn-ghost px-7 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-white/70"
                    >
                        Увійти
                    </Link>
                </div>
            </div>
        </section>

        <!-- ================= ФУТЕР ================= -->
        <footer class="relative px-4 pb-10 pt-16 sm:px-6">
            <div class="mx-auto max-w-2xl">
                <hr class="hairline mb-8" />
                <div class="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <p class="text-xs tracking-wide text-white/25">© {{ year }} Monsory</p>

                    <div v-if="socialLinks.length > 0" class="flex flex-wrap gap-2">
                        <a
                            v-for="link in socialLinks"
                            :key="link.platform"
                            :href="link.url"
                            target="_blank"
                            rel="noopener"
                            :title="SOCIAL_LABELS[link.platform] || link.platform"
                            class="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/50 transition-colors duration-300 hover:border-gold-400/40 hover:text-gold-300"
                        >
                            <SocialIcon :platform="link.platform" />
                        </a>
                    </div>

                    <a href="/" class="text-xs text-white/30 transition-colors hover:text-gold-300">
                        На головний сайт родини →
                    </a>
                </div>
            </div>
        </footer>
    </div>
</template>
