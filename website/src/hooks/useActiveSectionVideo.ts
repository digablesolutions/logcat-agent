import * as React from 'react';

/**
 * Observes elements with data-section-key to compute the most visible key.
 */
export function useActiveSectionVideo(debounceMs = 80) {
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  React.useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-section-key]'));
    if (!els.length) return;
    let raf = 0;
    let pending: IntersectionObserverEntry[] | null = null;
    let t: number | null = null;
    const flush = () => {
      if (!pending) return;
      const snapshot = pending;
      pending = null;
      const visible = snapshot
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible[0]) {
        const key = (visible[0].target as HTMLElement).getAttribute('data-section-key');
        if (key) setActiveKey(key);
      }
    };
    const onIntersect: IntersectionObserverCallback = (entries) => {
      pending = entries;
      if (t) window.clearTimeout(t);
      t = window.setTimeout(() => {
        if (!raf)
          raf = requestAnimationFrame(() => {
            raf = 0;
            flush();
          });
      }, debounceMs);
    };
    const obs = new IntersectionObserver(onIntersect, {
      threshold: [0, 0.2, 0.4, 0.6, 0.8, 1],
    });
    els.forEach((el) => obs.observe(el));
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (t) window.clearTimeout(t);
      obs.disconnect();
    };
  }, [debounceMs]);
  return activeKey;
}
