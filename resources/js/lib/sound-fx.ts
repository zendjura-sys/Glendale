/**
 * Звуки інтерфейсу GameCon: синтез на Web Audio API, без жодних mp3.
 * Дуже тихі (щоб не перебивати музику в плеєрі), вимикаються в меню «Система» →
 * «Звуки інтерфейсу» і не грають, якщо людина просить менше руху.
 */

const SETTING = 'gc_ui_sounds';
const BOOT_FLAG = 'gc_boot_sound_played';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (ctx) return ctx;
    const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
    if (!Ctor) return null;
    try {
        ctx = new Ctor();
    } catch {
        return null;
    }

    return ctx;
}

/** Чи дозволені звуки: налаштування людини й «менше руху». */
export function soundsEnabled(): boolean {
    try {
        if (localStorage.getItem(SETTING) === 'off') return false;
    } catch {
        // Без сховища — за замовчуванням увімкнено.
    }

    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function setSoundsEnabled(on: boolean): void {
    try {
        localStorage.setItem(SETTING, on ? 'on' : 'off');
    } catch {
        // Приватне вікно — вибір до перезавантаження.
    }
}

/** Мʼякий акорд входу: C5 + G5, що переходить у C6 через 120 мс; пік 0,06 і згасання за 650 мс. */
export function playBootChime(): void {
    const ac = audio();
    if (!ac || !soundsEnabled()) return;
    const now = ac.currentTime;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    gain.connect(ac.destination);

    const low = ac.createOscillator();
    low.type = 'sine';
    low.frequency.setValueAtTime(523.25, now);
    const high = ac.createOscillator();
    high.type = 'triangle';
    high.frequency.setValueAtTime(783.99, now);
    high.frequency.setValueAtTime(783.99, now + 0.12);
    high.frequency.linearRampToValueAtTime(1046.5, now + 0.2);

    for (const osc of [low, high]) {
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.7);
    }
}

/** Ледь чутне клацання при переході між головними вкладками: 18 мс, 320 → 180 Гц. */
export function playNavTick(): void {
    const ac = audio();
    if (!ac || ac.state !== 'running' || !soundsEnabled()) return;
    const now = ac.currentTime;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
    gain.connect(ac.destination);
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.018);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.02);
}

/**
 * Привітальний акорд — раз за сесію вкладки. Браузер не дає грати звук до першого жесту:
 * якщо контекст призупинено, граємо на першому дотику чи клавіші.
 */
export function bootChimeOnce(): void {
    try {
        if (sessionStorage.getItem(BOOT_FLAG) === '1') return;
    } catch {
        // Без сховища — граємо, але лише в цьому завантаженні.
    }
    if (!soundsEnabled()) return;
    const ac = audio();
    if (!ac) return;
    const play = () => {
        try {
            sessionStorage.setItem(BOOT_FLAG, '1');
        } catch {
            // ігноруємо
        }
        playBootChime();
    };
    if (ac.state === 'running') {
        play();

        return;
    }
    const unlock = () => {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        void ac.resume().then(play);
    };
    window.addEventListener('pointerdown', unlock, {
        once: true,
        passive: true,
    });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
}
