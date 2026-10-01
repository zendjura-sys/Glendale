export function PostSkeleton() {
    return (
        <div className="glass space-y-4 rounded-3xl p-5">
            <div className="flex items-center gap-3">
                <span className="skeleton size-11 rounded-full" />
                <span className="flex-1 space-y-2">
                    <span className="skeleton block h-3.5 w-40 rounded" />
                    <span className="skeleton block h-3 w-24 rounded" />
                </span>
            </div>
            <span className="skeleton block h-3.5 w-full rounded" />
            <span className="skeleton block h-3.5 w-4/5 rounded" />
            <span className="skeleton block h-56 w-full rounded-2xl" />
        </div>
    );
}
