import { tr } from '@/lib/i18n';

/** First Tab stop: jump past the chrome to the page content. */
export function SkipLink() {
    return (
        <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-xl focus:bg-gc-indigo focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
        >
            {tr('До змісту')}
        </a>
    );
}
