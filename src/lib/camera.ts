/**
 * Límites de cámara de las panorámicas parciales.
 * - Ancho de `pano.view` (los bordes de la foto) y todo el alto real de la foto con margen; el rango
 *   vertical de Inflight es solo encuadre y se usa como inclinación de reposo.
 * - Zoom común a todas las vistas: el que cabe en la más estrecha.
 * - Sin zoom solo gira en horizontal; al acercar se libera la inclinación.
 *
 * El giro permitido se calcula con las esquinas reales de la pantalla. En una
 * proyección rectilínea con la cámara inclinada, las esquinas más cercanas al
 * polo abarcan más ángulo que el centro del borde; ignorarlo deja ver una cuña
 * negra fuera de la foto al llegar a los extremos.
 */
import type { PanoMeta, PanoView } from '../data/types';
import { clamp, deg2rad, rad2deg } from './heading';

/** Margen para que el borde de la malla de la esfera nunca entre en pantalla (°). */
const EDGE_MARGIN = 0.75;
/** Margen respecto al borde superior e inferior de la foto (°). */
const PHOTO_MARGIN = 2;
const MIN_USEFUL_FOV = 20;
const ENTRY_PAN_ROOM = 3; // grados libres a cada lado, en la toma más estrecha, con el zoom de entrada
const TILT_RAMP = 10; // grados de zoom en los que la inclinación pasa de fija a libre
const TILT_NOTICEABLE = 0.5; // por debajo de este rango (°) no se percibe inclinación

/** Límites de una toma (convención krpano: v positivo = abajo) e inclinación de reposo. */
export interface CameraView extends PanoView {
  restPitch: number; // °, positivo = arriba
}

export function cameraView({ view, vfov, voffset }: PanoMeta): CameraView {
  return {
    ...view,
    vmin: Math.min(view.vmin, voffset - vfov / 2 + PHOTO_MARGIN),
    vmax: Math.max(view.vmax, voffset + vfov / 2 - PHOTO_MARGIN),
    restPitch: -(view.vmin + view.vmax) / 2,
  };
}

/** Ángulo horizontal real que abarca media pantalla, medido en sus esquinas (°). */
function halfYawExtent(vFov: number, aspect: number, pitch: number): number {
  const halfV = Math.tan(deg2rad(vFov) / 2);
  const tilt = Math.abs(deg2rad(pitch));
  const depth = Math.cos(tilt) - halfV * Math.sin(tilt);
  return depth <= 0 ? 180 : rad2deg(Math.atan2(aspect * halfV, depth));
}

/** Yaw mínimo y máximo con los que toda la pantalla queda dentro de la foto (°). */
function yawBounds(view: CameraView, vFov: number, aspect: number, pitch = view.restPitch) {
  const half = halfYawExtent(vFov, aspect, pitch) + EDGE_MARGIN;
  const min = view.hmin + half;
  const max = view.hmax - half;
  return min <= max ? { min, max } : { min: (view.hmin + view.hmax) / 2, max: (view.hmin + view.hmax) / 2 };
}

/**
 * Mayor campo de visión vertical que cabe entero en la toma, con la inclinación de reposo y
 * este formato de pantalla (°). Con `panRoom`, además deja ese margen a cada lado para girar.
 */
function maxFovFor(view: CameraView, aspect: number, panRoom = 0): number {
  const horizontalRoom = (view.hmax - view.hmin) / 2 - EDGE_MARGIN - panRoom;
  const fits = (fov: number) =>
    halfYawExtent(fov, aspect, view.restPitch) <= horizontalRoom &&
    view.restPitch + fov / 2 + EDGE_MARGIN <= -view.vmin &&
    view.restPitch - fov / 2 - EDGE_MARGIN >= -view.vmax;

  let high = view.fovmax;
  if (fits(high)) return high;
  let low = MIN_USEFUL_FOV;
  for (let i = 0; i < 24; i++) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return low;
}

/** Zoom común a un conjunto de tomas: el más abierto que cabe en todas y el de entrada (°). */
export function sharedFov(views: CameraView[], aspect: number) {
  return {
    max: Math.min(...views.map((v) => maxFovFor(v, aspect))),
    rest: Math.min(...views.map((v) => maxFovFor(v, aspect, ENTRY_PAN_ROOM))),
  };
}

/**
 * Inclinación mínima y máxima para este zoom (°). Con el zoom de reposo (`rest`) o más
 * abierto ambas son la inclinación de reposo; al acercar se abren de forma progresiva.
 */
function pitchBounds(view: CameraView, vFov: number, aspect: number, rest: number) {
  const locked = view.restPitch;
  const freedom = clamp((rest - vFov) / TILT_RAMP, 0, 1);
  if (freedom === 0) return { min: locked, max: locked };

  // Inclinar ensancha el encuadre en horizontal: no se puede llegar a donde ya no quepa de lado a lado.
  const horizontalRoom = (view.hmax - view.hmin) / 2 - EDGE_MARGIN;
  const fits = (pitch: number) => halfYawExtent(vFov, aspect, pitch) <= horizontalRoom;
  const reachable = (limit: number) => {
    if (fits(limit)) return limit;
    let inside = locked;
    let outside = limit;
    for (let i = 0; i < 24; i++) {
      const middle = (inside + outside) / 2;
      if (fits(middle)) inside = middle;
      else outside = middle;
    }
    return inside;
  };

  const half = vFov / 2 + EDGE_MARGIN;
  const toward = (limit: number) => locked + (reachable(limit) - locked) * freedom;
  return { min: toward(Math.min(locked, -view.vmax + half)), max: toward(Math.max(locked, -view.vmin - half)) };
}

/** ¿Este zoom permite mirar arriba y abajo? */
export function canTilt(view: CameraView, vFov: number, aspect: number, rest: number): boolean {
  const { min, max } = pitchBounds(view, vFov, aspect, rest);
  return max - min > TILT_NOTICEABLE;
}

/** Orientación válida más cercana (°): primero la inclinación, porque de ella depende el giro permitido. */
export function clampView(view: CameraView, yaw: number, pitch: number, vFov: number, aspect: number, rest: number) {
  const vertical = pitchBounds(view, vFov, aspect, rest);
  const safePitch = clamp(pitch, vertical.min, vertical.max);
  const horizontal = yawBounds(view, vFov, aspect, safePitch);
  return { yaw: clamp(yaw, horizontal.min, horizontal.max), pitch: safePitch };
}
