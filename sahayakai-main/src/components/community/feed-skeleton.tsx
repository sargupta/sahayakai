"use client";

interface FeedSkeletonProps {
  count?: number;
}

export function FeedSkeleton({ count = 4 }: FeedSkeletonProps) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-slate-100 p-4"
        >
          {/* Header: avatar + name + time */}
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-24 rounded bg-slate-100" />
                <div className="h-3 w-1 rounded bg-slate-100" />
                <div className="h-3 w-12 rounded bg-slate-100" />
              </div>
              <div className="h-3 w-32 rounded bg-slate-100" />
            </div>
          </div>

          {/* Badge */}
          <div className="mt-3">
            <div className="h-5 w-20 rounded bg-slate-100" />
          </div>

          {/* Content lines */}
          <div className="mt-3 space-y-2">
            <div className="h-3.5 w-full rounded bg-slate-100" />
            <div className="h-3.5 w-3/4 rounded bg-slate-100" />
            <div className="h-3.5 w-5/6 rounded bg-slate-100" />
          </div>

          {/* Footer: likes, comments, buttons */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-3 w-12 rounded bg-slate-100" />
              <div className="h-3 w-16 rounded bg-slate-100" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-14 rounded bg-slate-100" />
              <div className="h-7 w-16 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
