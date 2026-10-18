import { useEffect, useState } from 'react';

/**
 * Основний колір обложки (для тла плеєра). Зменшуємо картинку до 12×12 і беремо середнє
 * насичених пікселів. Обкладинки з чужих доменів без CORS малювати на canvas не можна —
 * тоді повертаємо null і плеєр бере акцент теми.
 */
const cache = new Map<string, string | null>();

function extract(image: HTMLImageElement): string | null {
    const size = 12;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    let r = 0;
    let g = 0;
    let b = 0;
    let weight = 0;

    for (let i = 0; i < data.length; i += 4) {
        const max = Math.max(data[i], data[i + 1], data[i + 2]);
        const min = Math.min(data[i], data[i + 1], data[i + 2]);
        // Сірі й майже чорні пікселі майже не впливають — інакше колір виходить брудним.
        const w = (max - min) / 255 + 0.05;
        r += data[i] * w;
        g += data[i + 1] * w;
        b += data[i + 2] * w;
        weight += w;
    }

    if (weight === 0) return null;

    return `${Math.round(r / weight)} ${Math.round(g / weight)} ${Math.round(b / weight)}`;
}

export function useCoverColor(url: string | null | undefined): string | null {
    const [color, setColor] = useState<string | null>(() =>
        url ? (cache.get(url) ?? null) : null,
    );

    useEffect(() => {
        if (!url) {
            setColor(null);

            return;
        }
        if (cache.has(url)) {
            setColor(cache.get(url) ?? null);

            return;
        }
        let alive = true;
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.decoding = 'async';
        image.onload = () => {
            let value: string | null = null;
            try {
                value = extract(image);
            } catch {
                value = null; // canvas «забруднено» чужою картинкою
            }
            cache.set(url, value);
            if (alive) setColor(value);
        };
        image.onerror = () => {
            cache.set(url, null);
            if (alive) setColor(null);
        };
        image.src = url;

        return () => {
            alive = false;
        };
    }, [url]);

    return color;
}
