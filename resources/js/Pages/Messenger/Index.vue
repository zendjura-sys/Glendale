<script setup>
import { Head, Link, router } from '@inertiajs/vue3';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';

defineProps({
    conversations: { type: Array, required: true },
});

// Тихе оновлення списку раз на 30с — статуси 🟢/🔴 і лічильники не застигають.
let refreshTimer = null;
onMounted(() => {
    refreshTimer = setInterval(() => router.reload({ only: ['conversations'] }), 30000);
});
onBeforeUnmount(() => clearInterval(refreshTimer));

const showSearch = ref(false);
const query = ref('');
const matches = ref([]);
const searching = ref(false);
let timer = null;

watch(query, (q) => {
    clearTimeout(timer);
    if (q.trim().length < 2) {
        matches.value = [];
        return;
    }
    searching.value = true;
    timer = setTimeout(async () => {
        const { data } = await window.axios.get(route('messenger.members.search'), { params: { q } });
        matches.value = data.data.members;
        searching.value = false;
    }, 250);
});

function openSearch() {
    showSearch.value = true;
    query.value = '';
    matches.value = [];
}

function startDirect(user) {
    router.post(route('messenger.direct.start', user.id));
}

function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
        ? d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
}

function initials(name) {
    return (name || '?').trim().charAt(0).toUpperCase();
}
</script>

<template>
    <Head title="Чат" />

    <AuthenticatedLayout>
        <template #header>
            <h2 class="text-xl font-light tracking-wide text-white">Чат</h2>
        </template>

        <div class="py-8">
            <div class="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                <div class="mb-6 flex items-center justify-between">
                    <p class="text-sm text-white/40">
                        Сімейний чат і особисті розмови
                    </p>
                    <button
                        type="button"
                        class="glass-pill inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-gold-300 transition hover:text-gold-200"
                        @click="openSearch"
                    >
                        <span>+ Нова розмова</span>
                    </button>
                </div>

                <div v-if="showSearch" class="glass-panel mb-6 rounded-2xl p-4">
                    <input
                        v-model="query"
                        type="text"
                        placeholder="Ім'я учасника…"
                        class="w-full rounded-lg border-white/10 bg-obsidian-900/60 text-sm text-white placeholder:text-white/30 focus:border-gold-400 focus:ring-gold-400"
                    />
                    <div v-if="matches.length" class="mt-3 space-y-1">
                        <button
                            v-for="m in matches"
                            :key="m.id"
                            type="button"
                            class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/5"
                            @click="startDirect(m)"
                        >
                            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-gold-400/10 text-xs font-semibold text-gold-300 ring-1 ring-gold-400/30">
                                {{ initials(m.name) }}
                            </span>
                            <span class="min-w-0">
                                <span class="block truncate"><span v-if="m.presence" class="mr-1 text-[10px]">{{ m.presence.emoji }}</span>{{ m.name }}</span>
                                <span v-if="m.presence" class="block text-[11px]" :class="m.presence.online ? 'text-emerald-400/80' : 'text-white/35'">{{ m.presence.label }}</span>
                            </span>
                        </button>
                    </div>
                    <p v-else-if="query.trim().length >= 2 && !searching" class="mt-3 text-xs text-white/30">
                        Нікого не знайдено.
                    </p>
                </div>

                <div class="space-y-2">
                    <Link
                        v-for="c in conversations"
                        :key="c.id"
                        :href="route('messenger.show', c.id)"
                        class="glass-panel group flex items-center gap-4 rounded-2xl p-4 transition hover:bg-white/[0.03]"
                    >
                        <span
                            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1"
                            :class="c.type === 'family' || c.type === 'deputies'
                                ? 'bg-gold-400/15 text-gold-300 ring-gold-400/30'
                                : 'bg-white/5 text-white/70 ring-white/10'"
                        >
                            {{ c.type === 'family' ? '👪' : c.type === 'deputies' ? '🎖️' : c.type === 'finance' ? '🏦' : initials(c.title) }}
                        </span>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center justify-between gap-2">
                                <p class="truncate text-sm font-medium text-white">
                                    <span v-if="c.presence" class="mr-1 text-[10px]">{{ c.presence.emoji }}</span>{{ c.title }}
                                    <span v-if="c.onlineCount" class="ml-1 text-[11px] font-normal text-white/35">· 🟢 {{ c.onlineCount }}</span>
                                </p>
                                <span class="shrink-0 text-[11px] text-white/30">{{ formatTime(c.lastMessage?.createdAt) }}</span>
                            </div>
                            <p class="mt-0.5 truncate text-xs text-white/40">
                                <template v-if="c.lastMessage">
                                    <span v-if="c.lastMessage.isMine">Ви: </span>
                                    <span v-else-if="c.type === 'family' || c.type === 'deputies'">{{ c.lastMessage.senderName }}: </span>
                                    {{ c.lastMessage.body }}
                                </template>
                                <template v-else>Ще немає повідомлень</template>
                            </p>
                        </div>
                        <span
                            v-if="c.unread > 0"
                            class="ml-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-xl bg-gold-400 px-1.5 text-[10px] font-semibold text-obsidian-950"
                        >
                            {{ c.unread > 99 ? '99+' : c.unread }}
                        </span>
                    </Link>
                </div>
            </div>
        </div>
    </AuthenticatedLayout>
</template>
