<script setup>
import { Head, Link, router } from '@inertiajs/vue3';
import { ref } from 'vue';

const props = defineProps({
    notifications: { type: Object, required: true },
    unreadCount: { type: Number, default: 0 },
});

const localUnread = ref(props.unreadCount);
const busy = ref(null);
const deleting = ref(null);

// markRead/markAllRead/deleteNotification ідуть напряму через axios (не
// Inertia router), тому спільний shared-проп unreadNotifications у
// AuthenticatedLayout (рахується в HandleInertiaRequests, бачить лише
// повноцінні Inertia-візити) інакше ніколи б не оновився — бейдж у
// навігації зависав зі старим числом, поки користувач не перейде на іншу
// сторінку. Частковий reload лише цього пропу фіксує це без повного
// перезавантаження сторінки.
function refreshNavBadge() {
    router.reload({ only: ['unreadNotifications'] });
}

async function markRead(notification) {
    if (notification.read_at || busy.value === notification.id) return;
    busy.value = notification.id;
    try {
        await window.axios.post(route('notifications.read', notification.id));
        notification.read_at = new Date().toISOString();
        localUnread.value = Math.max(0, localUnread.value - 1);
        refreshNavBadge();
    } finally {
        busy.value = null;
    }
}

const markingAll = ref(false);
async function markAllRead() {
    markingAll.value = true;
    try {
        await window.axios.post(route('notifications.read-all'));
        props.notifications.data.forEach((n) => { if (!n.read_at) n.read_at = new Date().toISOString(); });
        localUnread.value = 0;
        refreshNavBadge();
    } finally {
        markingAll.value = false;
    }
}

async function deleteNotification(notification) {
    deleting.value = notification.id;
    try {
        await window.axios.delete(route('notifications.destroy', notification.id));
        const wasUnread = !notification.read_at;
        props.notifications.data = props.notifications.data.filter((n) => n.id !== notification.id);
        if (wasUnread) localUnread.value = Math.max(0, localUnread.value - 1);
        refreshNavBadge();
    } finally {
        deleting.value = null;
    }
}

const typeLabels = {
    broadcast: 'Оголошення',
    report_reviewed: 'Звіт',
    achievement_unlocked: 'Ачівка',
    leave_request_reviewed: 'Відпустка',
    family_goal_completed: 'Ціль родини',
    investment_tier_unlocked: 'Інвестиції',
};

function fmtDateTime(iso) {
    return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
    <Head title="Сповіщення" />

    <div class="min-h-screen bg-obsidian-950 font-sans text-white/80">
        <header class="border-b border-white/5 bg-obsidian-900/60 backdrop-blur-md">
            <div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
                <div>
                    <Link :href="route('dashboard')" class="text-xs uppercase tracking-widest text-white/40 hover:text-gold-300">
                        ← Кабінет
                    </Link>
                    <h1 class="font-display mt-2 text-3xl font-light text-white">
                        Сповіщення
                        <span v-if="localUnread > 0" class="text-gradient-gold italic">({{ localUnread }})</span>
                    </h1>
                </div>
                <button
                    v-if="localUnread > 0"
                    :disabled="markingAll"
                    class="rounded-xl border border-white/15 px-4 py-2 text-xs text-white/60 transition-colors hover:border-white/30 disabled:opacity-40"
                    @click="markAllRead"
                >
                    Позначити всі прочитаними
                </button>
            </div>
        </header>

        <div class="mx-auto max-w-3xl px-6 py-10">
            <div v-reveal v-glow class="glass-panel overflow-hidden">
                <div
                    v-for="n in notifications.data"
                    :key="n.id"
                    class="group flex w-full items-stretch gap-2 border-b border-white/5 text-left last:border-0 transition-colors hover:bg-white/[0.03]"
                    :class="!n.read_at && 'bg-gold-400/[0.03]'"
                >
                    <button
                        class="min-w-0 flex-1 px-6 py-4 text-left disabled:cursor-default"
                        :disabled="busy === n.id"
                        @click="markRead(n)"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex items-center gap-2">
                                <span v-if="!n.read_at" class="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400"></span>
                                <span class="font-medium text-white">{{ n.title }}</span>
                            </div>
                            <span class="shrink-0 text-[10px] uppercase tracking-widest text-white/30">{{ typeLabels[n.type] || n.type }}</span>
                        </div>
                        <p v-if="n.body" class="mt-1 text-sm leading-relaxed text-white/50">{{ n.body }}</p>
                        <p class="mt-2 text-[11px] text-white/30">{{ fmtDateTime(n.created_at) }}</p>
                    </button>
                    <button
                        class="shrink-0 self-center px-3 text-white/20 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 disabled:opacity-40"
                        :disabled="deleting === n.id"
                        title="Видалити"
                        @click="deleteNotification(n)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                            <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
                <div v-if="notifications.data.length === 0" class="px-6 py-12 text-center text-white/30">
                    Сповіщень поки немає
                </div>
            </div>

            <div v-if="notifications.links?.length > 3" class="mt-6 flex flex-wrap gap-2">
                <Link
                    v-for="link in notifications.links"
                    :key="link.label"
                    :href="link.url || ''"
                    v-html="link.label"
                    class="rounded-xl border px-3 py-1.5 text-xs"
                    :class="[
                        link.active ? 'border-gold-400/50 bg-gold-400/10 text-gold-200' : 'border-white/10 text-white/40 hover:text-white',
                        !link.url && 'pointer-events-none opacity-30',
                    ]"
                />
            </div>
        </div>
    </div>
</template>
