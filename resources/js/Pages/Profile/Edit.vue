<script setup>
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import DeleteUserForm from './Partials/DeleteUserForm.vue';
import UpdatePasswordForm from './Partials/UpdatePasswordForm.vue';
import UpdateBirthdayForm from './Partials/UpdateBirthdayForm.vue';
import UpdateGenderForm from './Partials/UpdateGenderForm.vue';
import UpdateAvatarForm from './Partials/UpdateAvatarForm.vue';
import UpdatePositionForm from './Partials/UpdatePositionForm.vue';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm.vue';
import TwoFactorAuthenticationForm from './Partials/TwoFactorAuthenticationForm.vue';
import PushNotificationsForm from './Partials/PushNotificationsForm.vue';
import LogOutOtherSessionsForm from './Partials/LogOutOtherSessionsForm.vue';
import { Head } from '@inertiajs/vue3';

defineProps({
    mustVerifyEmail: {
        type: Boolean,
    },
    status: {
        type: String,
    },
    positions: {
        type: Array,
        default: () => [],
    },
    otherActiveSessions: {
        type: Number,
        default: 0,
    },
});

</script>

<template>
    <Head title="Профіль" />

    <AuthenticatedLayout>
        <template #header>
            <h2 class="font-display text-2xl font-light text-white">
                Профіль
            </h2>
        </template>

        <div class="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
            <div v-reveal v-glow class="glass-panel p-6 sm:p-8">
                <UpdateProfileInformationForm
                    :must-verify-email="mustVerifyEmail"
                    :status="status"
                    class="max-w-xl"
                />
            </div>

            <div v-reveal:125 v-glow class="glass-panel p-6 sm:p-8">
                <UpdateAvatarForm class="max-w-xl" />
            </div>

            <div v-reveal:140 v-glow class="glass-panel p-6 sm:p-8">
                <PushNotificationsForm class="max-w-xl" />
            </div>

            <div v-reveal:150 v-glow class="glass-panel p-6 sm:p-8">
                <UpdatePositionForm :positions="positions" class="max-w-xl" />
            </div>

            <div v-reveal:200 v-glow class="glass-panel p-6 sm:p-8">
                <UpdateBirthdayForm class="max-w-xl" />
            </div>

            <div v-reveal:225 v-glow class="glass-panel p-6 sm:p-8">
                <UpdateGenderForm class="max-w-xl" />
            </div>

            <div v-reveal:250 v-glow class="glass-panel p-6 sm:p-8">
                <UpdatePasswordForm class="max-w-xl" />
            </div>

            <div v-reveal:275 v-glow class="glass-panel p-6 sm:p-8">
                <TwoFactorAuthenticationForm class="max-w-xl" />
            </div>

            <div v-if="otherActiveSessions > 0" v-reveal:290 v-glow class="glass-panel p-6 sm:p-8">
                <LogOutOtherSessionsForm :other-active-sessions="otherActiveSessions" class="max-w-xl" />
            </div>

            <div v-reveal:300 v-glow class="glass-panel p-6 sm:p-8">
                <DeleteUserForm class="max-w-xl" />
            </div>
        </div>
    </AuthenticatedLayout>
</template>
