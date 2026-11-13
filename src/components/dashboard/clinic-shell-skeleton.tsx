/**
 * Frame shown while the clinic layout resolves the manager session. It mirrors
 * the real shell (sidebar strip + content column) so the first paint does not
 * jump when the authenticated chrome replaces it.
 */
export function ClinicShellSkeleton() {
  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      <div className="sticky top-0 h-dvh w-16 shrink-0 bg-brand-900 lg:w-60" />
      <div className="flex min-w-0 flex-1 animate-pulse flex-col">
        <div className="h-16 shrink-0 border-b border-line/80 bg-white" />
        <div className="flex-1 space-y-4 p-4 sm:p-6">
          <div className="h-[58px] rounded-xl bg-white" />
          <div className="h-[360px] rounded-xl bg-white" />
        </div>
      </div>
    </div>
  );
}
