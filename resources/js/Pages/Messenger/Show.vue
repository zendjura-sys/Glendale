<script setup>
import { Head, Link } from '@inertiajs/vue3';
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import EmojiPicker from '@/Components/Messenger/EmojiPicker.vue';
import GifPicker from '@/Components/Messenger/GifPicker.vue';
import StickerPicker from '@/Components/Messenger/StickerPicker.vue';

const props = defineProps({
    conversation: { type: Object, required: true },
    messages: { type: Array, required: true },
    myId: { type: Number, required: true },
    giphyEnabled: { type: Boolean, default: false },
    onlineUserIds: { type: Array, default: () => [] },
});

const list = ref([...props.messages]);
// Статус 🟢/🔴: direct — співрозмовник, групи — хто з авторів у мережі.
// Оновлюється тим самим poll(), що й повідомлення.
const presence = ref(props.conversation.presence ?? null);
const onlineCount = ref(props.conversation.onlineCount ?? null);
const onlineIds = ref(new Set(props.onlineUserIds ?? []));
const isGroup = props.conversation.type === 'family' || props.conversation.type === 'deputies';
const showMembers = ref(false);
const members = ref([]);
const membersLoading = ref(false);

async function openMembers() {
    showMembers.value = true;
    membersLoading.value = true;
    try {
        const { data } = await window.axios.get(route('messenger.members', props.conversation.id));
        members.value = data.data.members;
    } catch {
        members.value = [];
    } finally {
        membersLoading.value = false;
    }
}

function parseBody(m) {
    try {
        return JSON.parse(m.body) ?? {};
    } catch {
        return {};
    }
}

function richLink(m) {
    if (m.type === 'location') {
        const { lat, lng } = parseBody(m);
        return `https://www.google.com/maps?q=${lat},${lng}`;
    }
    return m.attachmentUrl;
}

function richLabel(m) {
    if (m.type === 'location') return '📍 Геопозиція — відкрити на мапі';
    const { name, size } = parseBody(m);
    const kb = size ? ` · ${size >= 1048576 ? (size / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(size / 1024)) + ' КБ'}` : '';
    return `📎 ${name ?? 'Файл'}${kb}`;
}

function presenceEmoji(userId) {
    return onlineIds.value.has(userId) ? '🟢' : '🔴';
}
const draft = ref('');
const sending = ref(false);
const scroller = ref(null);
const activePicker = ref(null);
const photoInput = ref(null);
const photoFile = ref(null);
const photoPreview = ref(null);
let pollTimer = null;

function lastId() {
    return list.value.length ? list.value[list.value.length - 1].id : 0;
}

// Додає нові повідомлення, відкидаючи ті, чий id уже в списку — без
// цього щойно надіслане повідомлення могло опинитись двічі: раз одразу
// з відповіді на сам запит відправки, і ще раз через наступний poll(),
// якщо той встиг підвантажити той самий рядок із сервера, поки відповідь
// на відправку ще була в дорозі (особливо на повільному з'єднанні).
function appendMessages(newMessages) {
    if (!newMessages.length) return;
    const existingIds = new Set(list.value.map((m) => m.id));
    const fresh = newMessages.filter((m) => !existingIds.has(m.id));
    if (fresh.length) list.value.push(...fresh);
}

async function scrollToBottom() {
    await nextTick();
    if (scroller.value) {
        scroller.value.scrollTop = scroller.value.scrollHeight;
    }
}

async function poll() {
    try {
        const { data } = await window.axios.get(route('messenger.messages', props.conversation.id), {
            params: { after_id: lastId() },
        });
        const fresh = data.data.messages;
        if (data.data.presence !== undefined) presence.value = data.data.presence;
        if (data.data.onlineCount !== undefined) onlineCount.value = data.data.onlineCount;
        if (data.data.onlineUserIds) onlineIds.value = new Set(data.data.onlineUserIds);
        if (fresh.length) {
            appendMessages(fresh);
            scrollToBottom();
            window.axios.post(route('messenger.read', props.conversation.id));
        }
    } catch {
        // Тиха невдача опитування — спробуємо ще раз наступним тіком,
        // не варто показувати помилку через кожен пропущений запит.
    }
}

function togglePicker(name) {
    activePicker.value = activePicker.value === name ? null : name;
}

function pickPhoto() {
    activePicker.value = null;
    photoInput.value?.click();
}

function onPhotoChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (photoPreview.value) URL.revokeObjectURL(photoPreview.value);
    photoFile.value = file;
    photoPreview.value = URL.createObjectURL(file);
}

function cancelPhoto() {
    if (photoPreview.value) URL.revokeObjectURL(photoPreview.value);
    photoFile.value = null;
    photoPreview.value = null;
}

function insertEmoji(emoji) {
    draft.value += emoji;
    activePicker.value = null;
}

async function sendGif(url) {
    activePicker.value = null;
    await sendPayload({ type: 'gif', gif_url: url });
}

async function sendSticker(stickerId) {
    activePicker.value = null;
    await sendPayload({ type: 'sticker', sticker_id: stickerId });
}

async function sendPayload(data) {
    if (sending.value) return;
    sending.value = true;
    try {
        const { data: res } = await window.axios.post(route('messenger.messages.store', props.conversation.id), data);
        appendMessages([res.data.message]);
        scrollToBottom();
    } finally {
        sending.value = false;
    }
}

async function send() {
    const body = draft.value.trim();
    if (sending.value) return;

    if (photoFile.value) {
        sending.value = true;
        try {
            const form = new FormData();
            form.append('type', 'photo');
            form.append('photo', photoFile.value);
            if (body) form.append('body', body);
            const { data } = await window.axios.post(route('messenger.messages.store', props.conversation.id), form);
            appendMessages([data.data.message]);
            draft.value = '';
            cancelPhoto();
            scrollToBottom();
        } finally {
            sending.value = false;
        }
        return;
    }

    if (!body) return;
    await sendPayload({ type: 'text', body });
    draft.value = '';
}

function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

// Бейдж "звідки" повідомлення — сервер сам визначає платформу
// (MessengerController::store, за наявністю Sanctum bearer-токена),
// тут лише показуємо іконку. null для повідомлень до цього релізу.
const PLATFORM_ICON = { mobile: '📱', web: '🌐', desktop: '💻' };
function platformIcon(platform) {
    return PLATFORM_ICON[platform] ?? null;
}

onMounted(() => {
    scrollToBottom();
    pollTimer = setInterval(poll, 3000);
});

onBeforeUnmount(() => {
    clearInterval(pollTimer);
    if (photoPreview.value) URL.revokeObjectURL(photoPreview.value);
});
</script>

<template>
    <Head :title="conversation.title" />

    <AuthenticatedLayout>
        <template #header>
            <div class="flex items-center gap-3">
                <Link :href="route('messenger.index')" class="text-white/40 transition hover:text-white/70">←</Link>
                <button
                    type="button"
                    class="min-w-0 text-left"
                    :class="conversation.type === 'finance' ? 'cursor-default' : 'cursor-pointer'"
                    :disabled="conversation.type === 'finance'"
                    @click="openMembers"
                >
                    <h2 class="truncate text-xl font-light tracking-wide text-white">
                        <span v-if="presence" class="mr-1 text-sm">{{ presence.emoji }}</span>{{ conversation.title }}
                    </h2>
                    <p v-if="presence" class="text-xs" :class="presence.online ? 'text-emerald-400/80' : 'text-white/40'">
                        {{ presence.label }}
                    </p>
                    <p v-else-if="onlineCount !== null" class="text-xs text-white/40">
                        🟢 {{ onlineCount }} у мережі · натисніть, щоб побачити учасників
                    </p>
                </button>
            </div>
        </template>

        <div class="py-8">
            <div class="mx-auto flex max-w-3xl flex-col px-4 sm:px-6 lg:px-8" style="height: calc(100svh - 220px)">
                <div ref="scroller" class="glass-panel flex-1 space-y-3 overflow-y-auto rounded-2xl p-4">
                    <div
                        v-for="m in list"
                        :key="m.id"
                        class="flex"
                        :class="m.isMine ? 'justify-end' : 'justify-start'"
                    >
                        <div class="min-w-0 max-w-[75%]" :class="m.isMine ? 'text-right' : 'text-left'">
                            <p v-if="!m.isMine && isGroup" class="mb-0.5 flex items-center gap-1.5 px-1 text-[11px] font-medium text-gold-300">
                                <span v-if="m.senderId" class="text-[8px]">{{ presenceEmoji(m.senderId) }}</span>
                                {{ m.senderName }}
                                <span
                                    v-if="m.senderPosition"
                                    class="rounded-xl border border-gold-400/30 bg-gold-400/10 px-1.5 py-0.5 text-[9px] font-normal uppercase tracking-wide text-gold-300/80"
                                >{{ m.senderPosition }}</span>
                            </p>

                            <!-- gif/стікер: без бульбашки, як у звичайних месенджерах -->
                            <div v-if="m.type === 'gif' || m.type === 'sticker'" class="inline-block">
                                <img
                                    :src="m.attachmentUrl"
                                    :alt="m.type === 'gif' ? 'GIF' : 'Стікер'"
                                    class="max-h-48 rounded-lg"
                                    :class="m.type === 'sticker' ? 'max-w-32' : 'max-w-56'"
                                />
                            </div>

                            <!-- фото: бульбашка з картинкою й необов'язковим підписом -->
                            <div
                                v-else-if="m.type === 'photo'"
                                class="inline-block overflow-hidden rounded-2xl"
                                :class="m.isMine ? 'bg-gold-400/90' : 'bg-white/5 ring-1 ring-white/10'"
                            >
                                <img :src="m.attachmentUrl" alt="" class="max-h-72 w-full object-cover" />
                                <p
                                    v-if="m.body"
                                    class="whitespace-pre-wrap px-4 py-2 text-sm [overflow-wrap:anywhere]"
                                    :class="m.isMine ? 'text-obsidian-950' : 'text-white/85'"
                                >
                                    {{ m.body }}
                                </p>
                            </div>

                            <!-- голосове (надіслане із застосунку) -->
                            <div
                                v-else-if="m.type === 'voice'"
                                class="inline-flex max-w-full items-center gap-2 rounded-2xl px-3 py-2"
                                :class="m.isMine ? 'bg-gold-400/90' : 'bg-white/5 ring-1 ring-white/10'"
                            >
                                <span>🎤</span>
                                <audio :src="m.attachmentUrl" controls preload="none" class="h-9 max-w-[220px]"></audio>
                            </div>

                            <!-- файл / геопозиція / контакт — картка з посиланням -->
                            <a
                                v-else-if="m.type === 'file' || m.type === 'location'"
                                :href="richLink(m)"
                                target="_blank"
                                rel="noopener"
                                class="inline-flex max-w-full items-center gap-2 rounded-2xl px-4 py-2 text-sm underline-offset-2 hover:underline"
                                :class="m.isMine
                                    ? 'bg-gold-400/90 text-obsidian-950'
                                    : 'bg-white/5 text-white/85 ring-1 ring-white/10'"
                            >
                                <span class="min-w-0 [overflow-wrap:anywhere]">{{ richLabel(m) }}</span>
                            </a>
                            <div
                                v-else-if="m.type === 'contact'"
                                class="inline-flex max-w-full items-center gap-2 rounded-2xl px-4 py-2 text-sm"
                                :class="m.isMine
                                    ? 'bg-gold-400/90 text-obsidian-950'
                                    : 'bg-white/5 text-white/85 ring-1 ring-white/10'"
                            >
                                👤 <span class="min-w-0 [overflow-wrap:anywhere]">{{ m.contact?.name ?? 'Контакт' }}<template v-if="m.contact?.position"> · {{ m.contact.position }}</template></span>
                            </div>

                            <!-- звичайний текст. overflow-wrap:anywhere — інакше довгий
                                 рядок без пробілів (посилання тощо) розпирав бульбашку
                                 за межі екрана. -->
                            <div
                                v-else
                                class="inline-block max-w-full rounded-2xl px-4 py-2 text-sm"
                                :class="m.isMine
                                    ? 'bg-gold-400/90 text-obsidian-950'
                                    : 'bg-white/5 text-white/85 ring-1 ring-white/10'"
                            >
                                <p v-if="m.type === 'text_e2ee'" class="italic opacity-70">
                                    Повідомлення з застосунку — відкрийте його в GameConnect
                                </p>
                                <p v-else class="whitespace-pre-wrap [overflow-wrap:anywhere]">{{ m.body }}</p>
                            </div>

                            <p class="mt-0.5 px-1 text-[10px] text-white/25">
                                <span v-if="platformIcon(m.platform)">{{ platformIcon(m.platform) }}</span>
                                {{ formatTime(m.createdAt) }}
                            </p>
                        </div>
                    </div>
                    <p v-if="!list.length" class="py-10 text-center text-sm text-white/30">
                        Повідомлень ще немає — напишіть першим.
                    </p>
                </div>

                <!-- Службовий чат Monsory Finance — лише для читання. -->
                <p v-if="conversation.type === 'finance'" class="mt-3 text-center text-xs text-white/35">
                    Службові повідомлення про ваш рахунок — відповідати не потрібно.
                </p>
                <template v-else>
                <div v-if="photoPreview" class="relative mt-3 inline-flex w-fit items-start gap-2 rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
                    <img :src="photoPreview" alt="" class="h-16 w-16 rounded-lg object-cover" />
                    <button type="button" class="text-xs text-white/40 hover:text-white/70" @click="cancelPhoto">Скасувати</button>
                </div>

                <div class="relative mt-2 flex items-center gap-1">
                    <EmojiPicker v-if="activePicker === 'emoji'" @select="insertEmoji" />
                    <GifPicker v-if="activePicker === 'gif'" @select="sendGif" />
                    <StickerPicker v-if="activePicker === 'sticker'" @select="sendSticker" />

                    <button type="button" title="Фото" class="rounded-lg p-2 text-lg transition hover:bg-white/5" @click="pickPhoto">📎</button>
                    <button type="button" title="Емодзі" class="rounded-lg p-2 text-lg transition hover:bg-white/5" @click="togglePicker('emoji')">😊</button>
                    <button
                        v-if="giphyEnabled"
                        type="button"
                        title="GIF"
                        class="rounded-lg px-2 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/5 hover:text-white/90"
                        @click="togglePicker('gif')"
                    >
                        GIF
                    </button>
                    <button type="button" title="Стікери" class="rounded-lg p-2 text-lg transition hover:bg-white/5" @click="togglePicker('sticker')">🏷️</button>
                    <input ref="photoInput" type="file" accept="image/*" class="hidden" @change="onPhotoChosen" />
                </div>

                <form class="mt-2 flex items-end gap-3" @submit.prevent="send">
                    <textarea
                        v-model="draft"
                        rows="1"
                        :placeholder="photoFile ? 'Підпис до фото (необов\'язково)…' : 'Повідомлення…'"
                        class="flex-1 resize-none rounded-xl border-white/10 bg-obsidian-900/60 text-sm text-white placeholder:text-white/30 focus:border-gold-400 focus:ring-gold-400"
                        @keydown.enter.exact.prevent="send"
                    />
                    <button
                        type="submit"
                        :disabled="sending || (!draft.trim() && !photoFile)"
                        class="rounded-xl bg-gold-400 px-5 py-2.5 text-sm font-semibold text-obsidian-950 transition hover:bg-gold-300 disabled:opacity-40"
                    >
                        Надіслати
                    </button>
                </form>
                </template>
            </div>
        </div>
        <!-- Учасники розмови зі статусом 🟢/🔴 і "був(-ла) у мережі …" -->
        <div
            v-if="showMembers"
            class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
            @click.self="showMembers = false"
        >
            <div class="glass-panel max-h-[75svh] w-full max-w-md overflow-hidden rounded-2xl">
                <div class="flex items-center justify-between border-b border-white/5 px-5 py-4">
                    <p class="text-sm font-medium text-white">Учасники</p>
                    <button type="button" class="text-white/40 hover:text-white/70" @click="showMembers = false">✕</button>
                </div>
                <div class="max-h-[60svh] space-y-1 overflow-y-auto p-3">
                    <p v-if="membersLoading" class="px-2 py-4 text-center text-xs text-white/40">Завантаження…</p>
                    <div v-for="u in members" :key="u.id" class="flex items-center gap-3 rounded-lg px-2 py-2">
                        <img v-if="u.avatarUrl" :src="u.avatarUrl" class="h-9 w-9 rounded-full object-cover ring-1 ring-white/10" alt="" />
                        <span v-else class="flex h-9 w-9 items-center justify-center rounded-full bg-gold-400/10 text-xs font-semibold text-gold-300 ring-1 ring-gold-400/30">
                            {{ u.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() }}
                        </span>
                        <div class="min-w-0 flex-1">
                            <p class="truncate text-sm text-white">
                                <span class="mr-1 text-[10px]">{{ u.presence?.emoji ?? '🔴' }}</span>{{ u.name }}<span v-if="u.isMe" class="text-white/30"> (ви)</span>
                            </p>
                            <p class="truncate text-[11px]" :class="u.presence?.online ? 'text-emerald-400/80' : 'text-white/40'">
                                {{ u.presence?.label ?? 'не в мережі' }}<template v-if="u.position"> · {{ u.position }}</template>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </AuthenticatedLayout>
</template>
