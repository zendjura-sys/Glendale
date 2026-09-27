<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import InputLabel from '@/Components/InputLabel.vue';
import TextInput from '@/Components/TextInput.vue';
import InputError from '@/Components/InputError.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import { Head, router, useForm, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';

const props = defineProps({
    brand: { type: Object, required: true },
    theme: { type: Object, required: true },
    effectLevels: { type: Array, default: () => [] },
    seasonalThemes: { type: Array, default: () => [] },
    content: { type: Object, required: true },
    carousels: { type: Object, required: true },
    pendingAvatars: { type: Array, default: () => [] },
    gallery: { type: Array, default: () => [] },
    socialLinks: { type: Array, default: () => [] },
    socialPlatforms: { type: Array, default: () => [] },
});

const TABS = computed(() => [
    { key: 'brand', label: 'Бренд' },
    { key: 'theme', label: 'Оформлення' },
    { key: 'structure', label: 'Структура' },
    { key: 'sections', label: 'Розділи' },
    { key: 'carousels', label: props.pendingAvatars.length > 0 ? `Каруселі (${props.pendingAvatars.length})` : 'Каруселі' },
    { key: 'social', label: 'Соцмережі' },
]);
const activeTab = ref('brand');

const status = computed(() => usePage().props.flash?.status);

/* ---------- бренд ---------- */
const brandForm = useForm({
    siteName: props.brand.siteName,
    siteTagline: props.brand.siteTagline,
    logo: null,
    favicon: null,
    removeLogo: false,
    removeFavicon: false,
});

// Предпросмотр до отправки: иначе непонятно, тот ли файл выбран, пока
// страница не перезагрузится.
const logoPreview = ref(props.brand.logoUrl);
const faviconPreview = ref(props.brand.faviconUrl);

function pickFile(field, event) {
    const file = event.target.files?.[0] ?? null;
    brandForm[field] = file;
    const url = file ? URL.createObjectURL(file) : null;
    if (field === 'logo') {
        logoPreview.value = url ?? props.brand.logoUrl;
        brandForm.removeLogo = false;
    } else {
        faviconPreview.value = url ?? props.brand.faviconUrl;
        brandForm.removeFavicon = false;
    }
}

function dropAsset(field) {
    brandForm[field] = null;
    if (field === 'logo') {
        brandForm.removeLogo = true;
        logoPreview.value = null;
    } else {
        brandForm.removeFavicon = true;
        faviconPreview.value = null;
    }
}

function saveBrand() {
    // forceFormData: файлы иначе уйдут как JSON и до сервера не доедут.
    brandForm.post(route('admin.design.brand'), { preserveScroll: true, forceFormData: true });
}

/* ---------- оформлення ---------- */
const EFFECT_LABELS = {
    full: 'Повна — аврора, зерно, свічення',
    soft: 'Стримана — менше руху й світла',
    off: 'Вимкнена — чистий фон',
};

const SEASONAL_LABELS = {
    none: 'Немає',
    new_year: 'Новий рік',
    christmas: 'Різдво',
    easter: 'Великдень',
    birthday: 'День народження родини',
};

const themeForm = useForm({ accent: props.theme.accent, effects: props.theme.effects, seasonalTheme: props.theme.seasonalTheme });

function saveTheme() {
    themeForm.put(route('admin.design.theme'), { preserveScroll: true });
}

/* ---------- зміст ---------- */
const contentForm = useForm({
    leadership: props.content.leadership.map((r) => ({ ...r })),
    positions: props.content.positions.map((r) => ({ ...r })),
    directions: props.content.directions.map((r) => ({ ...r })),
    promotionCriteria: [...props.content.promotionCriteria],
    about: [...props.content.about],
});

function addRow(list, shape) {
    contentForm[list].push({ ...shape });
}

function removeRow(list, index) {
    contentForm[list].splice(index, 1);
}

function move(list, index, delta) {
    const target = index + delta;
    const rows = contentForm[list];
    if (target < 0 || target >= rows.length) return;
    [rows[index], rows[target]] = [rows[target], rows[index]];
}

function saveContent() {
    contentForm.put(route('admin.design.content'), { preserveScroll: true });
}

function resetBlock(key, label) {
    if (!confirm(`Повернути «${label}» до значень за замовчуванням? Ваші правки буде втрачено.`)) return;
    router.post(route('admin.design.content.reset'), { key }, { preserveScroll: true });
}

/* ---------- каруселі на головній ---------- */
const carouselsForm = useForm({
    showMembers: props.carousels.showMembers,
    showGallery: props.carousels.showGallery,
});

function saveCarousels() {
    carouselsForm.put(route('admin.design.carousels'), { preserveScroll: true });
}

const galleryForm = useForm({ photo: null, caption: '' });
const galleryPreview = ref(null);
const galleryInput = ref(null);

function pickGalleryPhoto(event) {
    const file = event.target.files?.[0] ?? null;
    galleryForm.photo = file;
    galleryPreview.value = file ? URL.createObjectURL(file) : null;
}

function uploadGalleryPhoto() {
    galleryForm.post(route('admin.design.gallery.store'), {
        preserveScroll: true,
        forceFormData: true,
        onSuccess: () => {
            galleryForm.reset();
            galleryPreview.value = null;
            if (galleryInput.value) galleryInput.value.value = '';
        },
    });
}

function removeGalleryPhoto(photo) {
    if (!confirm('Видалити це фото з галереї?')) return;
    router.delete(route('admin.design.gallery.destroy', photo.id), { preserveScroll: true });
}

function saveGalleryCaption(photo, value) {
    if (value === (photo.caption || '')) return;
    router.put(route('admin.design.gallery.update', photo.id), { caption: value }, { preserveScroll: true });
}

function moveGalleryPhoto(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= props.gallery.length) return;
    const order = props.gallery.map((p) => p.id);
    [order[index], order[target]] = [order[target], order[index]];
    router.put(route('admin.design.gallery.reorder'), { order }, { preserveScroll: true });
}

/* ---------- аватарки учасників на перевірці ---------- */
function approveAvatar(avatar) {
    router.post(route('admin.design.avatars.approve', avatar.id), {}, { preserveScroll: true });
}

function rejectAvatar(avatar) {
    if (!confirm(`Відхилити й видалити фото — «${avatar.name}»?`)) return;
    router.delete(route('admin.design.avatars.reject', avatar.id), { preserveScroll: true });
}

/* ---------- соцмережі у футері ---------- */
const PLATFORM_LABELS = {
    telegram: 'Telegram (гостьовий)',
    discord: 'Discord',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    instagram: 'Instagram',
    twitter: 'X (Twitter)',
    vk: 'VK',
    website: 'Інше посилання',
};

const socialForm = useForm({
    links: props.socialLinks.map((l) => ({ ...l })),
});

function addSocialLink() {
    socialForm.links.push({ platform: props.socialPlatforms[0] ?? 'website', url: '' });
}

function removeSocialLink(i) {
    socialForm.links.splice(i, 1);
}

function saveSocialLinks() {
    socialForm.put(route('admin.design.social-links'), { preserveScroll: true });
}

</script>

<template>
    <Head title="Дизайн" />

    <AdminLayout title="Дизайн">
        <p
            v-if="status"
            class="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
        >
            {{ status }}
        </p>

        <div class="mb-8 flex flex-wrap gap-2">
            <button
                v-for="tab in TABS"
                :key="tab.key"
                class="rounded-xl px-5 py-2 text-xs font-medium uppercase tracking-widest transition-colors"
                :class="activeTab === tab.key
                    ? 'bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500 text-obsidian-950'
                    : 'border border-white/10 text-white/50 hover:text-white'"
                @click="activeTab = tab.key"
            >
                {{ tab.label }}
            </button>
        </div>

        <!-- ================= БРЕНД ================= -->
        <form v-if="activeTab === 'brand'" v-glow class="glass-panel max-w-2xl p-6 sm:p-8" @submit.prevent="saveBrand">
            <h2 class="font-display mb-1 text-lg text-white">Бренд</h2>
            <p class="mb-6 text-sm text-white/40">Назва, логотип і фавікон — те, що видно у вкладці браузера й у шапці сайту.</p>

            <div class="space-y-5">
                <div>
                    <InputLabel for="siteName" value="Назва сайту" />
                    <TextInput id="siteName" v-model="brandForm.siteName" type="text" />
                    <InputError :message="brandForm.errors.siteName" />
                </div>

                <div>
                    <InputLabel for="siteTagline" value="Слоган" />
                    <TextInput id="siteTagline" v-model="brandForm.siteTagline" type="text" />
                    <InputError :message="brandForm.errors.siteTagline" />
                </div>

                <div class="grid gap-6 sm:grid-cols-2">
                    <div>
                        <InputLabel value="Логотип" />
                        <div class="mt-2 flex h-24 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                            <img v-if="logoPreview" :src="logoPreview" alt="Логотип" class="max-h-16 max-w-[80%] object-contain" />
                            <span v-else class="text-xs text-white/25">не завантажено</span>
                        </div>
                        <div class="mt-2 flex items-center gap-3">
                            <label class="cursor-pointer text-xs uppercase tracking-widest text-gold-300 hover:text-gold-200">
                                Обрати
                                <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="pickFile('logo', $event)" />
                            </label>
                            <button v-if="logoPreview" type="button" class="text-xs text-white/35 hover:text-ember-500" @click="dropAsset('logo')">
                                Прибрати
                            </button>
                        </div>
                        <InputError :message="brandForm.errors.logo" />
                    </div>

                    <div>
                        <InputLabel value="Фавікон" />
                        <div class="mt-2 flex h-24 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
                            <img v-if="faviconPreview" :src="faviconPreview" alt="Фавікон" class="h-10 w-10 object-contain" />
                            <span v-else class="text-xs text-white/25">не завантажено</span>
                        </div>
                        <div class="mt-2 flex items-center gap-3">
                            <label class="cursor-pointer text-xs uppercase tracking-widest text-gold-300 hover:text-gold-200">
                                Обрати
                                <input type="file" accept="image/png,image/webp,.ico" class="hidden" @change="pickFile('favicon', $event)" />
                            </label>
                            <button v-if="faviconPreview" type="button" class="text-xs text-white/35 hover:text-ember-500" @click="dropAsset('favicon')">
                                Прибрати
                            </button>
                        </div>
                        <InputError :message="brandForm.errors.favicon" />
                    </div>
                </div>

                <p class="text-xs leading-relaxed text-white/30">
                    PNG, JPG або WebP. Логотип — до 2 МБ, фавікон — до 512 КБ.
                    SVG не приймається навмисно: це виконуваний у браузері документ, а логотип
                    вставляється на кожну сторінку сайту.
                </p>
            </div>

            <div class="mt-7">
                <PrimaryButton :disabled="brandForm.processing">Зберегти</PrimaryButton>
            </div>
        </form>

        <!-- ================= ОФОРМЛЕННЯ ================= -->
        <form v-if="activeTab === 'theme'" v-glow class="glass-panel max-w-2xl p-6 sm:p-8" @submit.prevent="saveTheme">
            <h2 class="font-display mb-1 text-lg text-white">Оформлення</h2>
            <p class="mb-6 text-sm text-white/40">Акцентний колір і густина атмосфери застосовуються до всього сайту.</p>

            <div class="space-y-6">
                <div>
                    <InputLabel for="accent" value="Акцентний колір" />
                    <div class="mt-2 flex items-center gap-4">
                        <input
                            id="accent"
                            v-model="themeForm.accent"
                            type="color"
                            class="h-11 w-16 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                        />
                        <TextInput v-model="themeForm.accent" type="text" class="w-36 font-mono uppercase" />
                        <span class="text-xs text-white/30">за замовчуванням #D4AF37</span>
                    </div>
                    <InputError :message="themeForm.errors.accent" />
                </div>

                <div>
                    <InputLabel value="Атмосфера" />
                    <div class="mt-2 space-y-2">
                        <label
                            v-for="level in effectLevels"
                            :key="level"
                            class="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors"
                            :class="themeForm.effects === level
                                ? 'border-gold-400/40 bg-gold-500/10 text-white'
                                : 'border-white/10 text-white/50 hover:text-white'"
                        >
                            <input v-model="themeForm.effects" type="radio" :value="level" class="sr-only" />
                            {{ EFFECT_LABELS[level] }}
                        </label>
                    </div>
                    <InputError :message="themeForm.errors.effects" />
                </div>

                <div>
                    <InputLabel value="Сезонні прикраси" />
                    <p class="mb-2 mt-1 text-xs text-white/30">Легкий візуальний шар поверх сайту — знімається вручну, коли свято минуло.</p>
                    <div class="mt-2 grid gap-2 sm:grid-cols-2">
                        <label
                            v-for="th in seasonalThemes"
                            :key="th"
                            class="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors"
                            :class="themeForm.seasonalTheme === th
                                ? 'border-gold-400/40 bg-gold-500/10 text-white'
                                : 'border-white/10 text-white/50 hover:text-white'"
                        >
                            <input v-model="themeForm.seasonalTheme" type="radio" :value="th" class="sr-only" />
                            {{ SEASONAL_LABELS[th] || th }}
                        </label>
                    </div>
                    <InputError :message="themeForm.errors.seasonalTheme" />
                </div>
            </div>

            <div class="mt-7">
                <PrimaryButton :disabled="themeForm.processing">Зберегти</PrimaryButton>
            </div>
        </form>

        <!-- ================= СТРУКТУРА ================= -->
        <div v-if="activeTab === 'structure'" class="max-w-4xl">
            <div v-glow class="glass-panel p-6 sm:p-8">
                <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 class="font-display text-lg text-white">Структура керівництва</h2>
                        <p class="mt-1 text-sm text-white/40">
                            Розділ «Хто за що відповідає» на головній. Нік показується поруч із напрямком.
                        </p>
                    </div>
                    <button
                        type="button"
                        class="text-xs uppercase tracking-widest text-white/35 hover:text-ember-500"
                        @click="resetBlock('leadership', 'Структура керівництва')"
                    >
                        Скинути
                    </button>
                </div>

                <div class="space-y-4">
                    <div
                        v-for="(unit, i) in contentForm.leadership"
                        :key="i"
                        class="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                    >
                        <div class="grid gap-3 sm:grid-cols-2">
                            <div>
                                <InputLabel :for="`lead-title-${i}`" value="Напрямок" />
                                <TextInput :id="`lead-title-${i}`" v-model="unit.title" type="text" />
                            </div>
                            <div>
                                <InputLabel :for="`lead-nick-${i}`" value="Нік у грі" />
                                <TextInput :id="`lead-nick-${i}`" v-model="unit.nickname" type="text" placeholder="напр. Mark_Monsory" />
                            </div>
                        </div>
                        <div class="mt-3">
                            <InputLabel :for="`lead-text-${i}`" value="Опис" />
                            <textarea
                                :id="`lead-text-${i}`"
                                v-model="unit.text"
                                rows="2"
                                class="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:ring-0"
                            ></textarea>
                        </div>
                        <div class="mt-3 flex gap-4 text-xs text-white/30">
                            <button type="button" class="hover:text-white" @click="move('leadership', i, -1)">↑ вище</button>
                            <button type="button" class="hover:text-white" @click="move('leadership', i, 1)">↓ нижче</button>
                            <button type="button" class="ml-auto hover:text-ember-500" @click="removeRow('leadership', i)">Видалити</button>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    class="glass-pill mt-5 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/70 hover:text-white"
                    @click="addRow('leadership', { title: '', text: '', nickname: '' })"
                >
                    + Додати напрямок
                </button>

                <div class="mt-7 flex items-center gap-4">
                    <PrimaryButton :disabled="contentForm.processing" @click="saveContent">Зберегти</PrimaryButton>
                    <p class="text-xs text-white/30">Зміни одразу застосуються і на сайті, і в боті.</p>
                </div>
            </div>
        </div>

        <!-- ================= РОЗДІЛИ ================= -->
        <div v-if="activeTab === 'sections'" class="max-w-4xl space-y-6">
            <div v-glow class="glass-panel p-6 sm:p-8">
                <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 class="font-display text-lg text-white">Посади</h2>
                        <p class="mt-1 text-sm text-white/40">Порядок у списку = порядок росту. Перші пʼять — основний склад.</p>
                    </div>
                    <button type="button" class="text-xs uppercase tracking-widest text-white/35 hover:text-ember-500" @click="resetBlock('positions', 'Посади')">
                        Скинути
                    </button>
                </div>

                <div class="space-y-3">
                    <div v-for="(pos, i) in contentForm.positions" :key="i" class="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                        <div class="flex items-center gap-3">
                            <span class="font-mono text-xs text-gold-300/60">{{ String(i + 1).padStart(2, '0') }}</span>
                            <TextInput v-model="pos.title" type="text" class="flex-1" />
                        </div>
                        <textarea
                            v-model="pos.text"
                            rows="2"
                            class="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:ring-0"
                        ></textarea>
                        <div class="mt-2 flex items-center gap-4 text-xs text-white/30">
                            <span class="truncate font-mono">{{ pos.image || 'без зображення' }}</span>
                            <button type="button" class="ml-auto hover:text-white" @click="move('positions', i, -1)">↑</button>
                            <button type="button" class="hover:text-white" @click="move('positions', i, 1)">↓</button>
                            <button type="button" class="hover:text-ember-500" @click="removeRow('positions', i)">Видалити</button>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    class="glass-pill mt-4 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/70 hover:text-white"
                    @click="addRow('positions', { title: '', text: '', image: '' })"
                >
                    + Додати посаду
                </button>
            </div>

            <div v-glow class="glass-panel p-6 sm:p-8">
                <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <h2 class="font-display text-lg text-white">Критерії підвищення</h2>
                    <button type="button" class="text-xs uppercase tracking-widest text-white/35 hover:text-ember-500" @click="resetBlock('promotion_criteria', 'Критерії підвищення')">
                        Скинути
                    </button>
                </div>

                <div class="space-y-2">
                    <div v-for="(_, i) in contentForm.promotionCriteria" :key="i" class="flex items-center gap-3">
                        <TextInput v-model="contentForm.promotionCriteria[i]" type="text" class="flex-1" />
                        <button type="button" class="text-xs text-white/30 hover:text-ember-500" @click="removeRow('promotionCriteria', i)">✕</button>
                    </div>
                </div>

                <button
                    type="button"
                    class="glass-pill mt-4 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/70 hover:text-white"
                    @click="contentForm.promotionCriteria.push('')"
                >
                    + Додати критерій
                </button>
            </div>

            <div v-glow class="glass-panel p-6 sm:p-8">
                <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 class="font-display text-lg text-white">Про родину</h2>
                        <p class="mt-1 text-sm text-white/40">Абзаци, які бот показує в розділі «Про родину».</p>
                    </div>
                    <button type="button" class="text-xs uppercase tracking-widest text-white/35 hover:text-ember-500" @click="resetBlock('about', 'Про родину')">
                        Скинути
                    </button>
                </div>

                <div class="space-y-3">
                    <div v-for="(_, i) in contentForm.about" :key="i" class="flex items-start gap-3">
                        <textarea
                            v-model="contentForm.about[i]"
                            rows="3"
                            class="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:ring-0"
                        ></textarea>
                        <button type="button" class="mt-2 text-xs text-white/30 hover:text-ember-500" @click="removeRow('about', i)">✕</button>
                    </div>
                </div>

                <button
                    type="button"
                    class="glass-pill mt-4 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/70 hover:text-white"
                    @click="contentForm.about.push('')"
                >
                    + Додати абзац
                </button>
            </div>

            <div class="flex items-center gap-4">
                <PrimaryButton :disabled="contentForm.processing" @click="saveContent">Зберегти все</PrimaryButton>
                <p class="text-xs text-white/30">Зберігає посади, критерії та «Про родину» разом.</p>
            </div>
        </div>

        <!-- ================= КАРУСЕЛІ ================= -->
        <div v-if="activeTab === 'carousels'" class="max-w-3xl space-y-8">
            <div v-if="pendingAvatars.length > 0" v-glow class="glass-panel p-6 sm:p-8">
                <h2 class="font-display mb-1 text-lg text-white">Аватарки на перевірці</h2>
                <p class="mb-6 text-sm text-white/40">
                    Учасники самі завантажують фото профілю — доки ви не підтвердите, у карусель «Обличчя родини» воно не потрапляє.
                </p>

                <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    <div v-for="avatar in pendingAvatars" :key="avatar.id" class="overflow-hidden rounded-xl border border-white/10">
                        <img :src="avatar.url" :alt="avatar.name" class="aspect-square w-full object-cover" />
                        <p class="truncate bg-obsidian-950/80 px-2 py-1 text-[11px] text-white/60">{{ avatar.name }}</p>
                        <div class="flex gap-1 p-1.5">
                            <button
                                type="button"
                                class="flex-1 rounded-lg border border-emerald-400/30 py-1.5 text-[11px] text-emerald-300 hover:bg-emerald-400/10"
                                @click="approveAvatar(avatar)"
                            >
                                Підтвердити
                            </button>
                            <button
                                type="button"
                                class="flex-1 rounded-lg border border-ember-500/25 py-1.5 text-[11px] text-ember-500/80 hover:bg-ember-600/10"
                                @click="rejectAvatar(avatar)"
                            >
                                Відхилити
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div v-glow class="glass-panel p-6 sm:p-8">
                <h2 class="font-display mb-1 text-lg text-white">Каруселі на головній</h2>
                <p class="mb-6 text-sm text-white/40">
                    Кожну можна вимкнути окремо. Порожня карусель (нема фото) і так не показується, незалежно від тумблера.
                </p>

                <div class="space-y-4">
                    <label class="flex cursor-pointer items-start gap-3">
                        <input type="checkbox" v-model="carouselsForm.showMembers" class="mt-1 h-4 w-4 rounded border-white/20 bg-obsidian-900 text-gold-400 focus:ring-gold-400/40" />
                        <span>
                            <span class="block text-sm text-white">«Обличчя родини» — фото учасників</span>
                            <span class="block text-xs text-white/40">Показує тих, хто сам додав фото у своєму профілі.</span>
                        </span>
                    </label>
                    <label class="flex cursor-pointer items-start gap-3">
                        <input type="checkbox" v-model="carouselsForm.showGallery" class="mt-1 h-4 w-4 rounded border-white/20 bg-obsidian-900 text-gold-400 focus:ring-gold-400/40" />
                        <span>
                            <span class="block text-sm text-white">«Галерея родини» — знімки подій</span>
                            <span class="block text-xs text-white/40">Фото з розділу нижче, вантажені тут, в адмінці.</span>
                        </span>
                    </label>
                </div>

                <PrimaryButton class="mt-6" :disabled="carouselsForm.processing" @click="saveCarousels">Зберегти</PrimaryButton>
            </div>

            <div v-glow class="glass-panel p-6 sm:p-8">
                <h2 class="font-display mb-1 text-lg text-white">Галерея родини</h2>
                <p class="mb-6 text-sm text-white/40">Знімки подій, боїв, зустрічей — потрапляють у карусель «Галерея родини» на головній.</p>

                <form class="mb-6 flex flex-wrap items-end gap-3" @submit.prevent="uploadGalleryPhoto">
                    <div class="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                        <img v-if="galleryPreview" :src="galleryPreview" alt="" class="h-full w-full object-cover" />
                        <span v-else class="text-[10px] text-white/25">прев'ю</span>
                    </div>
                    <div>
                        <label class="cursor-pointer text-xs uppercase tracking-widest text-gold-300 hover:text-gold-200">
                            Обрати фото
                            <input ref="galleryInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="pickGalleryPhoto" />
                        </label>
                        <InputError :message="galleryForm.errors.photo" />
                    </div>
                    <div class="min-w-[200px] flex-1">
                        <TextInput v-model="galleryForm.caption" type="text" placeholder="Підпис (необов'язково)" />
                    </div>
                    <button
                        type="submit"
                        :disabled="galleryForm.processing || !galleryForm.photo"
                        class="rounded-xl border border-gold-400/40 px-5 py-2 text-xs font-medium tracking-widest text-gold-200 hover:border-gold-300 disabled:opacity-40"
                    >
                        Додати
                    </button>
                </form>

                <div v-if="gallery.length > 0" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    <div v-for="(photo, i) in gallery" :key="photo.id" class="group relative overflow-hidden rounded-xl border border-white/10">
                        <img :src="photo.url" :alt="photo.caption || ''" class="aspect-[4/3] w-full object-cover" />
                        <input
                            :value="photo.caption || ''"
                            type="text"
                            placeholder="Підпис..."
                            class="w-full bg-obsidian-950/80 px-2 py-1 text-[11px] text-white/60 placeholder:text-white/25 focus:outline-none"
                            @change="saveGalleryCaption(photo, $event.target.value)"
                        />
                        <div class="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                                type="button"
                                class="rounded-full bg-obsidian-950/80 p-1.5 text-white/60 hover:text-white disabled:opacity-30"
                                title="Пересунути ліворуч"
                                :disabled="i === 0"
                                @click="moveGalleryPhoto(i, -1)"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M15 18l-6-6 6-6"/></svg>
                            </button>
                            <button
                                type="button"
                                class="rounded-full bg-obsidian-950/80 p-1.5 text-white/60 hover:text-white disabled:opacity-30"
                                title="Пересунути праворуч"
                                :disabled="i === gallery.length - 1"
                                @click="moveGalleryPhoto(i, 1)"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M9 18l6-6-6-6"/></svg>
                            </button>
                            <button
                                type="button"
                                class="rounded-full bg-obsidian-950/80 p-1.5 text-white/60 hover:text-ember-500"
                                title="Видалити"
                                @click="removeGalleryPhoto(photo)"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
                <p v-else class="text-sm text-white/30">Ще немає жодного фото.</p>
            </div>
        </div>

        <!-- ================= СОЦМЕРЕЖІ ================= -->
        <div v-if="activeTab === 'social'" class="max-w-2xl">
            <div v-glow class="glass-panel p-6 sm:p-8">
                <h2 class="font-display mb-1 text-lg text-white">Соцмережі у футері</h2>
                <p class="mb-6 text-sm text-white/40">Іконки-посилання внизу головної сторінки. Порядок рядків тут — порядок іконок на сайті.</p>

                <div class="space-y-3">
                    <div v-for="(link, i) in socialForm.links" :key="i" class="flex flex-wrap items-start gap-3">
                        <select
                            v-model="link.platform"
                            class="rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white focus:border-gold-400/50 focus:outline-none"
                        >
                            <option v-for="p in socialPlatforms" :key="p" :value="p">{{ PLATFORM_LABELS[p] || p }}</option>
                        </select>
                        <div class="min-w-[220px] flex-1">
                            <input
                                v-model="link.url"
                                type="url"
                                placeholder="https://..."
                                class="w-full rounded-lg border border-white/10 bg-obsidian-900 px-3 py-2 text-sm text-white placeholder:text-white/30"
                            />
                            <InputError :message="socialForm.errors[`links.${i}.url`]" />
                        </div>
                        <button
                            type="button"
                            class="mt-1 shrink-0 text-white/30 hover:text-ember-500"
                            title="Видалити"
                            @click="removeSocialLink(i)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                    </div>
                    <p v-if="socialForm.links.length === 0" class="text-sm text-white/30">Ще немає жодного посилання.</p>
                </div>

                <button
                    type="button"
                    class="glass-pill mt-4 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/70 hover:text-white"
                    @click="addSocialLink"
                >
                    + Додати посилання
                </button>

                <div class="mt-6 flex items-center gap-4">
                    <PrimaryButton :disabled="socialForm.processing" @click="saveSocialLinks">Зберегти</PrimaryButton>
                    <p v-if="socialForm.recentlySuccessful" class="text-sm text-emerald-300">Збережено.</p>
                </div>
            </div>
        </div>
    </AdminLayout>
</template>
