<script setup>
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import ApplicationLogo from '@/Components/ApplicationLogo.vue';
import AmbientBackground from '@/Components/AmbientBackground.vue';
import ScrollProgress from '@/Components/ScrollProgress.vue';
import PhotoCarousel from '@/Components/PhotoCarousel.vue';
import SocialIcon from '@/Components/SocialIcon.vue';
import StatsBarChart from '@/Components/StatsBarChart.vue';

const props = defineProps({
    canLogin: { type: Boolean, default: false },
    canRegister: { type: Boolean, default: false },
    memberCount: { type: Number, default: 0 },
    stats: { type: Array, default: () => [] },
    // Содержание приходит из config/family.php — единый источник для сайта
    // и бота в Telegram. Здесь остаётся только отображение.
    positions: { type: Array, default: () => [] },
    baseCount: { type: Number, default: 5 },
    directions: { type: Array, default: () => [] },
    promotionCriteria: { type: Array, default: () => [] },
    leadership: { type: Array, default: () => [] },
    memberPhotos: { type: Array, default: () => [] },
    galleryPhotos: { type: Array, default: () => [] },
    socialLinks: { type: Array, default: () => [] },
    siteName: { type: String, default: 'GameConnect' },
});

const SOCIAL_LABELS = {
    telegram: 'Telegram',
    discord: 'Discord',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    instagram: 'Instagram',
    twitter: 'X (Twitter)',
    vk: 'VK',
    website: 'Посилання',
};

/* ---------- куди веде «Подати заявку» ----------
   Поки бот не заведений у налаштуваннях, кнопка веде на звичайну реєстрацію
   на сайті: заявку все одно можна залишити, просто іншим шляхом. Раніше в
   цьому випадку підставлявся href="#", і головний заклик лендінгу мовчки
   нічого не робив. target="_blank" ставимо тільки для зовнішнього посилання —
   внутрішню сторінку відкривати в новій вкладці немає сенсу. */
/* ---------- контент родини ----------
   Перші baseCount посад — основний склад, решта — напрямки й керівництво.
   На сайті вони рознесені у два блоки саме по цій межі. */
const basePositions = computed(() => props.positions.slice(0, props.baseCount));
const topPositions = computed(() => props.positions.slice(props.baseCount));
const directions = computed(() => props.directions);
const leadership = computed(() => props.leadership);
const promotionCriteria = computed(() => props.promotionCriteria);

const applyUrl = computed(() => route('register'));
const applyExternal = computed(() => false);

function fmtStat(v) {
    return new Intl.NumberFormat('uk-UA').format(v ?? 0);
}

/* ---------- шапка: прозора -> скляна під час скролу ---------- */
const scrolled = ref(false);
function onScroll() {
    scrolled.value = window.scrollY > 24;
}

/* ---------- мобільне меню ----------
   Десктопна навігація ховається вже з планшета, тому без цього меню на
   телефоні й планшеті сторінка лишалась зовсім без навігації — тільки скрол. */
const mobileNavOpen = ref(false);

function setMobileNav(open) {
    mobileNavOpen.value = open;
    // Фон не має скролитись під відкритим оверлеєм — інакше при закритті
    // користувач опиняється зовсім не там, де відкривав меню. Знімати
    // блокування треба в КОЖНОМУ шляху закриття, тому це одна функція,
    // а не дві окремі, де легко забути про overflow.
    document.body.style.overflow = open ? 'hidden' : '';
}

function closeMobileNav() {
    setMobileNav(false);
}

function toggleMobileNav() {
    setMobileNav(!mobileNavOpen.value);
}

/* ---------- підсвічування активного пункту навігації ----------
   Без цього довга сторінка "губить" читача: він не розуміє, у якому розділі
   зараз перебуває. Спостерігаємо самі секції, а не рахуємо offset вручну —
   ресайз і зміна висоти контенту не ламають логіку. */
const activeSection = ref('');
let sectionObserver;

const navLinks = [
    { id: 'family', label: 'Родина' },
    { id: 'roles', label: 'Напрямки' },
    { id: 'positions', label: 'Посади' },
    { id: 'structure', label: 'Структура' },
    { id: 'legacy', label: 'Спадщина' },
];

/* ---------- лічильник учасників — рахує один раз, коли з'являється у в'юпорті ---------- */
const memberCountEl = ref(null);
const memberCountValue = ref(0);
let countAnimated = false;
let countObserver;

function animateMemberCount() {
    if (countAnimated) return;
    countAnimated = true;
    const target = props.memberCount;
    const duration = 1600;
    const start = performance.now();
    function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        memberCountValue.value = Math.floor(eased * target);
        if (progress < 1) requestAnimationFrame(tick);
        else memberCountValue.value = target;
    }
    requestAnimationFrame(tick);
}

onMounted(() => {
    window.addEventListener('scroll', onScroll, { passive: true });

    countObserver = new IntersectionObserver(
        (entries) => entries.forEach((e) => e.isIntersecting && animateMemberCount()),
        { threshold: 0.4 },
    );
    if (memberCountEl.value) countObserver.observe(memberCountEl.value);

    sectionObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) activeSection.value = e.target.id;
            });
        },
        // Вузька смуга по центру екрана: секція вважається активною лише коли
        // вона реально в фокусі погляду, а не щойно торкнулась краю вьюпорта.
        { rootMargin: '-45% 0px -45% 0px' },
    );
    navLinks.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (el) sectionObserver.observe(el);
    });
});

onUnmounted(() => {
    window.removeEventListener('scroll', onScroll);
    countObserver?.disconnect();
    sectionObserver?.disconnect();
    // Інакше сторінка, залишена з відкритим меню, «замерзає» без скролу
    // після переходу в кабінет.
    document.body.style.overflow = '';
});

const year = computed(() => new Date().getFullYear());

// Те, що учасник реально отримує, вступивши в родину. Формулювання —
// конкретні речі (склад, рація, завдання), а не абстракції на кшталт
// «дружня атмосфера»: саме за конкретикою людина й обирає, куди вступати.
const benefits = [
    {
        title: 'Спільне майно',
        text: 'Особняк, автопарк і склад родини — у спільному користуванні. Не треба місяцями збирати на першу машину: усе потрібне для роботи видає склад.',
    },
    {
        title: 'Свій звʼязок',
        text: 'Сімейний чат і рація для координації. Питання вирішується за секунди, а не пошуком потрібної людини по всьому серверу.',
    },
    {
        title: 'Спільні заходи',
        text: 'Захоплення територій, бізнес, поставки та операції. Поруч є й спокійніші легальні напрямки — кожен сам обирає, у чому бере участь.',
    },
    {
        title: 'Бонуси і прокачка',
        text: 'Сімейні завдання та покращення, які дають пасивний дохід і підсилюють характеристики персонажа.',
    },
    {
        title: 'Своя історія',
        text: 'Традиції, дрес-код і кодекс родини. Ми граємо роль і будуємо власну історію, а не просто набиваємо статистику.',
    },
    {
        title: 'Підтримка новачків',
        text: 'Старші діляться грошима й транспортом, пояснюють правила сервера і прикривають від тих, хто вирішив, що новачок — легка ціль.',
    },
];

// Тут навмисно названа сама РОБОТА, а не посади: посади Юрист і Охорона
// показані нижче, у вертикалі з десяти. Інакше вони зустрічалися б на
// сторінці двічі й читались як дві різні системи.

// Перші пʼять посад — шлях новачка. Саме вони цікавлять того, хто тільки
// думає вступати, тому показані великими картками з персонажами.

// Посади 6–10. Оформлені так само, як і перші пʼять: вертикаль має
// читатися як один суцільний шлях, а не як «ті, що з фото» і «решта».

// Те, на що дивляться при підвищенні. Свідомо без «відпрацюй N днів» —
// у родині немає строку, після якого посада видається автоматично.

// Структура подана за функціями, без ігрових ніків: сайт публічний, а
// персональний склад керівництва — це вже внутрішня інформація родини.
</script>

<template>
    <Head :title="`${siteName} — родини та спільноти`" />

    <!-- Умышленно БЕЗ bg-obsidian-950: непрозрачный фон на этой обёртке
         закрашивал собой все слои с отрицательным z-index — фото героя,
         кинематографические фоны секций и аврора-подсветку. Цвет страницы
         задан на body в app.css, поэтому здесь он не нужен. -->
    <div class="relative font-sans text-white/80 antialiased">
        <ScrollProgress />
        <AmbientBackground mobile intensity="rich" />

        <!-- ================= NAV ================= -->
        <header
            class="fixed inset-x-0 top-0 z-50 transition-all duration-700"
            :class="scrolled ? 'py-3' : 'py-6'"
        >
            <div class="mx-auto max-w-7xl px-4 sm:px-6">
                <div
                    class="flex items-center justify-between rounded-xl px-5 py-3 transition-all duration-700 sm:px-6"
                    :class="scrolled ? 'glass-pill' : ''"
                >
                    <!-- На вузьких телефонах (360px) повний лого + кнопка
                         входу + бургер не вміщались в один рядок: напис
                         "УВІЙТИ" ламався на два рядки. Тому тут і трекінг,
                         і розмір, і другий рядок лого — адаптивні. -->
                    <a href="#top" class="flex min-w-0 items-center gap-2.5 sm:gap-3">
                        <ApplicationLogo mark class="h-8 w-8 shrink-0 text-base sm:h-9 sm:w-9 sm:text-lg" />
                        <div class="min-w-0 leading-tight">
                            <div class="font-display text-base tracking-[0.18em] text-white sm:text-lg sm:tracking-[0.28em]">MONSORY</div>
                            <div class="hidden text-[10px] tracking-[0.38em] text-gold-300/70 xs:block">CONNECT</div>
                        </div>
                    </a>

                    <!-- На планшеті (md) лишаємо скорочену навігацію, на ноуті
                         й ПК — повну: ховати все до 1024px означало б віддати
                         половині пристроїв найгірший варіант без потреби. -->
                    <nav class="hidden items-center gap-7 text-[13px] tracking-wide text-white/55 md:flex lg:gap-9">
                        <a
                            v-for="(link, i) in navLinks"
                            :key="link.id"
                            :href="`#${link.id}`"
                            class="link-underline py-1 transition-colors duration-300 hover:text-white"
                            :class="[
                                activeSection === link.id && 'text-white',
                                i > 2 && 'hidden lg:inline',
                            ]"
                            :data-active="activeSection === link.id"
                        >
                            {{ link.label }}
                        </a>
                    </nav>

                    <div class="flex items-center gap-2 sm:gap-3">
                        <Link
                            v-if="$page.props.auth?.user"
                            :href="route('dashboard')"
                            class="glass-pill btn-ghost whitespace-nowrap px-3.5 py-2 text-[10px] font-medium tracking-[0.15em] text-white/80 xs:text-[11px] xs:tracking-[0.2em] sm:px-5"
                        >
                            КАБІНЕТ
                        </Link>
                        <Link
                            v-else-if="canLogin"
                            :href="route('login')"
                            class="glass-pill btn-ghost whitespace-nowrap px-3.5 py-2 text-[10px] font-medium tracking-[0.15em] text-gold-200 xs:text-[11px] xs:tracking-[0.2em] sm:px-5"
                        >
                            УВІЙТИ ↗
                        </Link>

                        <button
                            class="glass-pill flex h-9 w-9 items-center justify-center text-white/70 transition-colors hover:text-white md:hidden"
                            :aria-expanded="mobileNavOpen"
                            aria-label="Меню"
                            @click="toggleMobileNav"
                        >
                            <span class="relative block h-3 w-4">
                                <span
                                    class="absolute left-0 block h-px w-full bg-current transition-all duration-500"
                                    :class="mobileNavOpen ? 'top-1.5 rotate-45' : 'top-0'"
                                ></span>
                                <span
                                    class="absolute left-0 top-1.5 block h-px w-full bg-current transition-opacity duration-300"
                                    :class="mobileNavOpen && 'opacity-0'"
                                ></span>
                                <span
                                    class="absolute left-0 block h-px w-full bg-current transition-all duration-500"
                                    :class="mobileNavOpen ? 'top-1.5 -rotate-45' : 'top-3'"
                                ></span>
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <!-- ================= МОБІЛЬНЕ МЕНЮ ================= -->
        <Transition
            enter-active-class="transition-opacity duration-500"
            leave-active-class="transition-opacity duration-400"
            enter-from-class="opacity-0"
            leave-to-class="opacity-0"
        >
            <div v-if="mobileNavOpen" class="fixed inset-0 z-40 md:hidden">
                <div class="absolute inset-0 bg-obsidian-950/95 backdrop-blur-2xl" @click="toggleMobileNav"></div>

                <nav class="relative flex h-full flex-col justify-center gap-2 px-8">
                    <a
                        v-for="(link, i) in navLinks"
                        :key="link.id"
                        :href="`#${link.id}`"
                        class="animate-fade-in-up border-b border-white/5 py-5 font-display text-3xl text-white/80 transition-colors active:text-gold-300"
                        :style="{ animationDelay: `${i * 70}ms` }"
                        @click="toggleMobileNav"
                    >
                        <span class="mr-4 align-middle font-sans text-[11px] tracking-[0.3em] text-gold-400/60">
                            0{{ i + 1 }}
                        </span>
                        {{ link.label }}
                    </a>

                    <a
                        :href="applyUrl"
                        :target="applyExternal ? '_blank' : null"
                        :rel="applyExternal ? 'noopener' : null"
                        class="btn-gold animate-fade-in-up mt-10 py-4 text-center text-[13px] font-semibold uppercase tracking-[0.18em]"
                        :style="{ animationDelay: `${navLinks.length * 70}ms` }"
                        @click="closeMobileNav"
                    >
                        Подати заявку
                    </a>
                </nav>
            </div>
        </Transition>

        <!-- ================= HERO ================= -->
        <section id="top" class="relative flex min-h-[100svh] items-center overflow-hidden">
            <!-- Фон їде повільніше за контент — сцена читається як кадр із
                 глибиною, а не як пласка підкладка під текстом. Шкала трохи
                 більша за 1, щоб зсув не оголив край зображення. -->
            <div class="absolute inset-0 -z-20 scale-110 overflow-hidden">
                <!-- В герое — самый кинематографичный кадр из всех: закат,
                     пальмы, силуэт города. Арт с персонажами сюда не годится:
                     в широком кропе у них срезаются лица, а сами фигуры
                     дерутся с текстом за один и тот же центр внимания. Их
                     место — вырезом в секции «Родина» и фоном в «Цілі». -->
                <div
                    v-parallax="0.12"
                    class="absolute inset-0 bg-cover bg-center"
                    style="background-image: url('/images/hero/city-sunset.jpg')"
                ></div>
            </div>

            <!-- Три градієнти замість одного: бічний тримає читабельність
                 тексту, нижній зшиває кадр із наступною секцією, верхній
                 прибирає конфлікт зображення з навігацією. -->
            <div class="absolute inset-0 -z-10 bg-gradient-to-r from-obsidian-950 via-obsidian-950/90 to-obsidian-950/45"></div>
            <div class="absolute inset-0 -z-10 bg-gradient-to-t from-obsidian-950 via-transparent to-obsidian-950/60"></div>
            <div class="cine-veil -z-10"></div>
            <div class="bg-noise absolute inset-0 -z-10 opacity-60"></div>

            <div class="relative mx-auto w-full max-w-7xl px-4 py-32 sm:px-6">
                <div v-glow class="glass-panel max-w-2xl px-7 py-9 sm:px-11 sm:py-14">
                    <p v-reveal class="mb-6 text-[10px] font-medium uppercase tracking-[0.3em] text-gold-300/90 sm:text-xs sm:tracking-[0.5em]">
                        Monsory Family · Закритий набір
                    </p>

                    <h1 v-reveal:150 class="text-balance font-display text-[2.75rem] font-light leading-[1.02] text-white sm:text-6xl lg:text-7xl">
                        Сила. Порядок.
                        <span class="text-gradient-gold italic">Спадщина.</span>
                    </h1>

                    <p v-reveal:300 class="mt-7 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
                        Закрита родина на RP-сервері: спільний особняк і автопарк,
                        свій звʼязок, спільні операції та власний кодекс. Тут
                        новачка не кидають самого, а статус підтверджують діями.
                    </p>

                    <div v-reveal:450 class="mt-10 flex flex-wrap items-center gap-4 sm:gap-6">
                        <a
                            :href="applyUrl"
                            :target="applyExternal ? '_blank' : null"
                            :rel="applyExternal ? 'noopener' : null"
                            v-magnetic
                            class="btn-gold px-8 py-4 text-[13px] font-semibold uppercase tracking-[0.18em]"
                        >
                            Подати заявку
                        </a>
                        <a
                            href="#structure"
                            class="link-underline text-[13px] font-medium uppercase tracking-[0.18em] text-white/50 transition-colors hover:text-white"
                        >
                            Дізнатись більше
                        </a>
                    </div>

                    <!-- Реальна цифра з БД, без вигаданих KPI поруч -->
                    <div ref="memberCountEl" v-reveal:600 class="mt-12 flex items-baseline gap-3 border-t border-white/10 pt-6">
                        <span class="font-display text-4xl text-gold-300">{{ memberCountValue }}</span>
                        <span class="text-[11px] uppercase tracking-[0.25em] text-white/40">активних учасників</span>
                    </div>
                </div>
            </div>

            <!-- Підказка скролу: дихаюча вертикальна нитка. -->
            <div class="pointer-events-none absolute inset-x-0 bottom-8 hidden justify-center lg:flex">
                <div class="flex flex-col items-center gap-3">
                    <span class="text-[10px] uppercase tracking-[0.4em] text-white/25">Скрол</span>
                    <span class="animate-pulse-glow h-12 w-px bg-gradient-to-b from-gold-300/70 to-transparent"></span>
                </div>
            </div>
        </section>

        <!-- бегущая строка-разделитель -->
        <div class="relative overflow-hidden border-y border-white/5 py-4">
            <div class="animate-marquee flex w-max gap-10 whitespace-nowrap text-xs uppercase tracking-[0.45em] text-white/25">
                <span v-for="n in 2" :key="n" class="flex gap-10">
                    <span>Monsory Family</span>
                    <span class="text-gold-400/70">◆</span>
                    <span>Спільне майно</span>
                    <span class="text-gold-400/70">◆</span>
                    <span>Свій кодекс</span>
                    <span class="text-gold-400/70">◆</span>
                    <span>Закритий набір</span>
                    <span class="text-gold-400/70">◆</span>
                </span>
            </div>
            <!-- Краї стрічки гаснуть у фон: різкий обрив тексту на межі екрана
                 одразу видає «крутилку», а не елемент дизайну. -->
            <div class="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-obsidian-950 to-transparent"></div>
            <div class="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-obsidian-950 to-transparent"></div>
        </div>

        <!-- ================= ЩО ДАЄ РОДИНА ================= -->
        <section id="family" class="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-28">
            <div v-reveal class="mx-auto mb-16 max-w-2xl text-center">
                <p class="mb-4 text-[11px] font-medium uppercase tracking-[0.45em] text-gold-300/90">Навіщо вступати</p>
                <h2 class="text-balance font-display text-4xl font-light text-white sm:text-5xl">
                    Що дає <span class="text-gradient-gold italic">родина</span>
                </h2>
                <p class="mx-auto mt-6 max-w-xl leading-relaxed text-white/55">
                    Родина — це не просто спільний тег у ніку. Це майно, звʼязок,
                    спільні заходи й люди, які підтримають замість того, щоб
                    дивитись, як ти розбираєшся сам.
                </p>
            </div>

            <!-- 3 колонки з 1024px: шість карток лягають у рівні 2×3, а на
                 планшеті 2×3 вертикально — без «осиротілої» картки в кінці
                 останнього ряду, як було б при чотирьох колонках. -->
            <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <div
                    v-for="(benefit, i) in benefits"
                    :key="benefit.title"
                    v-reveal="'scale'"
                    :style="{ transitionDelay: `${i * 90}ms` }"
                    v-glow
                    class="group glass-panel relative overflow-hidden p-7 transition-all duration-700 hover:-translate-y-2"
                >
                    <div class="glass-sheen"></div>
                    <div class="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gold-400/20 blur-2xl opacity-0 transition-opacity duration-700 group-hover:opacity-100"></div>

                    <div class="text-outline-gold font-display relative mb-5 text-4xl leading-none transition-colors duration-500 group-hover:text-gold-400/25">
                        {{ String(i + 1).padStart(2, '0') }}
                    </div>
                    <h3 class="relative mb-3 text-lg font-semibold text-white">{{ benefit.title }}</h3>
                    <p class="relative text-sm leading-relaxed text-white/55">{{ benefit.text }}</p>
                </div>
            </div>
        </section>

        <!-- ================= СТАТИСТИКА РОДИНИ ================= -->
        <section v-if="stats.length > 0" id="stats" class="relative mx-auto max-w-5xl px-4 py-20 sm:px-6">
            <div v-reveal class="mx-auto mb-12 max-w-2xl text-center">
                <p class="mb-4 text-[11px] font-medium uppercase tracking-[0.45em] text-gold-300/90">Родина в цифрах</p>
                <h2 class="text-balance font-display text-4xl font-light text-white sm:text-5xl">
                    Не слова, а <span class="text-gradient-gold italic">результат</span>
                </h2>
            </div>

            <div class="mb-10 grid gap-4 sm:grid-cols-2" :class="stats.length >= 3 ? 'lg:grid-cols-4' : ''">
                <div
                    v-for="(stat, i) in stats"
                    :key="stat.key"
                    v-reveal="'scale'"
                    :style="{ transitionDelay: `${i * 90}ms` }"
                    v-glow
                    class="glass-panel-gold glass-panel p-6 text-center"
                >
                    <p class="font-display text-3xl text-gold-200 sm:text-4xl">{{ fmtStat(stat.value) }}</p>
                    <p class="mt-2 text-xs uppercase tracking-widest text-white/40">{{ stat.label }}</p>
                </div>
            </div>

            <div v-if="stats.length > 1" v-reveal v-glow class="glass-panel p-6 sm:p-8">
                <StatsBarChart :items="stats" />
            </div>
        </section>

        <!-- ================= НАПРЯМКИ ================= -->
        <!-- Вирізані фігури, а не фонові кадри: напрямок отримує власного
             персонажа, який стоїть "у кімнаті" сторінки — зі своїм світлом
             позаду і відображенням під ногами, а не наклеєний на темряву. -->
        <section id="roles" class="relative overflow-hidden py-24 sm:py-32">
            <div class="mx-auto max-w-7xl px-4 sm:px-6">
                <div v-reveal class="mx-auto mb-16 max-w-2xl text-center">
                    <p class="mb-4 text-[11px] font-medium uppercase tracking-[0.45em] text-gold-300/90">Чим займається родина</p>
                    <h2 class="text-balance font-display text-4xl font-light text-white sm:text-5xl">
                        Два напрямки. <span class="text-gradient-gold italic">Один результат.</span>
                    </h2>
                    <p class="mx-auto mt-6 max-w-xl leading-relaxed text-white/55">
                        Уся робота родини зводиться до двох напрямків. Під кожен
                        є своя посада — Охорона та Юрист, 7-ма і 6-та у
                        вертикалі. Потрапити на них можна навіть із нижчої
                        посади, якщо людина себе показала.
                    </p>
                </div>

                <div class="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
                    <div
                        v-for="(dir, i) in directions"
                        :key="dir.title"
                        v-reveal="'scale'"
                        :style="{ transitionDelay: `${i * 130}ms` }"
                        v-glow
                        class="group glass-panel relative flex flex-col overflow-hidden px-6 pb-8 pt-8 transition-all duration-700 hover:-translate-y-2 sm:px-8"
                    >
                        <div class="glass-sheen"></div>

                        <!-- Сцена персонажа: контрове світло + фігура +
                             відображення. Фіксована висота тримає нижні краї
                             карток на одній лінії, навіть коли вирізи мають
                             різні пропорції. -->
                        <div class="relative mb-7 h-64 sm:h-72">
                            <div class="pointer-events-none absolute left-1/2 top-1/4 h-48 w-48 -translate-x-1/2 rounded-full bg-gold-500/20 blur-[60px] transition-all duration-700 group-hover:bg-gold-400/30"></div>
                            <div class="pointer-events-none absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-aurora-500/20 blur-[55px]"></div>

                            <img
                                :src="dir.image"
                                :alt="`Напрямок у родині: ${dir.title}`"
                                loading="lazy"
                                decoding="async"
                                class="img-cine relative mx-auto h-full w-auto object-contain drop-shadow-[0_28px_45px_rgba(0,0,0,0.8)] transition-transform duration-700 group-hover:-translate-y-1.5"
                            />

                            <img
                                :src="dir.image"
                                alt=""
                                aria-hidden="true"
                                loading="lazy"
                                decoding="async"
                                class="pointer-events-none absolute inset-x-0 top-full mx-auto h-16 w-auto -scale-y-100 object-contain opacity-20 blur-[2px] [mask-image:linear-gradient(to_top,transparent_15%,rgba(0,0,0,0.8))]"
                            />

                            <div class="pointer-events-none absolute inset-x-6 top-full h-px bg-gradient-to-r from-transparent via-gold-400/40 to-transparent"></div>
                        </div>

                        <div class="relative">
                            <p class="mb-2 text-[10px] uppercase tracking-[0.3em] text-gold-300/70">{{ dir.tag }}</p>
                            <h3 class="font-display text-2xl text-white">{{ dir.title }}</h3>
                            <p class="mt-3 text-sm leading-relaxed text-white/50">{{ dir.text }}</p>
                        </div>
                    </div>
                </div>

                <p v-reveal:200 class="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-white/40">
                    Посада — не спосіб отримувати зарплату. Посада означає
                    відповідальність перед родиною: немає активності й виконання
                    обовʼязків — посада переглядається.
                </p>
            </div>
        </section>

        <!-- ================= РАНГИ ================= -->
        <section id="positions" class="relative overflow-hidden py-24 sm:py-28">
            <div class="mx-auto max-w-7xl px-4 sm:px-6">
                <div v-reveal class="mx-auto mb-16 max-w-2xl text-center">
                    <p class="mb-4 text-[11px] font-medium uppercase tracking-[0.45em] text-gold-300/90">Система розвитку</p>
                    <h2 class="text-balance font-display text-4xl font-light text-white sm:text-5xl">
                        Шлях від <span class="text-gradient-gold italic">стажера</span>
                    </h2>
                    <p class="mx-auto mt-6 max-w-xl leading-relaxed text-white/55">
                        У родині десять посад. Кожен починає з найнижчої — без
                        винятків. Посада тут не напис біля ніку, а показник
                        активності, внеску в родину й довіри керівництва.
                    </p>
                </div>

                <p v-reveal class="mb-6 text-center text-[10px] uppercase tracking-[0.35em] text-gold-300/70">
                    Основний склад · 01–05
                </p>

                <!-- П'ять сходинок: на телефоні одна колонка, з планшета дві,
                     з 1280px — усі п'ять в один ряд, як драбина зліва направо. -->
                <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    <div
                        v-for="(rank, i) in basePositions"
                        :key="rank.title"
                        v-reveal="'scale'"
                        :style="{ transitionDelay: `${i * 90}ms` }"
                        v-glow
                        class="group glass-panel relative flex flex-col overflow-hidden px-5 pb-6 pt-6 transition-all duration-700 hover:-translate-y-2"
                    >
                        <div class="glass-sheen"></div>

                        <div class="relative mb-5 h-44">
                            <div class="pointer-events-none absolute left-1/2 top-1/4 h-32 w-32 -translate-x-1/2 rounded-full bg-gold-500/20 blur-[50px] transition-all duration-700 group-hover:bg-gold-400/30"></div>
                            <img
                                :src="rank.image"
                                :alt="`Посада в родині: ${rank.title}`"
                                loading="lazy"
                                decoding="async"
                                class="img-cine relative mx-auto h-full w-auto object-contain drop-shadow-[0_22px_35px_rgba(0,0,0,0.8)] transition-transform duration-700 group-hover:-translate-y-1"
                            />
                            <div class="pointer-events-none absolute inset-x-4 top-full h-px bg-gradient-to-r from-transparent via-gold-400/35 to-transparent"></div>
                        </div>

                        <div class="relative">
                            <div class="mb-2 flex items-center gap-2.5">
                                <span class="font-display text-sm text-gold-400/70">0{{ i + 1 }}</span>
                                <span class="h-px flex-1 bg-gradient-to-r from-gold-400/30 to-transparent"></span>
                            </div>
                            <h3 class="font-semibold text-white">{{ rank.title }}</h3>
                            <p class="mt-2 text-[13px] leading-relaxed text-white/50">{{ rank.text }}</p>
                        </div>
                    </div>
                </div>

                <!-- Верхні пʼять посад — без фотографій і компактніше: сюди
                     не приходять із вулиці, а Юрист і Охорона вже показані
                     великими картками в секції «Напрямки». -->
                <p v-reveal class="mb-6 mt-14 text-center text-[10px] uppercase tracking-[0.35em] text-gold-300/70">
                    Напрямки та керівництво · 06–10
                </p>

                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    <div
                        v-for="(rank, i) in topPositions"
                        :key="rank.title"
                        v-reveal="'scale'"
                        :style="{ transitionDelay: `${i * 80}ms` }"
                        v-glow
                        class="group glass-panel relative flex flex-col overflow-hidden px-5 pb-6 pt-6 transition-all duration-700 hover:-translate-y-2"
                    >
                        <div class="glass-sheen"></div>

                        <div class="relative mb-5 h-44">
                            <div class="pointer-events-none absolute left-1/2 top-1/4 h-32 w-32 -translate-x-1/2 rounded-full bg-gold-500/20 blur-[50px] transition-all duration-700 group-hover:bg-gold-400/30"></div>
                            <img
                                :src="rank.image"
                                :alt="`Посада в родині: ${rank.title}`"
                                loading="lazy"
                                decoding="async"
                                class="img-cine relative mx-auto h-full w-auto object-contain drop-shadow-[0_22px_35px_rgba(0,0,0,0.8)] transition-transform duration-700 group-hover:-translate-y-1"
                            />
                            <div class="pointer-events-none absolute inset-x-4 top-full h-px bg-gradient-to-r from-transparent via-gold-400/35 to-transparent"></div>
                        </div>

                        <div class="relative">
                            <div class="mb-2 flex items-center gap-2.5">
                                <span class="font-display text-sm text-gold-400/70">{{ i + 6 }}</span>
                                <span class="h-px flex-1 bg-gradient-to-r from-gold-400/30 to-transparent"></span>
                            </div>
                            <h3 class="font-semibold text-white">{{ rank.title }}</h3>
                            <p class="mt-2 text-[13px] leading-relaxed text-white/50">{{ rank.text }}</p>
                        </div>
                    </div>
                </div>

                <div class="mt-12 grid gap-5 lg:grid-cols-2">
                    <div v-reveal="'left'" v-glow class="glass-panel px-7 py-8">
                        <h3 class="font-display text-xl text-white">За що підвищують</h3>
                        <ul class="mt-5 space-y-2.5">
                            <li
                                v-for="criterion in promotionCriteria"
                                :key="criterion"
                                class="flex items-start gap-3 text-sm text-white/55"
                            >
                                <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-400/80"></span>
                                {{ criterion }}
                            </li>
                        </ul>
                    </div>

                    <div v-reveal="'right'" v-glow class="glass-panel-gold glass-panel px-7 py-8">
                        <h3 class="font-display text-xl text-white">Як отримати підвищення</h3>
                        <p class="mt-5 text-sm leading-relaxed text-white/60">
                            Фіксованої кількості днів, після якої посада видається
                            автоматично, не існує. Заступники бачать, хто грає на
                            результат, а хто просто числиться у складі.
                        </p>
                        <p class="mt-4 text-sm leading-relaxed text-white/60">
                            Показуєш результат — рухаєшся далі. А от випрошування
                            посади, навпаки, помітно зменшує шанси її отримати.
                        </p>
                    </div>
                </div>
            </div>
        </section>

        <!-- ================= СТРУКТУРА ================= -->
        <section id="structure" class="relative overflow-hidden py-28 sm:py-32">
            <!-- Груповий кадр іде фоном, а не вирізом: у файлі лишився чорний
                 фон із джерела, і як фігура він давав би помітний прямокутник
                 поверх сторінки. Під градієнтом він читається як сцена. -->
            <div class="absolute inset-0 -z-20 overflow-hidden">
                <div
                    v-parallax="0.08"
                    class="absolute inset-0 scale-110 bg-cover bg-top opacity-40"
                    style="background-image: url('/images/roles/leadership.webp')"
                ></div>
            </div>
            <div class="absolute inset-0 -z-10 bg-gradient-to-b from-obsidian-950 via-obsidian-950/85 to-obsidian-950"></div>

            <div class="relative mx-auto max-w-7xl px-4 sm:px-6">
                <div v-reveal class="mx-auto mb-14 max-w-2xl text-center">
                    <p class="mb-4 text-[11px] font-medium uppercase tracking-[0.45em] text-gold-300/90">Керівництво</p>
                    <h2 class="text-balance font-display text-4xl font-light text-white sm:text-5xl">
                        Хто за що <span class="text-gradient-gold italic">відповідає</span>
                    </h2>
                    <p class="mx-auto mt-6 max-w-xl leading-relaxed text-white/55">
                        У родині кожен напрямок має відповідального. Новачок із
                        першого дня знає, до кого йти з конкретним питанням.
                    </p>
                </div>

                <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <div
                        v-for="(unit, i) in leadership"
                        :key="unit.title"
                        v-reveal="'scale'"
                        :style="{ transitionDelay: `${i * 80}ms` }"
                        v-glow
                        class="group glass-panel relative overflow-hidden px-6 py-6 transition-all duration-700 hover:-translate-y-1.5"
                    >
                        <div class="glass-sheen"></div>
                        <h3 class="relative font-semibold text-white">{{ unit.title }}</h3>
                        <!-- Нік показуємо, лише коли він заповнений в адмінці:
                             порожній рядок під заголовком виглядав би як
                             недозавантажена картка. -->
                        <p v-if="unit.nickname" class="relative mt-1 font-mono text-xs tracking-wide text-gold-300/80">
                            {{ unit.nickname }}
                        </p>
                        <p class="relative mt-2 text-sm leading-relaxed text-white/50">{{ unit.text }}</p>
                    </div>
                </div>

                <div v-reveal:200 v-glow class="glass-panel-gold glass-panel mx-auto mt-10 max-w-3xl px-7 py-7 text-center sm:px-10">
                    <p class="text-[10px] uppercase tracking-[0.35em] text-gold-300/80">Головне правило</p>
                    <p class="mt-4 leading-relaxed text-white/70">
                        Питання — спершу до того, хто відповідає за напрямок. Так
                        воно вирішується швидше, а керівництво не завантажене тим,
                        що можна закрити на місці.
                    </p>
                </div>
            </div>
        </section>

        <!-- ================= КАРУСЕЛЬ: УЧАСНИКИ РОДИНИ ================= -->
        <!-- Порожній масив — секція просто не рендериться: без цього на
             свіжому сайті, поки ще ніхто не завантажив фото профілю,
             показувалась би порожня карусель без сенсу. -->
        <section v-if="memberPhotos.length > 0" id="member-gallery" class="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <div v-reveal class="mx-auto mb-12 max-w-2xl text-center">
                <p class="mb-4 text-[11px] font-medium uppercase tracking-[0.45em] text-gold-300/90">Хто в родині</p>
                <h2 class="text-balance font-display text-4xl font-light text-white sm:text-5xl">
                    Обличчя <span class="text-gradient-gold italic">родини</span>
                </h2>
            </div>

            <PhotoCarousel :items="memberPhotos" variant="round" />
        </section>

        <!-- ================= АТМОСФЕРА ================= -->
        <!-- overflow-x-clip обовʼязковий: усередині є картки з появою "збоку"
             (v-reveal left/right), які до показу зсунуті на 40px за межі
             контейнера. Це єдина секція без власного обрізання, і саме через
             неї сторінка ставала на 24px ширшою за екран — при максимальному
             віддаленні збоку зʼявлялась порожня смуга.
             Саме clip, а не hidden: hidden зробив би секцію скрол-контейнером
             і зламав би position: sticky всередині. -->
        <section id="showcase" class="relative mx-auto max-w-7xl overflow-x-clip px-4 py-20 sm:px-6">
            <div v-reveal class="mx-auto mb-14 max-w-2xl text-center">
                <p class="mb-4 text-[11px] font-medium uppercase tracking-[0.45em] text-gold-300/90">Атмосфера</p>
                <h2 class="text-balance font-display text-4xl font-light text-white sm:text-5xl">
                    Життя <span class="text-gradient-gold italic">родини</span>
                </h2>
            </div>

            <div class="grid gap-5 lg:grid-cols-2">
                <div v-reveal="'left'" v-glow class="group glass-panel relative aspect-[4/3] overflow-hidden sm:aspect-[16/10]">
                    <img
                        src="/images/hero/ferrari-daylight.jpg"
                        alt="Вулиці міста на світанку"
                        loading="lazy"
                        decoding="async"
                        class="img-cine h-full w-full object-cover group-hover:scale-[1.05]"
                    />
                    <div class="cine-veil"></div>
                    <div class="glass-sheen z-10"></div>
                    <div class="absolute inset-x-0 bottom-0 p-6">
                        <p class="text-[10px] font-medium uppercase tracking-[0.4em] text-gold-300/90">Стиль</p>
                        <p class="mt-1.5 font-display text-xl text-white">Своя естетика, свій темп</p>
                    </div>
                </div>

                <div v-reveal="'right'" v-glow class="group glass-panel relative aspect-[4/3] overflow-hidden sm:aspect-[16/10]">
                    <img
                        src="/images/hero/chase.jpg"
                        alt="Нічна погоня вулицями міста"
                        loading="lazy"
                        decoding="async"
                        class="img-cine h-full w-full object-cover group-hover:scale-[1.05]"
                    />
                    <div class="cine-veil"></div>
                    <div class="glass-sheen z-10"></div>
                    <div class="absolute inset-x-0 bottom-0 p-6">
                        <p class="text-[10px] font-medium uppercase tracking-[0.4em] text-gold-300/90">Темп</p>
                        <p class="mt-1.5 font-display text-xl text-white">Ніч, у якій вирішує швидкість</p>
                    </div>
                </div>
            </div>

            <!-- ================= РОЛЬОВА ГРА ================= -->
            <div class="mt-16 grid items-center gap-10 sm:mt-20 lg:grid-cols-2 lg:gap-12">
                <div v-reveal="'left'" class="relative order-2 flex justify-center lg:order-1">
                    <div class="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-gold-500/20 blur-[80px]"></div>
                    <div class="pointer-events-none absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-aurora-500/20 blur-[70px]"></div>

                    <!-- Кадр в рамке, а не «парящая» вырезка: исходник обрезан
                         по макушке и по бедру, и без рамки эти два плоских
                         среза висели посреди страницы как брак. У края рамки
                         тот же срез читается как обычное портретное
                         кадрирование. -->
                    <div
                        v-glow
                        class="group glass-panel relative aspect-[3/4] w-full max-w-[17rem] overflow-hidden sm:max-w-xs"
                    >
                        <img
                            src="/images/roles/lifestyle.webp"
                            alt="Життя родини поза роботою"
                            loading="lazy"
                            decoding="async"
                            class="img-cine h-full w-full object-cover object-top transition-transform duration-[1.2s] group-hover:scale-[1.04]"
                        />
                        <div class="cine-veil"></div>
                        <div class="glass-sheen z-10"></div>
                        <!-- В отличие от пейзажных кадров тут у нижней кромки
                             не фон, а сама фигура, поэтому подписи нужна своя
                             затемняющая подложка — иначе она читается поверх
                             светлой кожи. -->
                        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-obsidian-950 via-obsidian-950/70 to-transparent"></div>
                        <div class="absolute inset-x-0 bottom-0 p-5">
                            <p class="text-[10px] font-medium uppercase tracking-[0.4em] text-gold-300/90">Поза справами</p>
                            <p class="mt-1.5 font-display text-lg leading-snug text-white">Вечір поза звітами</p>
                        </div>
                    </div>
                </div>

                <div v-reveal="'right'" class="order-1 lg:order-2">
                    <p class="mb-4 text-[11px] font-medium uppercase tracking-[0.45em] text-gold-300/90">Не тільки робота</p>
                    <h3 class="text-balance font-display text-3xl font-light text-white sm:text-4xl">
                        Ми граємо <span class="text-gradient-gold italic">роль</span>, а не статистику
                    </h3>
                    <p class="mt-6 max-w-lg leading-relaxed text-white/55">
                        У родини є власні традиції, дрес-код і кодекс. Між
                        контрактами та бізнес-війнами є звичайне життя міста —
                        зустрічі, вечірки, івенти й просто вечори у своєму колі.
                    </p>
                    <p class="mt-4 max-w-lg leading-relaxed text-white/55">
                        Саме з цього складається історія, заради якої люди
                        лишаються в родині роками, а не тільки з цифр у звітах.
                    </p>
                </div>
            </div>
        </section>

        <!-- ================= КАРУСЕЛЬ: ГАЛЕРЕЯ РОДИНИ ================= -->
        <section v-if="galleryPhotos.length > 0" id="family-gallery" class="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <div v-reveal class="mx-auto mb-12 max-w-2xl text-center">
                <p class="mb-4 text-[11px] font-medium uppercase tracking-[0.45em] text-gold-300/90">Моменти</p>
                <h2 class="text-balance font-display text-4xl font-light text-white sm:text-5xl">
                    Галерея <span class="text-gradient-gold italic">родини</span>
                </h2>
            </div>

            <PhotoCarousel :items="galleryPhotos" variant="wide" />
        </section>

        <!-- ================= CINEMATIC: РІЗНІ ЦІЛІ ================= -->
        <section id="goals" class="relative overflow-hidden py-32 sm:py-40">
            <div class="absolute inset-0 -z-20 scale-110 overflow-hidden">
                <!-- Арт с персонажами уместен именно здесь: под плотной
                     затемняющей заливкой его выцветшие цвета не читаются как
                     дефект, а силуэты поддерживают мысль «разные цели». -->
                <div
                    v-parallax="0.1"
                    class="absolute inset-0 bg-cover bg-center"
                    style="background-image: url('/images/hero/trio.jpg')"
                ></div>
            </div>
            <div class="absolute inset-0 -z-10 bg-obsidian-950/85"></div>
            <div class="absolute inset-0 -z-10 bg-gradient-to-t from-obsidian-950 via-transparent to-obsidian-950/70"></div>
            <div class="cine-veil -z-10"></div>

            <div class="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
                <div v-glow class="glass-panel mx-auto inline-block px-7 py-10 sm:px-14 sm:py-16">
                    <p v-reveal class="mb-6 text-[11px] font-medium uppercase tracking-[0.45em] text-gold-300/90">
                        Ціль родини
                    </p>
                    <blockquote v-reveal:150 class="text-balance font-display text-3xl italic leading-snug text-white/90 sm:text-4xl">
                        Різні цілі.
                        <span class="text-gradient-gold">Спільний результат.</span>
                    </blockquote>
                    <p v-reveal:300 class="mx-auto mt-8 max-w-xl leading-relaxed text-white/50">
                        У кожного учасника свій шлях і свої задачі — хтось тримає
                        бізнес, хтось працює в полі, хтось веде переговори. Але
                        результат родини складається із суми дій кожного, а не
                        з обіцянок.
                    </p>
                </div>
            </div>
        </section>

        <!-- ================= LEGACY CTA ================= -->
        <section id="legacy" class="relative overflow-hidden py-28 sm:py-36">
            <div class="absolute inset-0 -z-20 scale-110 overflow-hidden">
                <div
                    v-parallax="0.08"
                    class="absolute inset-0 bg-cover bg-center"
                    style="background-image: url('/images/hero/cta-sunset.jpg')"
                ></div>
            </div>
            <div class="absolute inset-0 -z-10 bg-gradient-to-t from-obsidian-950 via-obsidian-950/80 to-obsidian-950/45"></div>
            <div class="cine-veil -z-10"></div>

            <div class="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
                <!-- Родина «виходить» із заходу сонця прямо над закликом
                     вступити: фігури дають фіналу обличчя, а не просто ще
                     одну кнопку на градієнті. -->
                <div v-reveal="'scale'" class="relative mx-auto mb-[-3rem] w-full max-w-sm sm:mb-[-4rem] sm:max-w-md">
                    <div class="pointer-events-none absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-gold-500/25 blur-[70px] sm:h-72 sm:w-72"></div>
                    <img
                        src="/images/roles/trio-wide.webp"
                        alt="Склад родини Monsory"
                        loading="lazy"
                        decoding="async"
                        class="animate-float-slow img-cine relative w-full drop-shadow-[0_30px_55px_rgba(0,0,0,0.85)]"
                    />
                </div>

                <div v-glow class="glass-panel-gold glass-panel relative mx-auto inline-block px-7 py-10 sm:px-14 sm:py-16">
                    <h2 v-reveal class="text-balance font-display text-4xl font-light text-white sm:text-5xl">
                        Кожна дія
                        <span class="text-gradient-gold italic">залишає слід.</span>
                    </h2>
                    <!-- Поки бот не заведений, і текст, і підпис кнопки
                         змінюються: обіцяти заявку в Telegram і вести на
                         реєстрацію — це обманути з першого ж кроку. Друга
                         кнопка тоді ховається, бо вела б рівно туди ж. -->
                    <p v-reveal:150 class="mx-auto mt-6 max-w-xl leading-relaxed text-white/60">
                        <template v-if="applyExternal">
                            Заповніть заявку в Telegram-боті — ми розглядаємо
                            кожну особисто, а не масово.
                        </template>
                        <template v-else>
                            Створіть акаунт і залиште заявку — ми розглядаємо
                            кожну особисто, а не масово.
                        </template>
                    </p>
                    <div v-reveal:300 class="mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-5">
                        <a
                            :href="applyUrl"
                            :target="applyExternal ? '_blank' : null"
                            :rel="applyExternal ? 'noopener' : null"
                            v-magnetic
                            class="btn-gold px-9 py-4 text-[13px] font-semibold uppercase tracking-[0.18em]"
                        >
                            {{ applyExternal ? 'Подати заявку в Telegram' : 'Створити акаунт' }}
                        </a>
                        <Link
                            v-if="applyExternal && canRegister && !$page.props.auth?.user"
                            :href="route('register')"
                            class="glass-pill btn-ghost px-9 py-4 text-[13px] font-medium uppercase tracking-[0.18em] text-white/70"
                        >
                            Створити акаунт
                        </Link>
                    </div>
                </div>
            </div>
        </section>

        <!-- ================= FOOTER ================= -->
        <footer class="relative px-4 pb-12 pt-16 sm:px-6">
            <div class="mx-auto max-w-7xl">
                <hr class="hairline mb-12" />

                <div class="flex flex-col items-center gap-10 sm:flex-row sm:items-start sm:justify-between">
                    <div class="text-center sm:text-left">
                        <div class="flex items-center justify-center gap-3 sm:justify-start">
                            <ApplicationLogo mark class="h-8 w-8 text-base" />
                            <span class="font-display text-lg tracking-[0.3em] text-white">MONSORY</span>
                        </div>
                        <p class="mt-4 max-w-xs text-sm leading-relaxed text-white/35">
                            Закрита родина на RP-сервері. Статус підтверджують
                            діями, а не словами.
                        </p>
                    </div>

                    <nav class="flex flex-col items-center gap-3 text-sm text-white/40 sm:items-start">
                        <span class="text-[10px] uppercase tracking-[0.35em] text-gold-300/60">Навігація</span>
                        <a
                            v-for="link in navLinks"
                            :key="link.id"
                            :href="`#${link.id}`"
                            class="transition-colors duration-300 hover:text-gold-300"
                        >
                            {{ link.label }}
                        </a>
                    </nav>

                    <div class="flex flex-col items-center gap-3 text-sm text-white/40 sm:items-start">
                        <span class="text-[10px] uppercase tracking-[0.35em] text-gold-300/60">Звʼязок</span>
                        <Link v-if="canLogin" :href="route('login')" class="transition-colors duration-300 hover:text-gold-300">
                            Вхід у кабінет
                        </Link>
                    </div>

                    <div v-if="socialLinks.length > 0" class="flex flex-col items-center gap-3 sm:items-start">
                        <span class="text-[10px] uppercase tracking-[0.35em] text-gold-300/60">Соцмережі</span>
                        <div class="flex flex-wrap gap-2">
                            <a
                                v-for="link in socialLinks"
                                :key="link.platform"
                                :href="link.url"
                                target="_blank"
                                rel="noopener"
                                :title="SOCIAL_LABELS[link.platform] || link.platform"
                                class="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/50 transition-colors duration-300 hover:border-gold-400/40 hover:text-gold-300"
                            >
                                <SocialIcon :platform="link.platform" />
                            </a>
                        </div>
                    </div>
                </div>

                <hr class="hairline my-10" />

                <p class="text-center text-xs tracking-wide text-white/25">
                    © {{ year }} {{ siteName }}
                </p>
            </div>
        </footer>
    </div>
</template>
