<script setup>
import InputError from '@/Components/InputError.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import { useForm, usePage } from '@inertiajs/vue3';
import { ref } from 'vue';

const user = usePage().props.auth.user;

const form = useForm({ avatar: null, remove: false });
const preview = ref(user.avatar_url ?? null);
const fileInput = ref(null);

function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    form.avatar = file;
    preview.value = URL.createObjectURL(file);
}

function submit() {
    form.remove = false;
    form.post(route('profile.avatar'), {
        forceFormData: true,
        preserveScroll: true,
        onSuccess: () => { form.avatar = null; },
    });
}

function removeAvatar() {
    if (!confirm('Видалити фото профілю?')) return;
    form.avatar = null;
    form.remove = true;
    form.post(route('profile.avatar'), {
        forceFormData: true,
        preserveScroll: true,
        onSuccess: () => { preview.value = null; },
    });
}
</script>

<template>
    <section>
        <header>
            <h2 class="font-display text-lg font-normal text-white">
                Фото профілю
            </h2>

            <p class="mt-1 text-sm text-white/40">
                За бажанням — якщо додасте, потрапите в карусель «Обличчя родини» на головній (якщо адмін її не вимкнув).
            </p>
            <p v-if="user.avatar_path && !user.avatar_approved" class="mt-2 text-xs text-gold-300/70">
                Фото на перевірці в адміна — в каруселі з'явиться після підтвердження.
            </p>
        </header>

        <form @submit.prevent="submit" class="mt-6 space-y-6">
            <div class="flex items-center gap-5">
                <div class="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-white/10 bg-obsidian-900/60">
                    <img v-if="preview" :src="preview" alt="Фото профілю" class="h-full w-full object-cover" />
                    <div v-else class="flex h-full w-full items-center justify-center text-2xl text-white/20">?</div>
                </div>

                <div class="flex flex-wrap gap-3">
                    <button
                        type="button"
                        class="rounded-xl border border-white/15 px-4 py-2 text-xs text-white/60 hover:border-white/30"
                        @click="fileInput?.click()"
                    >
                        Вибрати фото
                    </button>
                    <button
                        v-if="preview"
                        type="button"
                        class="rounded-xl border border-ember-500/25 px-4 py-2 text-xs text-ember-500/80 hover:bg-ember-600/10"
                        @click="removeAvatar"
                    >
                        Видалити
                    </button>
                </div>
                <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="onPick" />
            </div>

            <InputError :message="form.errors.avatar" />

            <div class="flex items-center gap-4">
                <PrimaryButton :disabled="form.processing || !form.avatar">Зберегти</PrimaryButton>

                <Transition
                    enter-active-class="transition ease-in-out"
                    enter-from-class="opacity-0"
                    leave-active-class="transition ease-in-out"
                    leave-to-class="opacity-0"
                >
                    <p v-if="form.recentlySuccessful" class="text-sm text-white/50">Збережено.</p>
                </Transition>
            </div>
        </form>
    </section>
</template>
