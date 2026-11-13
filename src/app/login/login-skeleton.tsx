import { BrandMark } from "@/components/brand-mark";

export function LoginSkeleton() {
  return (
    <div className="flex min-h-dvh animate-pulse flex-col">
      <div className="border-b border-line/80 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <BrandMark tagline="Hospital transport workspace" />
          <div className="h-10 w-[9.75rem] rounded-full bg-surface-strong" />
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-12">
        <div className="hidden h-[34rem] rounded-[2rem] bg-surface-strong lg:block" />
        <div className="w-full max-w-md justify-self-center lg:justify-self-end">
          <div className="rounded-[1.75rem] border border-line/70 bg-white p-6 shadow-card sm:p-8">
            <div className="h-6 w-40 rounded-full bg-surface-strong" />
            <div className="mt-5 h-8 w-32 rounded-lg bg-surface-strong" />
            <div className="mt-2 h-4 w-64 rounded bg-surface" />
            <div className="mt-8 space-y-4">
              <div className="h-12 rounded-xl bg-surface" />
              <div className="h-12 rounded-xl bg-surface" />
              <div className="h-12 rounded-xl bg-brand-100" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
