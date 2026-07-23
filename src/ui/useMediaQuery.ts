import { useEffect, useState } from 'react';

/**
 * Viewport width (px) below which the two-pane exercise view collapses to a
 * single stacked column. Shared so the layout switch and the SplitPane mount
 * decision agree on one number.
 */
export const STACK_BELOW = 900;

/**
 * Subscribe to a CSS media query and re-render when its match state flips.
 *
 * The initial value defaults to the desktop side (`initial = true`) rather than
 * reading `matchMedia` lazily-but-wrong, so a desktop first paint doesn't flash
 * the stacked mobile layout before settling. Environments without `matchMedia`
 * (SSR, tests) just keep `initial`.
 *
 * @param query A CSS media query, e.g. `(min-width: 900px)`.
 * @param initial Value to assume before the first real match is read.
 * @returns Whether the query currently matches.
 */
export function useMediaQuery(query: string, initial = true): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return initial;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange(); // sync in case the query changed between render and effect
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
