import { useSyncExternalStore } from 'react';

/** ¿Se cumple la media query? Se actualiza al girar o redimensionar la pantalla. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

/** Mismas condiciones que la variante `compact` de global.css. */
export const COMPACT_QUERY = '(max-width: 760px), (max-height: 560px), (max-aspect-ratio: 1/1)';
