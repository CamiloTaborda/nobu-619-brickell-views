/** Compone los tiles de un nivel del paquete Panotour en un Worker y guarda las vistas decodificadas. */
import type { PanoData } from '@photo-sphere-viewer/core';
import type { Panorama } from '../data/types';
import { tileUrl } from './assetUrl';
import type { CancelRequest, ComposeRequest, ComposeResponse } from './stitch.worker';

export interface StitchResult {
  key: string;
  bitmap: ImageBitmap;
  panoData: PanoData;
  level: number;
  width: number;
  height: number;
}

interface Entry {
  key: string;
  controller: AbortController;
  job: Promise<StitchResult>;
  waiters: number; // interesados en el resultado; sin ninguno, el trabajo se cancela
  image: StitchResult | null;
}

/** Píxeles máximos de una sola vista (en iOS, el tope clásico de canvas). */
const VIEW_PIXELS_DESKTOP = 50_000_000;
const VIEW_PIXELS_TOUCH = 16_700_000;
/** Píxeles guardados en memoria: cada vista ocupa 4 bytes por píxel. */
const CACHE_PIXELS_DESKTOP = 150_000_000;
const CACHE_PIXELS_TOUCH = 40_000_000;

const isTouch = () => matchMedia('(pointer: coarse)').matches;

/**
 * Ancho máximo de textura de la GPU. Lo informa el visor desde su propio contexto WebGL: crear otro
 * solo para preguntarlo bloquea el hilo principal. Hasta entonces se asume 16384 (cualquier GPU actual).
 */
let maxTexture = 16384;
export function setMaxTextureSize(size: number) {
  maxTexture = size;
}

/** Elige el nivel más nítido que cabe en la GPU y en la memoria del dispositivo. */
export function pickLevel(p: Panorama): number {
  const touch = isTouch();
  const maxWidth = Math.min(maxTexture, touch ? 8192 : 16384);
  const budget = touch ? VIEW_PIXELS_TOUCH : VIEW_PIXELS_DESKTOP;
  let best = 0;
  p.pano!.levels.forEach((l, i) => {
    if (l.width <= maxWidth && l.width * l.height <= budget) best = i;
  });
  return best;
}

let worker: Worker | null = null;
let nextJobId = 1;
const pendingJobs = new Map<number, { resolve: (bitmap: ImageBitmap) => void; reject: (error: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./stitch.worker.ts', import.meta.url));
  worker.onmessage = ({ data }: MessageEvent<ComposeResponse>) => {
    const pending = pendingJobs.get(data.id);
    if (!pending) return;
    pendingJobs.delete(data.id);
    if ('bitmap' in data) pending.resolve(data.bitmap);
    else pending.reject(data.error === 'aborted' ? new DOMException('aborted', 'AbortError') : new Error('stitch failed'));
  };
  worker.onerror = () => {
    pendingJobs.forEach(({ reject }) => reject(new Error('stitch worker failed')));
    pendingJobs.clear();
    worker = null;
  };
  return worker;
}

function compose(p: Panorama, levelIndex: number, signal: AbortSignal): Promise<ImageBitmap> {
  const { tileSize } = p.pano!;
  const level = p.pano!.levels[levelIndex];
  const tiles: ComposeRequest['tiles'] = [];
  for (let row = 0; row < Math.ceil(level.height / tileSize); row++)
    for (let col = 0; col < Math.ceil(level.width / tileSize); col++)
      tiles.push({ url: new URL(tileUrl(p.packageBase, level.url, row, col), location.origin).href, x: col * tileSize, y: row * tileSize });

  return new Promise((resolve, reject) => {
    const id = nextJobId++;
    pendingJobs.set(id, { resolve, reject });
    getWorker().postMessage({ id, width: level.width, height: level.height, tiles } satisfies ComposeRequest);
    signal.addEventListener('abort', () => getWorker().postMessage({ cancel: id } satisfies CancelRequest), { once: true });
  });
}

function panoDataFor(p: Panorama, levelIndex: number): PanoData {
  const { hfov, voffset } = p.pano!;
  const { width, height } = p.pano!.levels[levelIndex];
  const ppd = width / hfov; // píxeles por grado
  const fullWidth = Math.round(360 * ppd);
  const fullHeight = Math.round(fullWidth / 2);
  return {
    fullWidth,
    fullHeight,
    croppedWidth: width,
    croppedHeight: height,
    croppedX: Math.round((fullWidth - width) / 2),
    croppedY: Math.round((fullHeight - height) / 2 + voffset * ppd),
  };
}

const cache = new Map<string, Entry>();
let displayed: StitchResult[] = [];

/** Las residencias que comparten foto comparten también entrada de caché. */
const cacheKey = (p: Panorama, level: number) => `${p.source?.file ? `${p.time}:${p.level}:${p.source.file}` : p.id}@${level}`;

/** Libera las vistas menos usadas, sin tocar nunca lo que está en pantalla. */
function evict() {
  const budget = isTouch() ? CACHE_PIXELS_TOUCH : CACHE_PIXELS_DESKTOP;
  let total = 0;
  cache.forEach(({ image }) => {
    if (image) total += image.width * image.height;
  });
  for (const [key, { image }] of cache) {
    if (total <= budget) break;
    if (!image || displayed.includes(image)) continue;
    cache.delete(key);
    image.bitmap.close();
    total -= image.width * image.height;
  }
}

function start(p: Panorama, level: number, key: string): Entry {
  const controller = new AbortController();
  const { width, height } = p.pano!.levels[level];
  const entry: Entry = {
    key,
    controller,
    waiters: 0,
    image: null,
    job: compose(p, level, controller.signal).then((bitmap) => {
      if (controller.signal.aborted) {
        bitmap.close();
        throw new DOMException('aborted', 'AbortError');
      }
      entry.image = { key, bitmap, panoData: panoDataFor(p, level), level, width, height };
      evict();
      return entry.image;
    }),
  };
  entry.job.catch(() => {
    if (cache.get(key) === entry) cache.delete(key);
  });
  cache.set(key, entry);
  return entry;
}

/** La vista ya está compuesta y se puede mostrar sin esperar. */
export const isReady = (p: Panorama, level: number) => Boolean(cache.get(cacheKey(p, level))?.image);

/** Protege de la limpieza las imágenes de la escena actual y de su fundido. */
export function markDisplayed(image: StitchResult) {
  displayed = [image, ...displayed.filter((d) => d !== image)].slice(0, 3);
}

/**
 * Vista compuesta, desde la caché si ya existe. Si se cancelan todas las señales
 * interesadas, el trabajo se detiene; sin señal, siempre llega hasta el final.
 */
export function getStitched(p: Panorama, level: number, signal?: AbortSignal): Promise<StitchResult> {
  const key = cacheKey(p, level);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
  }
  const entry = hit ?? start(p, level, key);

  if (!signal) {
    entry.waiters = Infinity;
  } else {
    entry.waiters++;
    signal.addEventListener(
      'abort',
      () => {
        entry.waiters--;
        if (entry.waiters > 0 || entry.image) return;
        // Síncrono: la siguiente escena no debe encontrarse un trabajo ya cancelado.
        if (cache.get(key) === entry) cache.delete(key);
        entry.controller.abort();
      },
      { once: true },
    );
  }
  return entry.job;
}
