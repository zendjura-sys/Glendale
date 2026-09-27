<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import { Head, router, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

// Система управління родинами: перевірка нових родин і союзів.
const props = defineProps({
    projects: { type: Array, default: () => [] },
    status: { type: String, default: 'pending' },
    pending: { type: Object, default: () => ({ families: 0, unions: 0 }) },
    families: { type: Array, default: () => [] },
    unions: { type: Array, default: () => [] },
});

const flash = computed(() => usePage().props.flash?.status);
const formError = computed(() => Object.values(usePage().props.errors || {})[0]);
const tabs = [
    { key: 'pending', label: 'На перевірці' },
    { key: 'verified', label: 'Підтверджені' },
    { key: 'rejected', label: 'Відхилені' },
];

// Відхилення — лише з поясненням для лідера.
const rejecting = ref(null); // { kind: 'family'|'union', id, name }
const note = ref('');
const error = ref('');
const busy = ref(false);

function show(status) {
    router.get(route('admin.families.index'), { status }, { preserveScroll: true });
}

function verify(kind, id) {
    const name = kind === 'family' ? 'admin.families.verify' : 'admin.families.unions.verify';
    busy.value = true;
    router.post(route(name, id), {}, { preserveScroll: true, onFinish: () => (busy.value = false) });
}

function openReject(kind, item) {
    rejecting.value = { kind, id: item.id, name: item.name };
    note.value = item.reviewNote || '';
    error.value = '';
}

function reject() {
    const r = rejecting.value;
    const name = r.kind === 'family' ? 'admin.families.reject' : 'admin.families.unions.reject';
    busy.value = true;
    router.post(route(name, r.id), { note: note.value }, {
        preserveScroll: true,
        onSuccess: () => (rejecting.value = null),
        onError: (e) => (error.value = e.note || 'Не вдалося відхилити.'),
        onFinish: () => (busy.value = false),
    });
}

// Довідник проєктів і серверів (усі — на одному сайті).
const newProject = ref('');
const newWebsite = ref('');
const newLogo = ref(null);
const newLogoPreview = computed(() => (newLogo.value ? URL.createObjectURL(newLogo.value) : null));
const serverInput = ref({}); // projectId → текст (сервери по рядку)
const opts = { preserveScroll: true };

function addProject() {
    if (!newProject.value.trim()) return;
    router.post(
        route('admin.families.projects.store'),
        { name: newProject.value, website: newWebsite.value, logo: newLogo.value },
        { ...opts, forceFormData: true, onSuccess: () => ((newProject.value = ''), (newWebsite.value = ''), (newLogo.value = null)) },
    );
}
function addServers(project) {
    const names = (serverInput.value[project.id] || '').trim();
    if (!names) return;
    router.post(route('admin.families.projects.servers', project.id), { names }, { ...opts, onSuccess: () => (serverInput.value[project.id] = '') });
}
function uploadLogo(project, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    router.post(route('admin.families.projects.logo', project.id), { logo: file }, { ...opts, forceFormData: true });
    event.target.value = '';
}
const expanded = ref({}); // projectId → показати всі сервери
const SERVERS_PREVIEW = 60;
function setSource(project, source) {
    fetching.value = project.id;
    router.post(route('admin.families.projects.servers-source', project.id), { source }, { ...opts, onFinish: () => (fetching.value = null) });
}
const websiteInput = ref({}); // projectId → адреса сайту
const fetching = ref(null);
function fetchLogo(project) {
    fetching.value = project.id;
    const website = websiteInput.value[project.id] ?? project.website ?? '';
    router.post(route('admin.families.projects.website', project.id), { website }, { ...opts, onFinish: () => (fetching.value = null) });
}
function removeProject(project) {
    if (!confirm(`Видалити проєкт «${project.name}» разом із серверами? Родини лишаться, але без прив'язки до проєкту.`)) return;
    router.delete(route('admin.families.projects.destroy', project.id), opts);
}
function removeServer(server) {
    if (!confirm(`Видалити сервер «${server.name}»?`)) return;
    router.delete(route('admin.families.servers.destroy', server.id), opts);
}

function fmt(d) {
    return d ? new Date(d.replace(' ', 'T')).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
}
</script>

<template>
    <Head title="Родини та союзи" />

    <AdminLayout title="Родини та союзи">
        <p v-if="flash" class="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            {{ flash }}
        </p>
        <p v-if="formError" class="mb-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {{ formError }}
        </p>

        <div class="mb-6 flex flex-wrap gap-2">
            <button
                v-for="t in tabs"
                :key="t.key"
                class="rounded-xl border px-4 py-2 text-sm transition"
                :class="props.status === t.key ? 'border-gold-400/60 bg-gold-400/15 text-gold-100' : 'border-white/10 text-white/60 hover:bg-white/5'"
                @click="show(t.key)"
            >
                {{ t.label }}
                <span v-if="t.key === 'pending' && pending.families + pending.unions" class="ml-1 rounded-xl bg-amber-400/20 px-2 text-xs text-amber-200">
                    {{ pending.families + pending.unions }}
                </span>
            </button>
        </div>

        <div class="space-y-8">
            <!-- Родини -->
            <section v-glow class="glass-panel p-6 sm:p-8">
                <h2 class="font-display mb-5 text-lg text-white">Родини</h2>
                <p v-if="!families.length" class="py-6 text-center text-sm text-white/40">Немає родин із цим статусом.</p>
                <div v-for="f in families" :key="f.id" class="mb-4 rounded-xl border border-white/10 bg-obsidian-900/40 p-4 last:mb-0">
                    <div class="flex flex-wrap items-start gap-4">
                        <a v-if="f.proof" :href="f.proof" target="_blank" rel="noopener" class="block shrink-0" title="Доказ — відкрити повністю">
                            <img :src="f.proof" alt="Доказ" class="h-24 w-36 rounded-lg object-cover ring-1 ring-white/10" />
                        </a>
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="text-base text-white">{{ f.name }}</span>
                                <span v-if="f.tag" class="rounded border border-gold-400/40 px-1.5 text-xs text-gold-200">[{{ f.tag }}]</span>
                            </div>
                            <p class="mt-1 text-xs text-white/50">
                                {{ f.project }}<template v-if="f.server"> · {{ f.server }}</template> · лідер: {{ f.leader || '—' }} · учасників: {{ f.membersCount }}
                            </p>
                            <p v-if="f.description" class="mt-2 text-sm text-white/70 [overflow-wrap:anywhere]">{{ f.description }}</p>
                            <p class="mt-2 flex flex-wrap gap-3 text-xs">
                                <a v-if="f.discordUrl" :href="f.discordUrl" target="_blank" rel="noopener" class="text-gold-300 hover:underline">Discord</a>
                                <a v-if="f.telegramUrl" :href="f.telegramUrl" target="_blank" rel="noopener" class="text-gold-300 hover:underline">Telegram</a>
                                <a :href="`/families/${f.id}`" class="text-gold-300 hover:underline">Сторінка родини</a>
                                <span class="text-white/35">подано {{ fmt(f.createdAt) }}</span>
                            </p>
                            <p v-if="f.reviewNote" class="mt-2 text-xs text-red-200/80">Причина відхилення: {{ f.reviewNote }}</p>
                        </div>
                        <div class="flex shrink-0 gap-2">
                            <button v-if="status !== 'verified'" :disabled="busy" class="rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-40" @click="verify('family', f.id)">
                                Підтвердити
                            </button>
                            <button v-if="status !== 'rejected'" :disabled="busy" class="rounded-xl border border-red-400/50 bg-red-400/10 px-4 py-2 text-xs text-red-100 hover:bg-red-400/20 disabled:opacity-40" @click="openReject('family', f)">
                                {{ status === 'verified' ? 'Зняти верифікацію' : 'Відхилити' }}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Союзи -->
            <section v-glow class="glass-panel p-6 sm:p-8">
                <h2 class="font-display mb-5 text-lg text-white">Союзи родин</h2>
                <p v-if="!unions.length" class="py-6 text-center text-sm text-white/40">Немає союзів із цим статусом.</p>
                <div v-for="u in unions" :key="u.id" class="mb-4 flex flex-wrap items-start gap-4 rounded-xl border border-white/10 bg-obsidian-900/40 p-4 last:mb-0">
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="text-base text-white">{{ u.name }}</span>
                            <span v-if="u.tag" class="rounded border border-gold-400/40 px-1.5 text-xs text-gold-200">[{{ u.tag }}]</span>
                        </div>
                        <p class="mt-1 text-xs text-white/50">Засновниця: {{ u.founder || '—' }} · подано {{ fmt(u.createdAt) }}</p>
                        <p v-if="u.description" class="mt-2 text-sm text-white/70 [overflow-wrap:anywhere]">{{ u.description }}</p>
                        <p class="mt-2 text-xs"><a :href="`/unions/${u.id}`" class="text-gold-300 hover:underline">Сторінка союзу</a></p>
                        <p v-if="u.reviewNote" class="mt-2 text-xs text-red-200/80">Причина відхилення: {{ u.reviewNote }}</p>
                    </div>
                    <div class="flex shrink-0 gap-2">
                        <button v-if="status !== 'verified'" :disabled="busy" class="rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-100 hover:bg-emerald-400/20 disabled:opacity-40" @click="verify('union', u.id)">
                            Підтвердити
                        </button>
                        <button v-if="status !== 'rejected'" :disabled="busy" class="rounded-xl border border-red-400/50 bg-red-400/10 px-4 py-2 text-xs text-red-100 hover:bg-red-400/20 disabled:opacity-40" @click="openReject('union', u)">
                            {{ status === 'verified' ? 'Зняти верифікацію' : 'Відхилити' }}
                        </button>
                    </div>
                </div>
            </section>
        </div>

        <!-- Довідник проєктів і серверів -->
        <section v-glow class="glass-panel mt-8 p-6 sm:p-8">
            <h2 class="font-display text-lg text-white">Проєкти й сервери</h2>
            <p class="mt-1 mb-5 text-xs text-white/45">
                Усі проєкти — на одному сайті. Родини обирають проєкт і сервер зі списку; нове, що додали гравці, позначено «новий» —
                воно підтверджується разом із родиною або тут.
            </p>
            <form class="mb-6 flex flex-wrap items-center gap-2" @submit.prevent="addProject">
                <label class="group relative block h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-dashed border-gold-400/40 bg-gold-400/5" title="Логотип нового проєкту">
                    <img v-if="newLogoPreview" :src="newLogoPreview" alt="" class="h-full w-full object-cover" />
                    <span v-else class="grid h-full w-full place-items-center text-lg text-gold-200/70">+</span>
                    <input type="file" accept="image/*" class="hidden" @change="newLogo = $event.target.files?.[0] ?? null" />
                </label>
                <input v-model="newProject" maxlength="60" placeholder="Новий проєкт, напр. Arizona Online" class="min-w-0 flex-1 rounded-xl border border-white/10 bg-obsidian-900/60 px-3 py-2 text-sm text-white placeholder:text-white/30" />
                <input v-model="newWebsite" maxlength="190" placeholder="Сайт (необов'язково) — звідти підтягнеться логотип" class="min-w-0 flex-1 rounded-xl border border-white/10 bg-obsidian-900/60 px-3 py-2 text-sm text-white placeholder:text-white/30" />
                <button class="rounded-xl border border-gold-400/50 bg-gold-400/10 px-4 py-2 text-xs text-gold-100 hover:bg-gold-400/20">Додати проєкт</button>
            </form>
            <div v-for="p in projects" :key="p.id" class="mb-4 rounded-xl border border-white/10 bg-obsidian-900/40 p-4 last:mb-0">
                <div class="flex flex-wrap items-center gap-3">
                    <label class="group relative block h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-gold-400/25 to-transparent" title="Завантажити логотип проєкту">
                        <img v-if="p.logo" :src="p.logo" alt="" class="h-full w-full object-cover" />
                        <span v-else class="grid h-full w-full place-items-center font-display text-lg text-gold-200">{{ p.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() }}</span>
                        <span class="absolute inset-0 grid place-items-center bg-black/55 text-[10px] text-white opacity-0 transition group-hover:opacity-100">Логотип</span>
                        <input type="file" accept="image/*" class="hidden" @change="uploadLogo(p, $event)" />
                    </label>
                    <span class="text-base text-white">{{ p.name }}</span>
                    <span class="text-xs text-white/40">родин: {{ p.families }} · серверів: {{ p.servers.length }}</span>
                    <button v-if="!p.approved" class="rounded-xl bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-200 hover:bg-amber-400/25" @click="router.post(route('admin.families.projects.approve', p.id), {}, opts)">новий · підтвердити</button>
                    <button class="ml-auto text-xs text-red-300/70 hover:text-red-300" @click="removeProject(p)">Видалити проєкт</button>
                </div>
                <div class="mt-3 flex flex-wrap items-center gap-2">
                    <input
                        :value="websiteInput[p.id] ?? p.website ?? ''"
                        maxlength="190"
                        placeholder="Офіційний сайт, напр. verba.online"
                        class="min-w-0 flex-1 rounded-xl border border-white/10 bg-obsidian-900/60 px-3 py-2 text-xs text-white placeholder:text-white/30"
                        @input="websiteInput[p.id] = $event.target.value"
                    />
                    <button :disabled="fetching === p.id" class="rounded-xl border border-gold-400/40 px-4 py-2 text-xs text-gold-100 hover:bg-gold-400/10 disabled:opacity-40" @click="fetchLogo(p)">
                        {{ fetching === p.id ? 'Завантажую…' : 'Логотип із сайту' }}
                    </button>
                </div>
                <div class="mt-3 flex flex-wrap gap-1.5">
                    <span v-for="sv in expanded[p.id] ? p.servers : p.servers.slice(0, SERVERS_PREVIEW)" :key="sv.id" class="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs" :class="sv.approved ? 'border-white/10 text-white/70' : 'border-amber-400/40 text-amber-200'">
                        {{ sv.name }}
                        <span v-if="sv.players != null" class="text-emerald-300/80" :title="sv.address">● {{ sv.players }}<template v-if="sv.maxPlayers">/{{ sv.maxPlayers }}</template></span>
                        <button v-if="!sv.approved" title="Підтвердити" class="text-amber-200 hover:text-white" @click="router.post(route('admin.families.servers.approve', sv.id), {}, opts)">✓</button>
                        <button title="Видалити" class="text-white/35 hover:text-red-300" @click="removeServer(sv)">×</button>
                    </span>
                    <button v-if="p.servers.length > SERVERS_PREVIEW" class="rounded-xl border border-white/10 px-2.5 py-1 text-xs text-gold-200/80 hover:bg-white/5" @click="expanded[p.id] = !expanded[p.id]">
                        {{ expanded[p.id] ? 'Згорнути' : `Показати всі (${p.servers.length})` }}
                    </button>
                    <span v-if="!p.servers.length" class="text-xs text-white/35">Серверів ще немає.</span>
                </div>
                <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/55">
                    <span>Автозаповнення серверів:</span>
                    <select
                        :value="p.serversSource ?? ''"
                        :disabled="fetching === p.id"
                        class="rounded-xl border border-white/10 bg-obsidian-900/60 px-3 py-1.5 text-xs text-white"
                        @change="setSource(p, $event.target.value || null)"
                    >
                        <option value="">вимкнено (вручну)</option>
                        <option value="ragemp">RAGE MP — назви, IP, онлайн</option>
                    </select>
                    <button v-if="p.serversSource" :disabled="fetching === p.id" class="rounded-xl border border-white/15 px-3 py-1.5 text-xs text-white/75 hover:bg-white/5 disabled:opacity-40" @click="setSource(p, p.serversSource)">
                        Оновити зараз
                    </button>
                    <span v-if="p.serversSyncedAt" class="text-white/35">оновлено {{ new Date(p.serversSyncedAt).toLocaleString('uk-UA') }}</span>
                </div>
                <div class="mt-3 flex flex-wrap items-start gap-2">
                    <textarea v-model="serverInput[p.id]" rows="2" placeholder="Сервери — по одному на рядок: номер 1–999 або назва літерами" class="min-w-0 flex-1 rounded-xl border border-white/10 bg-obsidian-900/60 px-3 py-2 text-xs text-white placeholder:text-white/30"></textarea>
                    <button class="rounded-xl border border-white/15 px-4 py-2 text-xs text-white/75 hover:bg-white/5" @click="addServers(p)">Додати сервери</button>
                </div>
            </div>
        </section>

        <!-- Причина відхилення -->
        <div v-if="rejecting" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="rejecting = null">
            <div class="glass-panel w-full max-w-md p-6">
                <h3 class="font-display text-lg text-white">Відхилити «{{ rejecting.name }}»</h3>
                <p class="mt-1 text-xs text-white/50">Лідер побачить пояснення й зможе виправити та подати знову.</p>
                <textarea v-model="note" rows="4" class="mt-4 w-full rounded-xl border border-white/10 bg-obsidian-900/60 p-3 text-sm text-white placeholder:text-white/30" placeholder="Напр.: на скріншоті не видно назви родини в грі"></textarea>
                <p v-if="error" class="mt-2 text-xs text-red-300">{{ error }}</p>
                <div class="mt-4 flex justify-end gap-2">
                    <button class="rounded-xl border border-white/10 px-4 py-2 text-xs text-white/70 hover:bg-white/5" @click="rejecting = null">Скасувати</button>
                    <button :disabled="busy" class="rounded-xl border border-red-400/50 bg-red-400/15 px-4 py-2 text-xs text-red-100 hover:bg-red-400/25 disabled:opacity-40" @click="reject">Відхилити</button>
                </div>
            </div>
        </div>
    </AdminLayout>
</template>
