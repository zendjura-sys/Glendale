<script setup>
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import MemberCard from '@/Components/MemberCard.vue';
import { Head, Link } from '@inertiajs/vue3';

defineProps({
    memberCount: { type: Number, default: 0 },
    bankCard: { type: Object, default: null },
    mobileAppDownloadUrl: { type: String, default: null },
});

// «Мої звіти» винесено окремо з масиву — банківську картку показуємо
// одразу під ним, до решти плиток. Банк тепер має власний віджет
// замість звичайної текстової плитки в цій сітці.
const firstCard = { name: 'reports.index', title: 'Мої звіти', text: 'Подайте звіт за бізваром чи контрактом та слідкуйте за статусом розгляду.' };
const cards = [
    { name: 'progression.index', title: 'Мій прогрес', text: 'Досвід, рівень, досягнення та історія нарахувань.' },
    { name: 'progression.leaderboard', title: 'Рейтинг родини', text: 'Хто попереду — за активністю, бізваром, контрактами, серією перемог чи преміями.' },
    { name: 'member-center.index', title: 'Кадровий центр', text: 'Ваш статус у родині та заявки на відпустку.' },
    { name: 'family-goals.index', title: 'Цілі родини', text: 'Спільні цілі з прогресом та стрічка активності.' },
    { name: 'family-events.index', title: 'Події родини', text: 'Найближчі зустрічі, вечірки та івенти.' },
    { name: 'notifications.index', title: 'Сповіщення', text: 'Оголошення від адміністрації та особисті сповіщення.' },
];

function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
}
</script>

<template>
    <Head title="Кабінет" />

    <AuthenticatedLayout>
        <template #header>
            <h2 class="font-display text-2xl font-light text-white">
                Кабінет
            </h2>
        </template>

        <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div v-reveal class="mb-8">
                <p class="text-white/50">
                    Вітаємо, <span class="text-gold-300">{{ $page.props.auth.user.name }}</span> — це ваш особистий кабінет GameConnect.
                </p>
            </div>

            <!-- ================= ОБЛІКОВИЙ ЗАПИС ================= -->
            <div v-reveal v-glow class="glass-panel mb-8 grid gap-6 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4">
                <div>
                    <p class="text-xs uppercase tracking-widest text-white/40">Ім'я</p>
                    <p class="mt-1 font-medium text-white">{{ $page.props.auth.user.name }}</p>
                </div>
                <div>
                    <p class="text-xs uppercase tracking-widest text-white/40">Посада</p>
                    <p class="mt-1 font-medium text-white">
                        <span v-if="$page.props.auth.user.position_title" class="text-gold-300">{{ $page.props.auth.user.position_title }}</span>
                        <span v-else class="text-white/30">не призначено</span>
                    </p>
                </div>
                <div>
                    <p class="text-xs uppercase tracking-widest text-white/40">Пошта</p>
                    <!-- flex-wrap обов'язковий: у 4-колонковій розкладці
                         клітинка вужча, і без переносу бейдж
                         "Підтверджено" наїжджав на сусідню колонку
                         замість того, щоб піти на новий рядок. -->
                    <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-white">
                        <span class="break-all">{{ $page.props.auth.user.email }}</span>
                        <span
                            v-if="$page.props.auth.user.email_verified_at"
                            class="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300"
                        >Підтверджено</span>
                        <span
                            v-else
                            class="rounded-full border border-gold-400/30 bg-gold-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gold-300"
                        >Не підтверджено</span>
                    </p>
                </div>
                <div>
                    <p class="text-xs uppercase tracking-widest text-white/40">У родині з</p>
                    <p class="mt-1 font-medium text-white">{{ fmtDate($page.props.auth.user.created_at) }}</p>
                </div>
                <div class="sm:col-span-2 lg:col-span-4">
                    <Link :href="route('profile.edit')" class="text-xs uppercase tracking-widest text-gold-300/80 hover:text-gold-200">
                        Редагувати профіль →
                    </Link>
                </div>
            </div>

            <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Link
                    v-if="route().has(firstCard.name)"
                    :href="route(firstCard.name)"
                    v-reveal="'scale'"
                    v-glow class="group glass-panel relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-gold"
                >
                    <div class="glass-sheen"></div>
                    <h3 class="relative font-semibold text-white">{{ firstCard.title }}</h3>
                    <p class="relative mt-2 text-sm leading-relaxed text-white/50">{{ firstCard.text }}</p>
                    <span class="relative mt-4 inline-block text-xs uppercase tracking-widest text-gold-300/80">Відкрити →</span>
                </Link>

                <!-- ================= БАНК ================= -->
                <div v-if="bankCard" v-reveal="'scale'" :style="{ transitionDelay: '80ms' }" class="flex flex-col items-center">
                    <MemberCard :number="bankCard.number" :number-full="bankCard.numberFull" :name="bankCard.name" :amount="bankCard.balance" />
                    <Link v-if="route().has('bonuses.index')" :href="route('bonuses.index')" class="mt-3 text-xs uppercase tracking-widest text-gold-300/80 hover:text-gold-200">
                        Відкрити банк →
                    </Link>
                </div>

                <template v-for="(card, i) in cards" :key="card.name">
                    <Link
                        v-if="route().has(card.name)"
                        :href="route(card.name)"
                        v-reveal="'scale'"
                        :style="{ transitionDelay: `${(i + 2) * 80}ms` }"
                        v-glow class="group glass-panel relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-gold"
                    >
                        <div class="glass-sheen"></div>
                        <h3 class="relative font-semibold text-white">{{ card.title }}</h3>
                        <p class="relative mt-2 text-sm leading-relaxed text-white/50">{{ card.text }}</p>
                        <span class="relative mt-4 inline-block text-xs uppercase tracking-widest text-gold-300/80">Відкрити →</span>
                    </Link>
                </template>

                <Link
                    v-if="route().has('admin.dashboard') && (
                        $page.props.can?.manageAddons || $page.props.can?.manageReports ||
                        $page.props.can?.manageProgression || $page.props.can?.manageSettings ||
                        $page.props.can?.manageRoles || $page.props.can?.manageUsers || $page.props.can?.manageMembers || $page.props.can?.manageGoals || $page.props.can?.manageBroadcasts || $page.props.can?.manageEvents
                    )"
                    :href="route('admin.dashboard')"
                    v-reveal:240="'scale'"
                    v-glow class="group glass-panel-gold glass-panel relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-gold"
                >
                    <div class="glass-sheen"></div>
                    <h3 class="relative font-semibold text-white">Адмін-панель CMS</h3>
                    <p class="relative mt-2 text-sm leading-relaxed text-white/60">Аддони, права доступу, учасники, Discord — керування всім сайтом.</p>
                    <span class="relative mt-4 inline-block text-xs uppercase tracking-widest text-gold-300">Відкрити →</span>
                </Link>

                <!-- Посилання (Admin → Налаштування → Мобільний застосунок)
                     з'являється лише коли деплой-скрипт уже забрав свіжий
                     .apk на сервер — без нього кнопка пропонувала б
                     завантажити те, чого ще немає. -->
                <a
                    v-if="mobileAppDownloadUrl"
                    :href="mobileAppDownloadUrl"
                    v-reveal:400="'scale'"
                    v-glow class="group glass-panel relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-gold"
                >
                    <div class="glass-sheen"></div>
                    <h3 class="relative font-semibold text-white">Застосунок для Android</h3>
                    <p class="relative mt-2 text-sm leading-relaxed text-white/50">Банк, рейтинг і кабінет родини — у застосунку на телефоні.</p>
                    <span class="relative mt-4 inline-block text-xs uppercase tracking-widest text-gold-300/80">Завантажити .apk →</span>
                </a>
            </div>

            <!-- ================= МАСШТАБ РОДИНИ ================= -->
            <div v-reveal v-glow class="glass-panel mt-8 inline-flex items-baseline gap-3 p-6">
                <span class="font-display text-3xl text-gold-300">{{ memberCount }}</span>
                <span class="text-xs uppercase tracking-widest text-white/40">учасників на сайті</span>
            </div>
        </div>
    </AuthenticatedLayout>
</template>
