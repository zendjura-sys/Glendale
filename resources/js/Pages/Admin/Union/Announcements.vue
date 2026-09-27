<script setup>
import AdminLayout from '@/Layouts/AdminLayout.vue';
import InputLabel from '@/Components/InputLabel.vue';
import TextInput from '@/Components/TextInput.vue';
import InputError from '@/Components/InputError.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import { Head, router, useForm, usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import { toDateInputValue } from '@/lib/date';

defineProps({
    announcements: { type: Object, required: true },
});

const status = computed(() => usePage().props.flash?.status);

const form = useForm({ title: '', body: '', published_at: '' });

function submit() {
    form.post(route('admin.union.announcements.store'), {
        preserveScroll: true,
        onSuccess: () => form.reset('title', 'body', 'published_at'),
    });
}

const editingId = ref(null);
const editForm = useForm({ title: '', body: '', published_at: '' });

function startEdit(a) {
    editingId.value = a.id;
    editForm.title = a.title;
    editForm.body = a.body;
    editForm.published_at = toDateInputValue(a.published_at);
}

function saveEdit(a) {
    editForm.put(route('admin.union.announcements.update', a.id), {
        preserveScroll: true,
        onSuccess: () => { editingId.value = null; },
    });
}

function destroy(a) {
    if (!confirm(`Видалити оголошення «${a.title}»?`)) return;
    router.delete(route('admin.union.announcements.destroy', a.id), { preserveScroll: true });
}

function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<template>
    <Head title="Оголошення союзу" />

    <AdminLayout title="Оголошення союзу">
        <p
            v-if="status"
            class="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
        >
            {{ status }}
        </p>

        <div class="max-w-3xl space-y-8">
            <div v-glow class="glass-panel p-6 sm:p-8">
                <h2 class="font-display mb-4 text-lg text-white">Нове оголошення</h2>
                <form class="space-y-4" @submit.prevent="submit">
                    <div>
                        <InputLabel for="title" value="Заголовок" />
                        <TextInput id="title" v-model="form.title" type="text" class="w-full" />
                        <InputError :message="form.errors.title" />
                    </div>
                    <div>
                        <InputLabel for="body" value="Текст" />
                        <textarea
                            id="body"
                            v-model="form.body"
                            rows="4"
                            class="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:ring-0"
                        ></textarea>
                        <InputError :message="form.errors.body" />
                    </div>
                    <div class="max-w-xs">
                        <InputLabel for="published_at" value="Дата публікації (необов'язково)" />
                        <input id="published_at" v-model="form.published_at" type="date" class="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:ring-0" />
                        <InputError :message="form.errors.published_at" />
                    </div>
                    <PrimaryButton :disabled="form.processing">Опублікувати</PrimaryButton>
                </form>
            </div>

            <div v-glow class="glass-panel overflow-hidden">
                <h2 class="p-6 pb-4 font-display text-lg text-white">Оголошення</h2>
                <div v-for="a in announcements.data" :key="a.id" class="border-b border-white/5 px-6 py-4 last:border-0">
                    <div v-if="editingId === a.id" class="space-y-3">
                        <TextInput v-model="editForm.title" type="text" class="w-full" />
                        <textarea v-model="editForm.body" rows="3" class="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:ring-0"></textarea>
                        <input v-model="editForm.published_at" type="date" class="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white focus:border-gold-400/40 focus:ring-0" />
                        <div class="flex gap-3">
                            <button type="button" class="rounded-full border border-gold-400/40 px-4 py-1.5 text-xs text-gold-200 hover:border-gold-300" @click="saveEdit(a)">Зберегти</button>
                            <button type="button" class="text-xs text-white/40 hover:text-white" @click="editingId = null">Скасувати</button>
                        </div>
                    </div>
                    <div v-else class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-[11px] uppercase tracking-widest text-gold-300/60">{{ fmtDate(a.published_at) }}</p>
                            <p class="mt-1 font-medium text-white">{{ a.title }}</p>
                            <p class="mt-1 whitespace-pre-line text-sm text-white/50">{{ a.body }}</p>
                            <p v-if="a.author" class="mt-2 text-xs text-white/30">Автор: {{ a.author.name }}</p>
                        </div>
                        <div class="flex shrink-0 gap-3 text-xs">
                            <button class="text-white/40 hover:text-white" @click="startEdit(a)">Редагувати</button>
                            <button class="text-ember-500/70 hover:text-ember-500" @click="destroy(a)">Видалити</button>
                        </div>
                    </div>
                </div>
                <div v-if="announcements.data.length === 0" class="px-6 py-12 text-center text-white/30">Оголошень ще немає</div>
            </div>
        </div>
    </AdminLayout>
</template>
