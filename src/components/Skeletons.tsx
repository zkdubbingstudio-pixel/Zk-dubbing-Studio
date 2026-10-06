import React from 'react';

export function HeroSkeleton() {
  return (
    <div className="relative w-full h-[58vh] min-h-[390px] max-h-[490px] sm:h-[65vh] sm:min-h-[500px] lg:h-[70vh] lg:max-h-[780px] bg-[#0a0e17] overflow-hidden">
      <div className="absolute inset-0 skeleton-shimmer opacity-40" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-10 sm:pb-16 md:pb-24">
        <div className="max-w-2xl space-y-3 sm:space-y-4 w-full">
          <div className="w-24 h-6 rounded-full bg-white/10 skeleton-shimmer" />
          <div className="w-3/4 h-12 sm:h-16 rounded-2xl bg-white/10 skeleton-shimmer" />
          <div className="w-full h-16 rounded-xl bg-white/5 skeleton-shimmer" />
          <div className="flex gap-4 pt-4">
            <div className="w-36 h-12 rounded-full bg-[#00e5ff]/20 skeleton-shimmer" />
            <div className="w-36 h-12 rounded-full bg-white/10 skeleton-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden py-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-none w-40 sm:w-48 md:w-56 space-y-3">
          <div className="aspect-[2/3] rounded-2xl bg-white/5 border border-white/10 skeleton-shimmer" />
          <div className="h-4 w-3/4 rounded bg-white/10 skeleton-shimmer" />
          <div className="h-3 w-1/2 rounded bg-white/5 skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

export function SectionSkeleton({ title }: { title: string }) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-white/10 skeleton-shimmer" />
        <div className="w-48 h-8 rounded-lg bg-white/10 skeleton-shimmer" />
      </div>
      <CardSkeleton count={5} />
    </div>
  );
}
