export function MissionsSkeleton() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 animate-pulse flex-col bg-surface">
        <div className="border-b border-line/80 bg-white px-3 py-2.5 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="h-2 w-28 rounded bg-surface-strong" />
              <div className="h-4 w-52 rounded bg-surface-strong" />
              <div className="hidden h-2 w-64 rounded bg-surface-strong sm:block" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-[9.75rem] rounded-full bg-surface-strong" />
              <div className="h-10 w-28 rounded-full bg-surface-strong" />
            </div>
          </div>
        </div>
        <div className="space-y-2.5 p-3 sm:p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-[72px] rounded-xl border border-line/70 bg-white" />
            ))}
          </div>
          <div className="h-[76px] rounded-xl border border-line/70 bg-white" />
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="h-[250px] rounded-xl border border-line/70 bg-white" />
            <div className="h-[250px] rounded-xl border border-line/70 bg-white" />
          </div>
          <div className="h-[380px] rounded-xl border border-line/70 bg-white" />
        </div>
      </div>
  );
}
