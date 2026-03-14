import * as React from 'react';

export interface AdaptiveVideoRailProps {
  activeKey: string | null;
  sources: Record<string, string>;
  overrideSrc?: string | null;
}

export const AdaptiveVideoRail = React.memo(function AdaptiveVideoRail({
  activeKey,
  sources,
  overrideSrc,
}: Readonly<AdaptiveVideoRailProps>) {
  const src = overrideSrc
    ? `${import.meta.env.BASE_URL}${overrideSrc}`
    : activeKey
      ? `${import.meta.env.BASE_URL}${sources[activeKey] ?? ''}`
      : undefined;
  return (
    <div className="fixed right-6 top-24 z-10 hidden w-90 lg:block">
      <div className="overflow-hidden rounded-xl border border-border bg-black/90 shadow-xl">
        <video
          key={(overrideSrc ? `o:${overrideSrc}` : activeKey) ?? 'none'}
          src={src}
          className="h-55 w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={`${import.meta.env.BASE_URL}poster.png`}
        />
        <div className="border-t border-border bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
          {overrideSrc
            ? `Preview: ${overrideSrc}`
            : activeKey
              ? `Now playing: ${activeKey}`
              : 'Scroll to see contextual demos'}
        </div>
      </div>
    </div>
  );
});
