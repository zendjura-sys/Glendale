<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import ApplicationLogo from '@/Components/ApplicationLogo.vue';
import AmbientBackground from '@/Components/AmbientBackground.vue';
import Dropdown from '@/Components/Dropdown.vue';
import DropdownLink from '@/Components/DropdownLink.vue';
import NavLink from '@/Components/NavLink.vue';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink.vue';
import { Link } from '@inertiajs/vue3';

const showingNavigationDropdown = ref(false);

// Heartbeat онлайн-статусу (🟢 у месенджері): поки вкладка відкрита й
// видима, раз на 45с — щоб учасник, який просто читає сторінку без
// переходів, не ставав 🔴. Мітку ставить серверний TrackLastSeen.
let presenceTimer = null;
function pingPresence() {
    if (document.visibilityState !== 'visible' || !route().has('presence.ping')) return;
    window.axios.post(route('presence.ping')).catch(() => {});
}
onMounted(() => {
    presenceTimer = setInterval(pingPresence, 45000);
    document.addEventListener('visibilitychange', pingPresence);
});
onBeforeUnmount(() => {
    clearInterval(presenceTimer);
    document.removeEventListener('visibilitychange', pingPresence);
});
</script>

<template>
    <div class="relative min-h-[100svh] font-sans text-white/80 antialiased">
        <AmbientBackground mobile intensity="normal" />

        <nav class="sticky top-0 z-40 border-b border-white/5 bg-obsidian-950/70 backdrop-blur-xl">
            <!-- Primary Navigation Menu -->
            <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div class="flex h-16 justify-between">
                    <div class="flex">
                        <!-- Logo -->
                        <div class="flex shrink-0 items-center gap-3">
                            <Link :href="route('dashboard')">
                                <ApplicationLogo mark class="h-8 w-8 text-base" />
                            </Link>
                        </div>

                        <!-- Navigation Links -->
                        <div
                            class="hidden space-x-8 sm:-my-px sm:ms-10 sm:flex"
                        >
                            <!-- Соцмережа платформи (React) — інша частина сайту:
                                 Inertia-перехід туди сервер перетворює на повний. -->
                            <NavLink href="/feed" :active="false">
                                Стрічка
                            </NavLink>
                            <NavLink
                                :href="route('dashboard')"
                                :active="route().current('dashboard')"
                            >
                                Кабінет
                            </NavLink>
                            <NavLink
                                v-if="route().has('reports.index')"
                                :href="route('reports.index')"
                                :active="route().current('reports.*')"
                            >
                                Мої звіти
                            </NavLink>
                            <NavLink
                                v-if="route().has('progression.index')"
                                :href="route('progression.index')"
                                :active="route().current('progression.*')"
                            >
                                Мій прогрес
                            </NavLink>
                            <NavLink
                                v-if="route().has('member-center.index')"
                                :href="route('member-center.index')"
                                :active="route().current('member-center.*')"
                            >
                                Кадровий центр
                            </NavLink>
                            <NavLink
                                v-if="route().has('family-goals.index')"
                                :href="route('family-goals.index')"
                                :active="route().current('family-goals.*')"
                            >
                                Цілі родини
                            </NavLink>
                            <NavLink
                                v-if="route().has('family-events.index')"
                                :href="route('family-events.index')"
                                :active="route().current('family-events.*')"
                            >
                                Події родини
                            </NavLink>
                            <NavLink
                                v-if="route().has('notifications.index')"
                                :href="route('notifications.index')"
                                :active="route().current('notifications.*')"
                            >
                                Сповіщення
                                <span
                                    v-if="$page.props.unreadNotifications > 0"
                                    class="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-semibold text-obsidian-950"
                                >
                                    {{ $page.props.unreadNotifications > 99 ? '99+' : $page.props.unreadNotifications }}
                                </span>
                            </NavLink>
                            <NavLink
                                v-if="route().has('messenger.index')"
                                :href="route('messenger.index')"
                                :active="route().current('messenger.*')"
                            >
                                Чат
                                <span
                                    v-if="$page.props.unreadMessages > 0"
                                    class="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-semibold text-obsidian-950"
                                >
                                    {{ $page.props.unreadMessages > 99 ? '99+' : $page.props.unreadMessages }}
                                </span>
                            </NavLink>
                            <NavLink
                                v-if="route().has('bonuses.index')"
                                :href="route('bonuses.index')"
                                :active="route().current('bonuses.*')"
                            >
                                Банк
                            </NavLink>
                            <NavLink
                                v-if="route().has('rules')"
                                :href="route('rules')"
                                :active="route().current('rules')"
                            >
                                Правила
                            </NavLink>
                            <NavLink
                                v-if="route().has('discipline.index')"
                                :href="route('discipline.index')"
                                :active="route().current('discipline.*')"
                            >
                                Покарання
                            </NavLink>
                            <NavLink
                                :href="route('guide')"
                                :active="route().current('guide')"
                            >
                                Довідка
                            </NavLink>
                            <NavLink
                                v-if="route().has('changelog')"
                                :href="route('changelog')"
                                :active="route().current('changelog')"
                            >
                                Що нового
                            </NavLink>
                            <NavLink
                                v-if="route().has('admin.dashboard') && (
                                    $page.props.can?.manageAddons || $page.props.can?.manageReports ||
                                    $page.props.can?.manageProgression || $page.props.can?.manageSettings ||
                                    $page.props.can?.manageRoles || $page.props.can?.manageUsers || $page.props.can?.manageMembers || $page.props.can?.manageGoals || $page.props.can?.manageBroadcasts || $page.props.can?.manageTelegram || $page.props.can?.manageEvents
                                )"
                                :href="route('admin.dashboard')"
                                :active="route().current('admin.*')"
                            >
                                Адмін-панель
                            </NavLink>
                        </div>
                    </div>

                    <div class="hidden sm:ms-6 sm:flex sm:items-center">
                        <!-- Settings Dropdown -->
                        <div class="relative ms-3">
                            <Dropdown align="right" width="48">
                                <template #trigger>
                                    <span class="inline-flex rounded-md">
                                        <button
                                            type="button"
                                            class="inline-flex items-center rounded-md border border-transparent px-3 py-2 text-sm font-medium leading-4 text-white/60 transition duration-150 ease-in-out hover:text-white focus:outline-none"
                                        >
                                            {{ $page.props.auth.user.name }}

                                            <svg
                                                class="-me-0.5 ms-2 h-4 w-4"
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fill-rule="evenodd"
                                                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                                    clip-rule="evenodd"
                                                />
                                            </svg>
                                        </button>
                                    </span>
                                </template>

                                <template #content>
                                    <DropdownLink
                                        :href="route('profile.edit')"
                                    >
                                        Профіль
                                    </DropdownLink>
                                    <DropdownLink
                                        :href="route('home')"
                                    >
                                        На головну сайту
                                    </DropdownLink>
                                    <DropdownLink
                                        :href="route('logout')"
                                        method="post"
                                        as="button"
                                    >
                                        Вийти
                                    </DropdownLink>
                                </template>
                            </Dropdown>
                        </div>
                    </div>

                    <!-- Hamburger -->
                    <div class="-me-2 flex items-center sm:hidden">
                        <button
                            @click="
                                showingNavigationDropdown =
                                    !showingNavigationDropdown
                            "
                            class="inline-flex items-center justify-center rounded-md p-2 text-white/40 transition duration-150 ease-in-out hover:bg-white/5 hover:text-white/70 focus:bg-white/5 focus:text-white/70 focus:outline-none"
                        >
                            <svg
                                class="h-6 w-6"
                                stroke="currentColor"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    :class="{
                                        hidden: showingNavigationDropdown,
                                        'inline-flex':
                                            !showingNavigationDropdown,
                                    }"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                                <path
                                    :class="{
                                        hidden: !showingNavigationDropdown,
                                        'inline-flex':
                                            showingNavigationDropdown,
                                    }"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Responsive Navigation Menu -->
            <div
                :class="{
                    block: showingNavigationDropdown,
                    hidden: !showingNavigationDropdown,
                }"
                class="sm:hidden"
            >
                <div class="space-y-1 pb-3 pt-2">
                    <ResponsiveNavLink href="/feed" :active="false">
                        Стрічка
                    </ResponsiveNavLink>
                    <ResponsiveNavLink href="/friends" :active="false">
                        Друзі
                    </ResponsiveNavLink>
                    <ResponsiveNavLink href="/groups" :active="false">
                        Спільноти
                    </ResponsiveNavLink>
                    <ResponsiveNavLink
                        :href="route('dashboard')"
                        :active="route().current('dashboard')"
                    >
                        Кабінет
                    </ResponsiveNavLink>
                    <ResponsiveNavLink
                        v-if="route().has('reports.index')"
                        :href="route('reports.index')"
                        :active="route().current('reports.*')"
                    >
                        Мої звіти
                    </ResponsiveNavLink>
                    <ResponsiveNavLink
                        v-if="route().has('progression.index')"
                        :href="route('progression.index')"
                        :active="route().current('progression.*')"
                    >
                        Мій прогрес
                    </ResponsiveNavLink>
                    <ResponsiveNavLink
                        v-if="route().has('member-center.index')"
                        :href="route('member-center.index')"
                        :active="route().current('member-center.*')"
                    >
                        Кадровий центр
                    </ResponsiveNavLink>
                    <ResponsiveNavLink
                        v-if="route().has('family-goals.index')"
                        :href="route('family-goals.index')"
                        :active="route().current('family-goals.*')"
                    >
                        Цілі родини
                    </ResponsiveNavLink>
                    <ResponsiveNavLink
                        v-if="route().has('family-events.index')"
                        :href="route('family-events.index')"
                        :active="route().current('family-events.*')"
                    >
                        Події родини
                    </ResponsiveNavLink>
                    <ResponsiveNavLink
                        v-if="route().has('notifications.index')"
                        :href="route('notifications.index')"
                        :active="route().current('notifications.*')"
                    >
                        Сповіщення
                        <span
                            v-if="$page.props.unreadNotifications > 0"
                            class="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-semibold text-obsidian-950"
                        >
                            {{ $page.props.unreadNotifications > 99 ? '99+' : $page.props.unreadNotifications }}
                        </span>
                    </ResponsiveNavLink>
                    <ResponsiveNavLink
                        v-if="route().has('messenger.index')"
                        :href="route('messenger.index')"
                        :active="route().current('messenger.*')"
                    >
                        Чат
                        <span
                            v-if="$page.props.unreadMessages > 0"
                            class="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-semibold text-obsidian-950"
                        >
                            {{ $page.props.unreadMessages > 99 ? '99+' : $page.props.unreadMessages }}
                        </span>
                    </ResponsiveNavLink>
                    <ResponsiveNavLink
                        v-if="route().has('bonuses.index')"
                        :href="route('bonuses.index')"
                        :active="route().current('bonuses.*')"
                    >
                        Банк
                    </ResponsiveNavLink>
                    <ResponsiveNavLink
                        v-if="route().has('rules')"
                        :href="route('rules')"
                        :active="route().current('rules')"
                    >
                        Правила
                    </ResponsiveNavLink>
                    <ResponsiveNavLink
                        v-if="route().has('discipline.index')"
                        :href="route('discipline.index')"
                        :active="route().current('discipline.*')"
                    >
                        Мої покарання
                    </ResponsiveNavLink>
                    <ResponsiveNavLink
                        :href="route('guide')"
                        :active="route().current('guide')"
                    >
                        Довідка
                    </ResponsiveNavLink>
                    <ResponsiveNavLink
                        v-if="route().has('changelog')"
                        :href="route('changelog')"
                        :active="route().current('changelog')"
                    >
                        Що нового
                    </ResponsiveNavLink>
                    <ResponsiveNavLink
                        v-if="route().has('admin.dashboard') && (
                            $page.props.can?.manageAddons || $page.props.can?.manageReports ||
                            $page.props.can?.manageProgression || $page.props.can?.manageSettings ||
                            $page.props.can?.manageRoles || $page.props.can?.manageUsers || $page.props.can?.manageMembers || $page.props.can?.manageGoals || $page.props.can?.manageBroadcasts || $page.props.can?.manageTelegram || $page.props.can?.manageEvents
                        )"
                        :href="route('admin.dashboard')"
                        :active="route().current('admin.*')"
                    >
                        Адмін-панель
                    </ResponsiveNavLink>
                </div>

                <!-- Responsive Settings Options -->
                <div
                    class="border-t border-white/10 pb-1 pt-4"
                >
                    <div class="px-4">
                        <div
                            class="text-base font-medium text-white"
                        >
                            {{ $page.props.auth.user.name }}
                        </div>
                        <div class="text-sm font-medium text-white/40">
                            {{ $page.props.auth.user.email }}
                        </div>
                    </div>

                    <div class="mt-3 space-y-1">
                        <ResponsiveNavLink :href="route('profile.edit')">
                            Профіль
                        </ResponsiveNavLink>
                        <ResponsiveNavLink :href="route('home')">
                            На головну сайту
                        </ResponsiveNavLink>
                        <ResponsiveNavLink
                            :href="route('logout')"
                            method="post"
                            as="button"
                        >
                            Вийти
                        </ResponsiveNavLink>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Page Heading -->
        <header
            class="border-b border-white/5 bg-obsidian-900/40"
            v-if="$slots.header"
        >
            <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <slot name="header" />
            </div>
        </header>

        <!-- Page Content -->
        <main>
            <slot />
        </main>
    </div>
</template>
