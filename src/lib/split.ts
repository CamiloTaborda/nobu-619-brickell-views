/**
 * Plano ampliado: la pantalla se reparte a medias entre la vista y el panel de planos.
 * `split` va de 0 (panel lateral) a 1 (mitad y mitad) y se publica como `--split` en la sección del
 * visor: panel, controles y visor calculan su geometría con él, sin volver a renderizar React.
 */
import { motionValue } from 'motion/react';
import { useApp } from '../app/store';
import { useMediaQuery } from './useMediaQuery';

export const split = motionValue(0);

/** Solo donde media pantalla es claramente más que el panel lateral; coincide con los cortes del HUD. */
export const SPLIT_QUERY = '(min-width: 1181px) and (min-height: 561px) and (min-aspect-ratio: 1001/1000)';

/** ¿El plano está ampliado ahora mismo? */
export function useSplit(): boolean {
  const open = useApp((s) => s.plansOpen);
  const wide = useApp((s) => s.plansWide);
  const allowed = useMediaQuery(SPLIT_QUERY);
  return open && wide && allowed;
}
