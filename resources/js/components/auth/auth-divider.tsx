/** Тонка лінія з підписом між способами входу: «або поштою». Звичайний регістр — без капсу й розрядки. */
export function AuthDivider({ children }: { children: string }) {
    return (
        <div className="flex items-center gap-3 text-[13px] text-white/40">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/12" />
            {children}
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/12" />
        </div>
    );
}
