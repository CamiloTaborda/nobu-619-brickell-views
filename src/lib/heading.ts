/**
 * Ángulos y rumbos.
 *
 * krpano: hlookat (°) 0 = centro de la imagen; vlookat positivo = mirar ABAJO.
 * PSV:    yaw (rad) 0 = centro del equirect; pitch positivo = mirar ARRIBA.
 */
import type { PanoView } from '../data/types';

export const deg2rad = (d: number) => (d * Math.PI) / 180;
export const rad2deg = (r: number) => (r * 180) / Math.PI;
export const norm = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Rumbo en [0, 360) (°, 0 = norte). */
export const toHeading = (degrees: number) => ((degrees % 360) + 360) % 360;

/** Yaw local (°) para mirar al mismo rumbo en otra escena, respetando sus límites. */
export function yawForHeading(heading: number, view: PanoView, northOffset = 0): number {
  return clamp(norm(heading - northOffset), view.hmin, view.hmax);
}
