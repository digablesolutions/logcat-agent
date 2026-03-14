import * as React from 'react';

/**
 * Attaches IntersectionObserver for elements with the .reveal-up class to toggle .in-view.
 */
export function useIntersectionReveals() {
  React.useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal-up'));
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) (e.target as HTMLElement).classList.add('in-view');
        });
      },
      { threshold: 0.25 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}
