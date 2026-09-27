<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import StatsBarChart from '@/Components/StatsBarChart.vue';
import { Head, Link, useForm, usePage } from '@inertiajs/vue3';
import { computed } from 'vue';

const props = defineProps({
    groups: { type: Array, default: () => [] },
    stats: { type: Object, required: true },
    health: { type: Object, default: null },
    familyStats: { type: Object, default: null },
});

const statsForm = useForm({
    keys: props.familyStats ? [...props.familyStats.selectedKeys] : [],
});

function toggleStatKey(key) {
    const idx = statsForm.keys.indexOf(key);
    if (idx === -1) {
        statsForm.keys.push(key);
    } else {
        statsForm.keys.splice(idx, 1);
    }
}

function saveFamilyStats() {
    statsForm.put(route('admin.stats.update'), { preserveScroll: true });
}

function fmtRelative(iso) {
    if (!iso) return 'немає даних';
    const diffMs = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diffMs / 3_600_000);
    if (hours < 1) return 'щойно';
    if (hours < 24) return `${hours} год тому`;
    return `${Math.floor(hours / 24)} д тому`;
}

const page = usePage();
// roles.manage — право, яке видано винятково ролі admin (SystemPermissionsSeeder),
// тому це найближчий надійний проксі "адмін" тут — глобальні auth-пропси
// самого списку ролей не несуть, лише набір can.*.
const showTwoFactorNudge = computed(() => page.props.can?.manageRoles && !page.props.auth.user.two_factor_enabled);

// Плитки розділів приходять з сервера (App\Support\ShellNav::tiles) — той
// самий список, що й у боковому меню й мобільних чіпах адмінки: нову
// сторінку досить зареєструвати там раз, і вона одразу з'явиться тут.
</script>

<template>
    <Head title="Панель CMS" />

    <AdminLayout>
        <div v-reveal class="mb-10">
            <p class="mb-2 text-sm font-medium uppercase tracking-[0.4em] text-gold-300/90">GameConnect</p>
            <h1 class="font-display text-4xl font-light text-white">
                Панель <span class="text-gradient-gold italic">керування</span>
            </h1>
            <p class="mt-2 text-white/40">Керування всім сайтом GameConnect — в одному місці.</p>
        </div>

        <Link
            v-if="showTwoFactorNudge"
            :href="route('profile.edit')"
            v-reveal
            class="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-400/30 bg-gold-400/5 px-5 py-4 text-sm text-gold-200 transition-colors hover:border-gold-400/50"
        >
            <span>🔐 У вас адмінський доступ, а двофакторна автентифікація ще вимкнена — увімкніть її в профілі.</span>
            <span class="shrink-0 text-xs uppercase tracking-widest">Перейти →</span>
        </Link>

        <div class="mb-10 grid gap-6 sm:grid-cols-3">
            <div v-reveal="'scale'" v-glow class="glass-panel-gold glass-panel p-6">
                <p class="text-xs uppercase tracking-widest text-white/40">Учасників</p>
                <p class="font-display mt-2 text-4xl text-gold-300">{{ stats.members }}</p>
            </div>
            <div v-reveal:80="'scale'" v-glow class="glass-panel p-6">
                <p class="text-xs uppercase tracking-widest text-white/40">Ролей у системі</p>
                <p class="font-display mt-2 text-4xl text-white">{{ stats.roles }}</p>
            </div>
            <div v-reveal:160="'scale'" v-glow class="glass-panel p-6">
                <p class="text-xs uppercase tracking-widest text-white/40">Активних аддонів</p>
                <p class="font-display mt-2 text-4xl text-white">{{ stats.activeAddons }}</p>
            </div>
        </div>

        <div v-if="familyStats" v-reveal class="mb-10 glass-panel p-6 sm:p-8">
            <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 class="font-display text-lg text-white">Статистика родини</h2>
                    <p class="mt-1 text-sm text-white/40">Реальні числа з бази — оберіть, які показувати на головній сторінці сайту.</p>
                </div>
                <button
                    type="button"
                    :disabled="statsForm.processing"
                    class="rounded-xl border border-gold-400/40 px-5 py-2 text-xs font-medium uppercase tracking-widest text-gold-200 hover:border-gold-300 disabled:opacity-40"
                    @click="saveFamilyStats"
                >
                    Зберегти вибір
                </button>
            </div>

            <StatsBarChart :items="familyStats.available" class="mb-6" />

            <div class="flex flex-wrap gap-2 border-t border-white/10 pt-5">
                <label
                    v-for="item in familyStats.available"
                    :key="item.key"
                    class="flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs transition-colors"
                    :class="statsForm.keys.includes(item.key) ? 'border-gold-400/40 bg-gold-400/[0.08] text-gold-200' : 'border-white/10 text-white/50 hover:border-white/25'"
                >
                    <input type="checkbox" class="sr-only" :checked="statsForm.keys.includes(item.key)" @change="toggleStatKey(item.key)" />
                    {{ item.label }}
                </label>
            </div>
            <p v-if="statsForm.recentlySuccessful" class="mt-3 text-xs text-emerald-300">Збережено.</p>
        </div>

        <div v-if="health" v-reveal class="mb-10">
            <p class="mb-3 text-xs uppercase tracking-widest text-white/30">Стан сервера</p>
            <div class="grid gap-4 sm:grid-cols-4">
                <Link
                    :href="route().has('admin.failed-jobs.index') ? route('admin.failed-jobs.index') : '#'"
                    v-glow
                    class="glass-panel p-5"
                    :class="health.failedJobs > 0 ? 'border-ember-500/30' : ''"
                >
                    <p class="text-[11px] uppercase tracking-widest text-white/40">Провалені джоби</p>
                    <p class="font-display mt-1 text-2xl" :class="health.failedJobs > 0 ? 'text-ember-500' : 'text-white'">
                        {{ health.failedJobs }}
                    </p>
                </Link>
                <div v-glow class="glass-panel p-5">
                    <p class="text-[11px] uppercase tracking-widest text-white/40">У черзі</p>
                    <p class="font-display mt-1 text-2xl text-white">{{ health.queuedJobs }}</p>
                </div>
                <div v-glow class="glass-panel p-5">
                    <p class="text-[11px] uppercase tracking-widest text-white/40">Диск вільно</p>
                    <p class="font-display mt-1 text-2xl text-white">
                        {{ health.disk ? `${health.disk.freeGb} / ${health.disk.totalGb} ГБ` : '—' }}
                    </p>
                </div>
                <div v-glow class="glass-panel p-5">
                    <p class="text-[11px] uppercase tracking-widest text-white/40">Останній бекап</p>
                    <p class="font-display mt-1 text-2xl" :class="!health.lastBackupAt ? 'text-ember-500' : 'text-white'">
                        {{ fmtRelative(health.lastBackupAt) }}
                    </p>
                </div>
            </div>
        </div>

        <div v-for="group in groups" :key="group.label" class="mb-10 last:mb-0">
            <h2 class="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/35">{{ group.label }}</h2>
            <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Link
                    v-for="(item, i) in group.items"
                    :key="item.href"
                    :href="item.href"
                    v-reveal="'scale'"
                    :style="{ transitionDelay: `${i * 60}ms` }"
                    v-glow class="group glass-panel relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-gold"
                >
                    <div class="glass-sheen"></div>
                    <h3 class="relative font-semibold text-white">{{ item.label }}</h3>
                    <p class="relative mt-2 text-sm leading-relaxed text-white/50">{{ item.description }}</p>
                    <span class="relative mt-4 inline-block text-xs uppercase tracking-widest text-gold-300/80">Відкрити →</span>
                </Link>
            </div>
        </div>
    </AdminLayout>
</template>
