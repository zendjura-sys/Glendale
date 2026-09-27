<script setup>
import ApplicationLogo from '@/Components/ApplicationLogo.vue';
import AmbientBackground from '@/Components/AmbientBackground.vue';
import { Link } from '@inertiajs/vue3';
import { ref } from 'vue';
import { AlertTriangle, Blocks, Crown, CalendarDays, Handshake, History, IdCard, LayoutDashboard, Megaphone, Menu, MessageCircle, Palette, Scale, ScrollText, Settings, ShieldCheck, ShieldOff, Target, TrendingUp, Users, Wallet, X } from '@lucide/vue';

defineProps({
    title: { type: String, default: '' },
});

const navGroups = [
    {
        label: 'Огляд',
        items: [
            { name: 'admin.dashboard', label: 'Панель CMS', can: null, icon: LayoutDashboard },
        ],
    },
    {
        label: 'Спільнота',
        items: [
            { name: 'admin.reports.index', label: 'Модерація звітів', can: 'manageReports', icon: ScrollText },
            { name: 'admin.progression.index', label: 'Прогресія', can: 'manageProgression', icon: TrendingUp },
            { name: 'admin.members.index', label: 'Кадровий облік', can: 'manageMembers', icon: IdCard },
            { name: 'admin.discipline.index', label: 'Покарання', can: 'manageMembers', icon: Scale },
            { name: 'admin.family-goals.index', label: 'Цілі родини', can: 'manageGoals', icon: Target },
            { name: 'admin.family-events.index', label: 'Події родини', can: 'manageEvents', icon: CalendarDays },
            { name: 'admin.broadcasts.index', label: 'Розсилки', can: 'manageBroadcasts', icon: Megaphone },
            { name: 'admin.bonuses.index', label: 'Банк', can: 'manageBonuses', icon: Wallet },
            { name: 'admin.users.index', label: 'Учасники', can: 'manageUsers', icon: Users },
            { name: 'admin.families.index', label: 'Родини та союзи', can: 'manageFamilies', icon: Crown },
        ],
    },
    {
        label: 'Союз',
        requiresUnion: true,
        items: [
            { name: 'admin.union.index', label: 'Контент і союзники', can: 'manageUnion', icon: Handshake },
            { name: 'admin.union.complaints.index', label: 'Скарги', can: 'manageUnion', icon: ScrollText },
            { name: 'admin.union.announcements.index', label: 'Оголошення', can: 'manageUnion', icon: Megaphone },
            { name: 'admin.union.blacklist.index', label: 'Чорний список', can: 'manageUnion', icon: ShieldOff },
            { name: 'admin.union.addons.index', label: 'Аддони союзу', can: 'manageUnion', icon: Blocks },
        ],
    },
    {
        label: 'Система',
        items: [
            { name: 'admin.addons.index', label: 'Аддони', can: 'manageAddons', icon: Blocks },
            { name: 'admin.roles.index', label: 'Права доступу', can: 'manageRoles', icon: ShieldCheck },
            { name: 'admin.telegram.index', label: 'Telegram-бот', can: 'manageTelegram', icon: MessageCircle },
            { name: 'admin.design.index', label: 'Дизайн', can: 'manageSettings', icon: Palette },
            { name: 'admin.changelog.index', label: 'Що нового', can: 'manageSettings', icon: History },
            { name: 'admin.failed-jobs.index', label: 'Провалені джоби', can: 'manageSettings', icon: AlertTriangle },
            { name: 'admin.settings.index', label: 'Налаштування', can: 'manageSettings', icon: Settings },
        ],
    },
];

const mobileOpen = ref(false);
</script>

<template>
    <div class="relative min-h-[100svh] font-sans text-white/80 antialiased">
        <!-- mobile не передаём: на телефоне сайдбар занимает весь экран, и
             подсветка за ним только съедает производительность. -->
        <AmbientBackground intensity="soft" />

        <div class="flex">
            <!-- ================= SIDEBAR ================= -->
            <aside
                class="glass-panel fixed inset-y-4 left-4 z-40 w-64 overflow-y-auto !rounded-2xl px-5 py-6 transition-transform duration-300 lg:translate-x-0"
                :class="mobileOpen ? 'translate-x-0' : 'translate-x-[-120%]'"
            >
                <div class="mb-8 flex items-center justify-between">
                    <Link href="/" class="flex items-center gap-3">
                        <ApplicationLogo mark class="h-9 w-9 text-lg" />
                        <div class="leading-tight">
                            <div class="font-display text-sm tracking-[0.25em] text-white">GAME</div>
                            <div class="text-[9px] tracking-[0.35em] text-gold-300/70">CONNECT CMS</div>
                        </div>
                    </Link>
                    <button
                        class="text-white/40 hover:text-white lg:hidden"
                        aria-label="Закрити меню"
                        @click="mobileOpen = false"
                    >
                        <X class="h-5 w-5" />
                    </button>
                </div>

                <nav class="space-y-6">
                    <div v-for="group in navGroups" v-show="!group.requiresUnion || $page.props.unionEnabled" :key="group.label">
                        <p class="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.3em] text-white/30">{{ group.label }}</p>
                        <div class="space-y-1">
                            <template v-for="item in group.items" :key="item.name">
                                <Link
                                    v-if="(item.can === null || $page.props.can?.[item.can]) && route().has(item.name)"
                                    :href="route(item.name)"
                                    class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
                                    :class="route().current(item.name.split('.').slice(0, -1).join('.') + '.*')
                                        ? 'bg-gold-400/10 text-gold-200'
                                        : 'text-white/50 hover:bg-white/5 hover:text-white'"
                                >
                                    <component :is="item.icon" class="h-4 w-4 shrink-0" />
                                    {{ item.label }}
                                </Link>
                            </template>
                        </div>
                    </div>
                </nav>

                <div class="mt-10 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[11px] text-white/30">
                    <kbd class="rounded border border-white/15 px-1.5 py-0.5">⌘K</kbd>
                    швидка навігація
                </div>

                <div class="mt-3 flex flex-col gap-2">
                    <Link :href="route('dashboard')" class="text-xs uppercase tracking-widest text-white/30 hover:text-gold-300">
                        ← Кабінет
                    </Link>
                    <Link :href="route('home')" class="text-xs uppercase tracking-widest text-white/30 hover:text-gold-300">
                        ← На головну сайту
                    </Link>
                </div>
            </aside>

            <!-- ================= CONTENT ================= -->
            <!-- Мобільна панель-тригер живе у звичайному потоці (sticky, не
                 fixed) — саме тому вона більше не може перекрити заголовок
                 сторінки: контент під нею відштовхується самою розміткою,
                 а не підбором відступу навмання. -->
            <!-- min-w-0: без цього єдиний flex-елемент має неявний
                 min-width: auto і не стискається нижче внутрішнього вмісту
                 (напр. широкої таблиці) — overflow-x-auto ВСЕРЕДИНІ нього
                 тоді не рятує, бо вже сам контейнер розпирає всю сторінку
                 на мобільних екранах. -->
            <div class="min-h-screen min-w-0 flex-1 lg:ml-[17rem]">
                <div class="sticky top-0 z-30 flex items-center gap-3 border-b border-white/5 bg-obsidian-950/90 px-6 py-4 backdrop-blur-md lg:hidden">
                    <button class="text-white/70 hover:text-white" aria-label="Відкрити меню" @click="mobileOpen = true">
                        <Menu class="h-5 w-5" />
                    </button>
                    <ApplicationLogo mark class="h-7 w-7 text-sm" />
                    <span class="font-display text-sm tracking-[0.2em] text-white">MONSORY CONNECT</span>
                </div>

                <main class="px-6 py-8 lg:px-10">
                    <header v-if="title" class="mb-8">
                        <h1 class="font-display text-3xl font-light text-white">{{ title }}</h1>
                    </header>
                    <slot />
                </main>
            </div>
        </div>
    </div>
</template>
