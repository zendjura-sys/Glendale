import {
    motion,
    useReducedMotion,
    useSpring,
    useTransform,
} from 'motion/react';
import { useEffect, useMemo } from 'react';

/**
 * Фон сторінок входу: темна «підлога» з гранованих плит у легкій перспективі.
 * Це єдине 3D на сторінці, тож воно тьмяне й повільне: плити ледь відстежують курсор
 * і повільно дрейфують. Без WebGL — одна SVG у CSS-перспективі.
 */

const COLS = 14;
const ROWS = 9;
const W = 1600;
const H = 1000;

/** Детермінований псевдовипадок, щоб плити не «стрибали» між рендерами. */
function rand(seed: number): number {
    const x = Math.sin(seed * 9301 + 49297) * 233280;

    return x - Math.floor(x);
}

type Facet = { points: string; shade: number };

function facets(): Facet[] {
    const cw = W / COLS;
    const ch = H / ROWS;
    // Вузли сітки зі зсувом — грані виходять неправильної форми, як колотий камінь.
    const node = (c: number, r: number): [number, number] => {
        const edge = c === 0 || r === 0 || c === COLS || r === ROWS;
        const jx = edge ? 0 : (rand(c * 31 + r * 7) - 0.5) * cw * 0.7;
        const jy = edge ? 0 : (rand(c * 17 + r * 13 + 5) - 0.5) * ch * 0.7;

        return [c * cw + jx, r * ch + jy];
    };
    const out: Facet[] = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const a = node(c, r);
            const b = node(c + 1, r);
            const d = node(c, r + 1);
            const e = node(c + 1, r + 1);
            const flip = rand(c * 3 + r * 11) > 0.5;
            const tris = flip
                ? [
                      [a, b, e],
                      [a, e, d],
                  ]
                : [
                      [a, b, d],
                      [b, e, d],
                  ];
            tris.forEach((tri, i) => {
                // Світло зверху-ліворуч: грані ближче до нього трохи світліші.
                const light = 1 - (c / COLS) * 0.35 - (r / ROWS) * 0.45;
                const shade = Math.max(
                    0,
                    light * (0.55 + rand(c * 5 + r * 19 + i) * 0.45),
                );
                out.push({
                    points: tri
                        .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
                        .join(' '),
                    shade,
                });
            });
        }
    }

    return out;
}

export function AuthBackdrop() {
    const reduce = useReducedMotion();
    const list = useMemo(facets, []);
    const rx = useSpring(0, { stiffness: 40, damping: 18 });
    const ry = useSpring(0, { stiffness: 40, damping: 18 });
    // Базовий нахил «підлоги» + невелике відхилення від курсора.
    const tiltX = useTransform(rx, (v) => 58 + v);

    useEffect(() => {
        if (reduce) return;
        const move = (e: PointerEvent) => {
            // Зовсім трохи: ±1.5° — щоб відчувався об’єм, а не «ефект».
            rx.set((e.clientY / window.innerHeight - 0.5) * -3);
            ry.set((e.clientX / window.innerWidth - 0.5) * 3);
        };
        window.addEventListener('pointermove', move, { passive: true });

        return () => window.removeEventListener('pointermove', move);
    }, [reduce, rx, ry]);

    return (
        <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-void"
        >
            {/* Aurora: повільне кольорове сяйво під «підлогою»; колір — з палітри акаунта. */}
            <div className="absolute -top-[25%] left-[8%] h-[70vmax] w-[70vmax] animate-aurora rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_55%,transparent),transparent_62%)] opacity-35 blur-[110px]" />
            <div className="absolute -top-[10%] right-[-18%] h-[60vmax] w-[60vmax] animate-aurora rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-gc-purple)_60%,transparent),transparent_62%)] opacity-25 blur-[120px] [animation-delay:-9s]" />
            <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent_12%,#000_45%)] [perspective:1100px]">
                <motion.div
                    className="absolute -inset-x-[20%] top-[18%] -bottom-[40%] origin-top"
                    style={{ rotateX: tiltX, rotateY: ry, rotateZ: -6 }}
                >
                    <svg
                        viewBox={`0 0 ${W} ${H}`}
                        preserveAspectRatio="xMidYMid slice"
                        className="auth-floor size-full"
                    >
                        {list.map((f, i) => (
                            <polygon
                                key={i}
                                points={f.points}
                                fill={`rgb(${Math.round(12 + f.shade * 22)} ${Math.round(14 + f.shade * 24)} ${Math.round(24 + f.shade * 36)})`}
                                stroke="rgb(3 5 12)"
                                strokeWidth="2.2"
                                strokeLinejoin="round"
                            />
                        ))}
                    </svg>
                </motion.div>
            </div>
            {/* Світло акценту зверху й затемнення до країв: плити тонуть у темряві. */}
            <div className="absolute inset-x-0 -top-[30%] h-[80%] bg-[radial-gradient(ellipse_at_50%_30%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_65%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_35%,var(--color-void)_95%)]" />
        </div>
    );
}
