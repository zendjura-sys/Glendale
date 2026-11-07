import { usePage } from '@inertiajs/react';
import { useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import { Aurora } from '@/components/gc/aurora';
import {
    DEFAULT_BACKGROUND,
    useBackgroundPreview,
    usePageBackgroundVideo,
} from '@/lib/backgrounds';
import { useDataSaver } from '@/lib/data-saver';
import { cn } from '@/lib/utils';
import type { SiteBackgroundPreset } from '@/types';

/**
 * Фон сайту за інтерфейсом: жива сцена (Налаштування → Вигляд → Фон) або відео YouTube (GameCon+).
 * Сцени — CSS і SVG без картинок: рухаються лише прозорість і зсуви, тож це дешево для відеокарти.
 * «Без руху» (вимикач, системне «зменшити рух» чи режим економії трафіку) — нерухомий кадр.
 */

/** Детермінований псевдовипадок: зорі стоять на місцях між рендерами. */
function rand(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;

    return x - Math.floor(x);
}

/** Поле зірок одним box-shadow (тисячі елементів DOM не потрібні). */
function starField(count: number, seed: number, spread = 100): string {
    return Array.from({ length: count }, (_, i) => {
        const x = (rand(seed + i * 3.1) * spread).toFixed(2);
        const y = (rand(seed + i * 7.7) * spread * 0.62).toFixed(2);
        const a = (0.35 + rand(seed + i * 1.3) * 0.65).toFixed(2);

        return `${x}vw ${y}vh 0 rgb(255 255 255 / ${a})`;
    }).join(',');
}

function DuneScene() {
    const stars = useMemo(() => starField(90, 3), []);

    return (
        <div className="bg-scene bg-dune">
            <div className="bg-dune__sky bg-dune__sky--day" />
            <div className="bg-dune__sky bg-dune__sky--dusk" />
            <div className="bg-dune__sky bg-dune__sky--night" />
            <div className="bg-dune__stars" style={{ boxShadow: stars }} />
            <div className="bg-dune__sun" />
            <svg
                className="bg-dune__land"
                viewBox="0 0 1600 900"
                preserveAspectRatio="xMidYMax slice"
            >
                <defs>
                    <linearGradient id="dune-far" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#d49a72" />
                        <stop offset="1" stopColor="#9c6a52" />
                    </linearGradient>
                    <linearGradient id="dune-mid" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#b97a58" />
                        <stop offset="0.55" stopColor="#8a5640" />
                        <stop offset="1" stopColor="#6d4232" />
                    </linearGradient>
                    <linearGradient id="dune-near" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#6b4434" />
                        <stop offset="1" stopColor="#2f1d17" />
                    </linearGradient>
                    <linearGradient id="dune-haze" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#ffe6d0" stopOpacity="0" />
                        <stop
                            offset="0.6"
                            stopColor="#ffe6d0"
                            stopOpacity="0.16"
                        />
                        <stop offset="1" stopColor="#ffe6d0" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path
                    d="M0 560C180 520 300 545 430 515C560 485 650 525 790 505C930 485 1030 525 1170 498C1310 472 1450 512 1600 490V900H0Z"
                    fill="#7b7392"
                    opacity="0.7"
                />
                <rect
                    x="0"
                    y="470"
                    width="1600"
                    height="170"
                    fill="url(#dune-haze)"
                />
                <path
                    d="M0 625C220 575 390 605 570 592C770 578 890 632 1110 612C1310 594 1450 602 1600 586V900H0Z"
                    fill="url(#dune-far)"
                />
                <path
                    d="M0 705C160 662 330 652 520 684C700 712 860 642 1040 652C1240 664 1420 722 1600 692V900H0Z"
                    fill="url(#dune-mid)"
                />
                {/* Світлі гребені дюн — об'єм, як на фото. */}
                <g fill="none" stroke="#ffd9b0" strokeLinecap="round">
                    <path
                        d="M0 625C220 575 390 605 570 592C770 578 890 632 1110 612C1310 594 1450 602 1600 586"
                        strokeOpacity="0.28"
                        strokeWidth="2"
                    />
                    <path
                        d="M0 705C160 662 330 652 520 684C700 712 860 642 1040 652C1240 664 1420 722 1600 692"
                        strokeOpacity="0.22"
                        strokeWidth="2.5"
                    />
                </g>
                <path
                    d="M0 795C260 742 470 764 700 802C930 842 1150 762 1380 772C1480 776 1550 790 1600 800V900H0Z"
                    fill="url(#dune-near)"
                />
                {/* Сухі кущі на передньому плані. */}
                <g fill="#1d120e" opacity="0.9">
                    <path d="M90 860l-30-90 42 78-4-110 22 112 24-96-6 104 40-70-30 80Z" />
                    <path d="M1480 870l-26-80 38 70 2-98 18 100 30-84-12 94 44-58-36 70Z" />
                    <path d="M760 880l-14-46 22 40 6-56 10 58 20-44-8 50Z" />
                </g>
            </svg>
            <div className="bg-dune__shade" />
            {/* Лампи — над затемненням: уночі вони світять, а не гаснуть разом із пейзажем. */}
            <svg
                className="bg-dune__land"
                viewBox="0 0 1600 900"
                preserveAspectRatio="xMidYMax slice"
            >
                <defs>
                    <radialGradient id="dune-orb" cx="0.5" cy="0.45" r="0.55">
                        <stop offset="0" stopColor="#fff2d6" />
                        <stop offset="0.45" stopColor="#ffc27a" />
                        <stop offset="1" stopColor="#f07a2a" />
                    </radialGradient>
                    <clipPath id="dune-above-near">
                        <path d="M0 0H1600V800C1550 790 1480 776 1380 772C1150 762 930 842 700 802C470 764 260 742 0 795Z" />
                    </clipPath>
                </defs>
                {/* Світні «купол-лампи» на дюнах, як у референсі. */}
                <g className="bg-dune__orbs">
                    <ellipse
                        cx="300"
                        cy="780"
                        rx="120"
                        ry="60"
                        fill="#ff9a3c"
                        opacity="0.35"
                        style={{ filter: 'blur(24px)' }}
                    />
                    <path
                        clipPath="url(#dune-above-near)"
                        d="M240 790a60 60 0 0 1 120 0Z"
                        fill="url(#dune-orb)"
                    />
                    <ellipse
                        cx="1300"
                        cy="770"
                        rx="170"
                        ry="80"
                        fill="#ff9a3c"
                        opacity="0.35"
                        style={{ filter: 'blur(30px)' }}
                    />
                    <path
                        clipPath="url(#dune-above-near)"
                        d="M1215 782a85 85 0 0 1 170 0Z"
                        fill="url(#dune-orb)"
                    />
                </g>
            </svg>
        </div>
    );
}

function NightScene() {
    const near = useMemo(() => starField(70, 11), []);
    const far = useMemo(() => starField(160, 29), []);

    return (
        <div className="bg-scene bg-night">
            <div className="bg-night__band" />
            <div
                className="bg-night__stars bg-night__stars--far"
                style={{ boxShadow: far }}
            />
            <div
                className="bg-night__stars bg-night__stars--near"
                style={{ boxShadow: near }}
            />
            <span className="bg-night__meteor" />
            <span className="bg-night__meteor bg-night__meteor--late" />
            <div className="bg-night__horizon" />
        </div>
    );
}

function OceanScene() {
    const wave = (d: string, cls: string) => (
        <svg
            className={cn('bg-ocean__wave', cls)}
            viewBox="0 0 2400 200"
            preserveAspectRatio="none"
        >
            <path d={d} />
        </svg>
    );

    return (
        <div className="bg-scene bg-ocean">
            <div className="bg-ocean__rays" />
            {wave(
                'M0 100C200 60 400 140 600 100S1000 60 1200 100S1600 140 1800 100S2200 60 2400 100V200H0Z',
                'bg-ocean__wave--back',
            )}
            {wave(
                'M0 110C150 80 300 140 450 110S750 80 900 110S1200 140 1350 110S1650 80 1800 110S2100 140 2250 110S2400 100 2400 110V200H0Z',
                'bg-ocean__wave--mid',
            )}
            {wave(
                'M0 120C250 90 500 150 750 120S1250 90 1500 120S2000 150 2250 120S2400 115 2400 120V200H0Z',
                'bg-ocean__wave--front',
            )}
        </div>
    );
}

function MeshScene() {
    return (
        <div className="bg-scene bg-mesh">
            <span className="bg-mesh__blob bg-mesh__blob--a" />
            <span className="bg-mesh__blob bg-mesh__blob--b" />
            <span className="bg-mesh__blob bg-mesh__blob--c" />
            <span className="bg-mesh__blob bg-mesh__blob--d" />
        </div>
    );
}

/** Фірмовий фон з адмінки: окрема картинка для телефона (вертикальна) і для комп'ютера. */
function ImageScene({
    desktop,
    mobile,
}: {
    desktop: string | null;
    mobile: string | null;
}) {
    return (
        <div className="bg-scene bg-image">
            <picture>
                {mobile && desktop && (
                    <source media="(max-width: 767px)" srcSet={mobile} />
                )}
                <img
                    src={desktop ?? mobile ?? ''}
                    alt=""
                    decoding="async"
                    fetchPriority="high"
                    className="bg-image__frame"
                />
            </picture>
            <div className="bg-image__shade" />
        </div>
    );
}

function YouTubeScene({ id, still }: { id: string; still: boolean }) {
    return (
        <div className="bg-scene bg-video">
            {still ? (
                <img
                    src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
                    alt=""
                    decoding="async"
                    className="bg-video__frame object-cover"
                />
            ) : (
                <iframe
                    // youtube-nocookie: без рекламних cookie; звук вимкнено, керування сховане, по колу.
                    src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&disablekb=1&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&fs=0`}
                    title="background"
                    tabIndex={-1}
                    allow="autoplay; encrypted-media"
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="bg-video__frame"
                />
            )}
            <div className="bg-video__shade" />
        </div>
    );
}

const SCENES: Record<
    Exclude<SiteBackgroundPreset, 'aurora' | 'none' | 'custom'>,
    () => React.ReactNode
> = {
    dune: DuneScene,
    night: NightScene,
    ocean: OceanScene,
    mesh: MeshScene,
};

export function SiteBackground({ className }: { className?: string }) {
    const { auth, siteBackground } = usePage().props;
    const saved = auth.user?.background ?? {
        ...DEFAULT_BACKGROUND,
        preset: siteBackground?.default ? 'custom' : DEFAULT_BACKGROUND.preset,
    };
    const preview = useBackgroundPreview();
    const pageVideo = usePageBackgroundVideo();
    // Порядок: перегляд у налаштуваннях → відеофон сторінки (профіль) → власний вибір.
    const prefs =
        preview ?? (pageVideo ? { ...saved, video: pageVideo } : saved);
    const reduce = useReducedMotion();
    const saveData = useDataSaver();
    const still = !prefs.motion || Boolean(reduce) || saveData;

    if (prefs.video) {
        return (
            <div aria-hidden className={cn('site-bg', className)}>
                <YouTubeScene id={prefs.video} still={still} />
            </div>
        );
    }
    if (prefs.preset === 'custom' && siteBackground) {
        return (
            <div
                aria-hidden
                className={cn('site-bg', still && 'bg-still', className)}
            >
                <ImageScene
                    desktop={siteBackground.desktop}
                    mobile={siteBackground.mobile}
                />
            </div>
        );
    }
    if (prefs.preset === 'aurora') {
        return <Aurora className={cn(still && 'bg-still', className)} />;
    }
    if (prefs.preset === 'none') {
        return (
            <div
                aria-hidden
                className={cn('site-bg bg-background', className)}
            />
        );
    }
    const Scene = SCENES[prefs.preset as keyof typeof SCENES] ?? DuneScene;

    return (
        <div
            aria-hidden
            className={cn('site-bg', still && 'bg-still', className)}
        >
            <Scene />
        </div>
    );
}
