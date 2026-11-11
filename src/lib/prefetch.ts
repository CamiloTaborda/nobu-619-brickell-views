/**
 * Anticipa la siguiente vista para que el cambio sea inmediato.
 * Nunca compite con lo que se está mirando: arranca cuando la escena ya está
 * nítida, trabaja de una en una y se cancela al cambiar de escena.
 */
import { capturedLevels, nearestCapture, positionsAt, resolveView } from '../data/catalog';
import type { Panorama, PositionId, TimeOfDay } from '../data/types';
import { getStitched, pickLevel } from './stitch';

interface Task {
  pano: Panorama;
  level: number;
}

const TASK_GAP_MS = 30; // respiro entre vistas para no acaparar conexiones
const DWELL_MS = 220; // detenerse sobre un piso indica intención de entrar

const noop = () => {};
const viewAt = (level: number, position: PositionId, time: TimeOfDay): Panorama | null => {
  const { pano } = resolveView(level, position, time);
  return pano?.pano ? pano : null;
};

/**
 * Prioridad: la otra hora, luego los pisos vecinos y las demás residencias del piso; al final, en
 * escritorio, esas residencias en nítido para que el giro entre ellas llegue ya con detalle.
 */
function planAround(level: number, position: PositionId, time: TimeOfDay): Task[] {
  const tasks: Task[] = [];
  const sharp = (pano: Panorama | null) => {
    if (pano) tasks.push({ pano, level: pickLevel(pano) });
  };

  sharp(viewAt(level, position, time === 'day' ? 'twilight' : 'day'));

  const here = capturedLevels.indexOf(nearestCapture(level));
  for (const neighbor of [capturedLevels[here - 1], capturedLevels[here + 1]]) {
    if (neighbor != null && positionsAt(neighbor).includes(position)) sharp(viewAt(neighbor, position, time));
  }

  const siblings = positionsAt(level)
    .filter((p) => p !== position)
    .map((p) => viewAt(level, p, time))
    .filter((pano): pano is Panorama => pano !== null);
  for (const pano of siblings) tasks.push({ pano, level: 0 });
  if (!matchMedia('(pointer: coarse)').matches) for (const pano of siblings) sharp(pano);
  return tasks;
}

let queue: AbortController | null = null;

export function cancelPrefetch() {
  queue?.abort();
  queue = null;
}

export function prefetchAround(level: number, position: PositionId, time: TimeOfDay) {
  cancelPrefetch();
  const controller = new AbortController();
  queue = controller;

  void (async () => {
    for (const { pano, level: tileLevel } of planAround(level, position, time)) {
      if (controller.signal.aborted) return;
      await getStitched(pano, tileLevel, controller.signal).catch(noop);
      await new Promise((resolve) => setTimeout(resolve, TASK_GAP_MS));
    }
  })();
}

let intent: AbortController | null = null;
let intentId: string | null = null;
let dwellTimer: ReturnType<typeof setTimeout> | undefined;

/** El cursor se posa sobre un piso: se prepara al instante la versión ligera y, si se queda, la nítida. */
export function warmView(level: number, position: PositionId, time: TimeOfDay) {
  const pano = viewAt(level, position, time);
  if (!pano || pano.id === intentId) return;

  clearTimeout(dwellTimer);
  intent?.abort();
  const controller = new AbortController();
  intent = controller;
  intentId = pano.id;

  getStitched(pano, 0, controller.signal).catch(noop);
  dwellTimer = setTimeout(() => getStitched(pano, pickLevel(pano), controller.signal).catch(noop), DWELL_MS);
}
