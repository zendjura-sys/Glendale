<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import Modal from '@/Components/Modal.vue';
import { Head } from '@inertiajs/vue3';
import { ref } from 'vue';

const props = defineProps({
    addons: { type: Array, default: () => [] },
    recentAudit: { type: Array, default: () => [] },
});

/* ---------- сповіщення ---------- */
const toasts = ref([]);
let toastId = 0;
function pushToast(ok, message) {
    const id = ++toastId;
    toasts.value.push({ id, ok, message });
    setTimeout(() => {
        toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 5000);
}

/* ---------- завантаження архіву(ів) ---------- */
const uploading = ref(null);
const batchProgress = ref(null);
const dragOver = ref(false);

async function uploadFile(file) {
    const form = new FormData();
    form.append('package', file);
    uploading.value = 0;

    try {
        const { data } = await window.axios.post(route('admin.union.addons.upload'), form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (evt) => {
                if (evt.total) uploading.value = Math.round((evt.loaded / evt.total) * 100);
            },
        });
        pushToast(data.ok, `${file.name}: ${data.message}`);
        return data.ok;
    } catch (e) {
        pushToast(false, `${file.name}: ${e.response?.data?.message || 'Помилка завантаження пакета'}`);
        return false;
    } finally {
        uploading.value = null;
    }
}

async function uploadFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith('.zip'));
    if (files.length === 0) {
        pushToast(false, 'Очікується ZIP-архів (.zip)');
        return;
    }

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
        batchProgress.value = { current: i + 1, total: files.length };
        if (await uploadFile(files[i])) successCount++;
    }
    batchProgress.value = null;

    if (successCount > 0) window.location.reload();
}

function onDrop(e) {
    dragOver.value = false;
    uploadFiles(e.dataTransfer.files);
}

function onPick(e) {
    uploadFiles(e.target.files);
    e.target.value = '';
}

/* ---------- дії над встановленим пакетом ---------- */
const busyAddon = ref(null);

async function act(addon, action) {
    busyAddon.value = addon.id;
    try {
        const { data } = await window.axios.post(route(`admin.union.addons.${action}`, addon.id));
        pushToast(data.ok, data.message);
        if (data.ok) window.location.reload();
    } catch (e) {
        pushToast(false, e.response?.data?.message || 'Помилка операції');
    } finally {
        busyAddon.value = null;
    }
}

async function confirmDestroy(addon) {
    if (!confirm(`Видалити «${addon.name}» версії ${addon.version}? Це незворотно.`)) return;
    busyAddon.value = addon.id;
    try {
        const { data } = await window.axios.delete(route('admin.union.addons.destroy', addon.id));
        pushToast(data.ok, data.message);
        if (data.ok) window.location.reload();
    } catch (e) {
        pushToast(false, e.response?.data?.message || 'Помилка операції');
    } finally {
        busyAddon.value = null;
    }
}

const statusMeta = {
    active: { label: 'Активний', class: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30' },
    inactive: { label: 'Вимкнений', class: 'bg-white/5 text-white/40 border-white/10' },
    pending_migration: { label: 'Очікує міграцій', class: 'bg-gold-400/15 text-gold-300 border-gold-400/30' },
    failed: { label: 'Помилка', class: 'bg-ember-500/15 text-ember-500 border-ember-500/30' },
};

function fmtDate(iso) {
    return new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const infoAddon = ref(null);
</script>

<template>
    <Head title="Аддони союзу — Monsory Connect" />

    <AdminLayout title="Аддони союзу">
        <div class="pointer-events-none fixed inset-x-4 top-6 z-[100] flex flex-col gap-3 sm:inset-x-auto sm:right-6 sm:w-full sm:max-w-sm">
            <TransitionGroup name="toast">
                <div
                    v-for="t in toasts"
                    :key="t.id"
                    class="pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-md"
                    :class="t.ok ? 'border-emerald-400/30 bg-emerald-950/80 text-emerald-200' : 'border-ember-500/30 bg-ember-600/20 text-ember-500'"
                >
                    {{ t.message }}
                </div>
            </TransitionGroup>
        </div>

        <p class="mb-8 max-w-2xl text-sm text-white/40">
            Незалежна гілка аддонів для union.gamecon.online — окремий тип пакета й окреме право (union.manage), не пов'язані з «Аддони» в основній адмінці. Формат ZIP і manifest.json той самий.
        </p>

        <!-- ================= UPLOAD ZONE ================= -->
        <div
            class="group relative mb-8 overflow-hidden rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300"
            :class="dragOver ? 'border-gold-400/60 bg-gold-400/5' : 'border-white/10 hover:border-white/20'"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="onDrop"
        >
            <div v-if="uploading !== null" class="mx-auto max-w-sm">
                <p class="mb-3 text-sm text-white/60">
                    <template v-if="batchProgress && batchProgress.total > 1">
                        Завантаження {{ batchProgress.current }} з {{ batchProgress.total }}…
                    </template>
                    <template v-else>Завантаження пакета…</template>
                </p>
                <div class="h-2 overflow-hidden rounded-full bg-white/10">
                    <div class="h-full rounded-full bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 transition-all duration-200" :style="{ width: uploading + '%' }"></div>
                </div>
                <p class="mt-2 text-xs text-white/40">{{ uploading }}%</p>
            </div>
            <template v-else>
                <p class="font-display text-2xl text-white">Завантажити Union-пакет</p>
                <p class="mt-2 text-sm text-white/40">
                    Формат назви: <code class="text-gold-300/80">(Union)(x.y.z)Name.zip</code>, manifest.type = "union"
                </p>
                <p class="mt-1 text-xs text-white/30">Можна вибрати або перетягнути одразу кілька ZIP-архівів</p>
                <label class="mt-6 inline-block cursor-pointer rounded-full bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 px-8 py-3 text-sm font-semibold uppercase tracking-widest text-obsidian-950 shadow-gold transition-transform hover:scale-[1.03]">
                    Вибрати ZIP
                    <input type="file" accept=".zip" multiple class="hidden" @change="onPick" />
                </label>
                <p class="mt-3 text-xs text-white/30">або перетягніть один чи кілька файлів сюди</p>
            </template>
        </div>

        <!-- ================= LIST ================= -->
        <div v-if="addons.length === 0" class="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center text-white/30">
            Пакетів ще не завантажено
        </div>

        <div v-else class="grid gap-4 sm:grid-cols-2">
            <div
                v-for="addon in addons"
                :key="addon.id"
                class="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-gold-400/20 hover:bg-white/[0.05]"
            >
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h3 class="font-semibold text-white">{{ addon.name }}</h3>
                        <p class="mt-0.5 text-xs text-white/40">{{ addon.slug }} · v{{ addon.version }}</p>
                    </div>
                    <span class="shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wide" :class="statusMeta[addon.status]?.class">
                        {{ statusMeta[addon.status]?.label }}
                    </span>
                </div>

                <p v-if="addon.manifest?.summary" class="mt-3 text-sm leading-relaxed text-white/50">{{ addon.manifest.summary }}</p>
                <p v-else-if="addon.manifest?.description" class="mt-3 line-clamp-2 text-sm leading-relaxed text-white/50">{{ addon.manifest.description }}</p>

                <p class="mt-4 text-[11px] text-white/30">Завантажено {{ fmtDate(addon.created_at) }}</p>

                <div class="mt-5 flex flex-wrap gap-2">
                    <button
                        v-if="addon.manifest?.highlights?.length || addon.manifest?.description"
                        class="rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/5"
                        @click="infoAddon = addon"
                    >
                        ℹ️ Детальніше
                    </button>
                    <button
                        v-if="!addon.status || addon.status === 'inactive' || addon.status === 'failed'"
                        :disabled="busyAddon === addon.id"
                        class="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-400/20 disabled:opacity-40"
                        @click="act(addon, 'activate')"
                    >
                        Активувати
                    </button>
                    <button
                        v-if="addon.status === 'active'"
                        :disabled="busyAddon === addon.id"
                        class="rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-white/5 disabled:opacity-40"
                        @click="act(addon, 'deactivate')"
                    >
                        Деактивувати
                    </button>
                    <button
                        v-if="addon.manifest?.migrations && !addon.migrations_applied"
                        :disabled="busyAddon === addon.id"
                        class="rounded-full border border-gold-400/30 bg-gold-400/10 px-4 py-1.5 text-xs font-medium text-gold-300 transition-colors hover:bg-gold-400/20 disabled:opacity-40"
                        @click="act(addon, 'migrate')"
                    >
                        Застосувати в БД
                    </button>
                    <button
                        v-if="addon.status !== 'active'"
                        :disabled="busyAddon === addon.id"
                        class="rounded-full border border-ember-500/25 px-4 py-1.5 text-xs font-medium text-ember-500/80 transition-colors hover:bg-ember-600/10 disabled:opacity-40"
                        @click="confirmDestroy(addon)"
                    >
                        Видалити
                    </button>
                </div>
            </div>
        </div>

        <!-- ================= AUDIT LOG ================= -->
        <div class="mt-16">
            <h2 class="font-display mb-4 text-xl text-white">Журнал дій</h2>
            <div class="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                <div v-for="log in recentAudit" :key="log.id" class="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-5 py-3 text-sm last:border-0">
                    <span class="text-white/60">
                        <span class="text-gold-300/80">{{ log.user?.name || 'система' }}</span>
                        — {{ log.action }}
                        <span v-if="log.addon" class="text-white/40">({{ log.addon.name }})</span>
                    </span>
                    <span class="shrink-0 whitespace-nowrap text-xs text-white/30">{{ fmtDate(log.created_at) }}</span>
                </div>
                <div v-if="recentAudit.length === 0" class="px-5 py-6 text-center text-sm text-white/30">Поки що пусто</div>
            </div>
        </div>

        <Modal :show="infoAddon !== null" max-width="lg" @close="infoAddon = null">
            <div v-if="infoAddon" class="p-6">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h3 class="font-display text-xl text-white">{{ infoAddon.name }}</h3>
                        <p class="mt-0.5 text-xs text-white/40">{{ infoAddon.slug }} · v{{ infoAddon.version }}</p>
                    </div>
                    <button class="text-white/40 hover:text-white" @click="infoAddon = null">✕</button>
                </div>

                <p v-if="infoAddon.manifest?.summary" class="mt-4 text-sm text-white/60">{{ infoAddon.manifest.summary }}</p>

                <ul v-if="infoAddon.manifest?.highlights?.length" class="mt-4 space-y-2">
                    <li v-for="(point, i) in infoAddon.manifest.highlights" :key="i" class="flex gap-2 text-sm leading-relaxed text-white/60">
                        <span class="text-gold-400/70">•</span>
                        <span>{{ point }}</span>
                    </li>
                </ul>
                <p v-else-if="infoAddon.manifest?.description" class="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/50">{{ infoAddon.manifest.description }}</p>

                <div class="mt-6 flex justify-end">
                    <button class="rounded-full border border-white/15 px-5 py-2 text-xs font-medium text-white/60 transition-colors hover:bg-white/5" @click="infoAddon = null">
                        Закрити
                    </button>
                </div>
            </div>
        </Modal>
    </AdminLayout>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from {
    opacity: 0;
    transform: translateX(30px);
}
.toast-leave-to {
    opacity: 0;
    transform: translateX(30px) scale(0.95);
}
</style>
