/**
 * Visor de panorámicas parciales. Reglas de cámara en lib/camera.ts.
 * Transiciones: el fotograma saliente se congela y se funde (piso u hora) o se desliza en el sentido
 * del giro (residencia) mientras la vista entrante gira dentro de su foto. Las dos imágenes son
 * siempre encuadres válidos: un barrido de cámara entre dos fotos atravesaría zonas sin imagen.
 */
import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { Viewer, type Position } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';
import { useApp } from '../../app/store';
import { panoramas, resolveView } from '../../data/catalog';
import type { PanoMeta, Panorama } from '../../data/types';
import { getStitched, isReady, markDisplayed, pickLevel, setMaxTextureSize, type StitchResult } from '../../lib/stitch';
import { cancelPrefetch, prefetchAround } from '../../lib/prefetch';
import { cameraView, canTilt, clampView, sharedFov, type CameraView } from '../../lib/camera';
import { clamp, deg2rad, norm, rad2deg, toHeading, yawForHeading } from '../../lib/heading';
import { springSheet } from '../../lib/motion';
import { split, useSplit } from '../../lib/split';
import { StitchedAdapter, toPanorama } from './StitchedAdapter';

const ABSOLUTE_MIN_FOV = 15;
const EPSILON = 1e-6;
const ENTRY = { speed: 700, rotation: false, effect: 'fade' } as const; // primera escena, desde la portada
const SHARPEN = { speed: 400, rotation: false, effect: 'fade' } as const;
const FADE_MS = 650;
const TURN_SWEEP = 26; // ° que gira la imagen entrante hasta su encuadre
const TURN_SLIDE = 0.24; // fracción del ancho que se desliza la imagen saliente
const TURN_MIN_MS = 850;
const TURN_MAX_MS = 1350;
const TURN_MS_PER_DEGREE = 2.6;
const EASE = 'cubic-bezier(0.45, 0, 0.2, 1)';
const FREEZE_TIMEOUT_MS = 120; // si no llega un fotograma (pestaña oculta), la vista cambia sin capa

/**
 * Tamaño del visor. Al entrar desde la portada el contenedor puede medir 0 durante un instante;
 * como el visor ocupa toda la ventana, entonces vale el tamaño de la ventana.
 */
function sizeOf(viewer: Viewer) {
  const { width, height } = viewer.getSize();
  return width > 0 && height > 0 ? { width, height } : { width: innerWidth, height: innerHeight };
}

const aspectOf = (viewer: Viewer) => {
  const { width, height } = sizeOf(viewer);
  return width / height;
};

const views = new WeakMap<PanoMeta, CameraView>();
const viewOf = (p: Panorama): CameraView => {
  const meta = p.pano!;
  if (!views.has(meta)) views.set(meta, cameraView(meta));
  return views.get(meta)!;
};

/**
 * Zoom común a todas las vistas para este tamaño de pantalla: el más abierto que cabe en la toma
 * más estrecha, el de entrada y el más cerrado que no pixela ninguna foto.
 */
const limitsCache = new Map<string, { maxFov: number; restFov: number; minFov: number }>();
function limitsOf(viewer: Viewer) {
  const { width, height } = sizeOf(viewer);
  const key = `${width}x${height}@${devicePixelRatio}`;
  const cached = limitsCache.get(key);
  if (cached) return cached;
  const oriented = panoramas.filter((p) => p.pano);
  const shared = sharedFov(oriented.map(viewOf), width / height);
  const pixels = height * Math.min(devicePixelRatio, 2);
  const sharpest = Math.max(...oriented.map((p) => pixels / ((p.pano!.levels[pickLevel(p)].width / p.pano!.hfov) * 1.5)));
  const limits = { maxFov: shared.max, restFov: shared.rest, minFov: Math.min(Math.max(sharpest, ABSOLUTE_MIN_FOV), shared.max - 5) };
  limitsCache.set(key, limits);
  return limits;
}

function applyLimits(viewer: Viewer) {
  const { maxFov, minFov } = limitsOf(viewer);
  if (viewer.config.maxFov !== maxFov) viewer.setOption('maxFov', maxFov);
  if (viewer.config.minFov !== minFov) viewer.setOption('minFov', minFov);
}

/**
 * Marco común: el yaw del visor es el rumbo real (0 = norte); una foto sin calibrar queda en su propio marco.
 * En Photo Sphere Viewer el pan desplaza la foto en sentido contrario al yaw.
 */
const northOf = (p: Panorama) => p.northOffset ?? 0;
const correctionOf = (p: Panorama) => ({ pan: deg2rad(-northOf(p)) });
const toRadians360 = (degrees: number) => deg2rad(toHeading(degrees));

/** Orientación válida (en el marco de la foto, °) para el zoom dado. */
function clampFor(viewer: Viewer, p: Panorama, yaw: number, pitch: number, fov: number) {
  return clampView(viewOf(p), yaw, pitch, fov, aspectOf(viewer), limitsOf(viewer).restFov);
}

/** La posición válida más cercana para el zoom dado: toda la pantalla dentro de la foto. */
function constrain(viewer: Viewer, p: Panorama, position: Position, zoomLevel = viewer.getZoomLevel()): Position {
  const north = northOf(p);
  const safe = clampFor(viewer, p, norm(rad2deg(position.yaw) - north), rad2deg(position.pitch), viewer.dataHelper.zoomLevelToFov(zoomLevel));
  return { yaw: toRadians360(safe.yaw + north), pitch: deg2rad(safe.pitch) };
}

const toWorld = (p: Panorama, view: { yaw: number; pitch: number }): Position => ({ yaw: toRadians360(view.yaw + northOf(p)), pitch: deg2rad(view.pitch) });

/** Duración del giro entre residencias: proporcional al ángulo, siempre pausada. */
const turnDuration = (degrees: number) => Math.min(TURN_MAX_MS, TURN_MIN_MS + Math.abs(degrees) * TURN_MS_PER_DEGREE);

/** El cursor anuncia si este zoom permite mirar arriba y abajo. */
function showTilt(viewer: Viewer, p: Panorama, host: HTMLElement) {
  host.dataset.tilt = String(canTilt(viewOf(p), viewer.dataHelper.zoomLevelToFov(viewer.getZoomLevel()), aspectOf(viewer), limitsOf(viewer).restFov));
}

const isOutside = (a: Position, b: Position) => Math.abs(norm(rad2deg(a.yaw - b.yaw))) > EPSILON || Math.abs(a.pitch - b.pitch) > EPSILON;

/**
 * Congela el fotograma en pantalla en la capa de transición. Se captura en el evento `render`, justo
 * tras dibujar y antes de que el navegador presente el búfer: así no hace falta `preserveDrawingBuffer`
 * (coste en cada fotograma) ni una lectura síncrona que detenga la GPU.
 */
function freezeFrame(viewer: Viewer, host: HTMLElement, layer: HTMLCanvasElement): Promise<boolean> {
  const source = host.querySelector('canvas');
  if (!source?.width) return Promise.resolve(false);
  return new Promise((resolve) => {
    const fallback = setTimeout(() => finish(null), FREEZE_TIMEOUT_MS);
    const finish = (bitmap: ImageBitmap | null) => {
      clearTimeout(fallback);
      viewer.removeEventListener('render', capture);
      if (!bitmap) return resolve(false);
      layer.getAnimations().forEach((a) => a.cancel());
      layer.width = bitmap.width;
      layer.height = bitmap.height;
      layer.getContext('bitmaprenderer')!.transferFromImageBitmap(bitmap);
      layer.style.opacity = '1';
      layer.style.transform = 'none';
      resolve(true);
    };
    const capture = () => {
      createImageBitmap(source).then(finish, () => finish(null));
    };
    viewer.addEventListener('render', capture, { once: true });
    viewer.needsUpdate();
  });
}

/**
 * Encaja el visor en su media pantalla, o lo libera. Mientras el panel se anima, el visor solo se
 * desplaza (sin redimensionar WebGL en cada fotograma); el cambio de tamaño real ocurre al principio
 * del siguiente fotograma de Photo Sphere Viewer, que se redibuja en ese mismo fotograma. Con el mismo
 * alto y el mismo campo de visión, la imagen resultante es idéntica: el cambio no se ve.
 */
function dock(viewer: Viewer, stage: HTMLElement, docked: boolean): Promise<void> {
  if (stage.hasAttribute('data-docked') === docked) return Promise.resolve();
  return new Promise((resolve) => {
    const swap = () => {
      viewer.removeEventListener('before-render', swap);
      stage.toggleAttribute('data-docked', docked);
      viewer.autoSize();
      resolve();
    };
    viewer.addEventListener('before-render', swap);
  });
}

export default function PanoViewer() {
  const stage = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLDivElement>(null);
  const frozen = useRef<HTMLCanvasElement>(null); // fotograma saliente durante las transiciones
  const viewer = useRef<Viewer | null>(null);
  const current = useRef<Panorama | null>(null); // escena en pantalla: manda sobre los gestos
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const level = useApp((s) => s.level);
  const position = useApp((s) => s.position);
  const time = useApp((s) => s.time);
  const splitWanted = useSplit();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!el.current) return;
    const v = new Viewer({
      container: el.current,
      adapter: StitchedAdapter,
      navbar: false,
      loadingTxt: '',
      canvasBackground: '#0b0b0c',
      defaultZoomLvl: 30,
      moveInertia: 0.9,
      mousewheelCtrlKey: false,
      keyboard: false,
    });
    // Pedir 'webgl2' a un lienzo que ya lo tiene devuelve el contexto existente, sin crear otro.
    const gl = el.current.querySelector('canvas')?.getContext('webgl2');
    if (gl) setMaxTextureSize(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
    applyLimits(v);

    const keepInside = () => {
      const scene = current.current;
      if (!scene) return;
      const here = v.getPosition();
      const safe = constrain(v, scene, here);
      if (isOutside(here, safe)) v.rotate(safe);
      if (el.current) showTilt(v, scene, el.current);
    };

    v.addEventListener('before-rotate', (e) => {
      if (current.current) e.position = constrain(v, current.current, e.position);
    });
    v.addEventListener('before-animate', (e) => {
      if (current.current && e.position) e.position = constrain(v, current.current, e.position, e.zoomLevel);
    });
    v.addEventListener('position-updated', ({ position: here }) => {
      const scene = current.current;
      if (!scene) return;
      const safe = constrain(v, scene, here);
      if (isOutside(here, safe)) {
        v.rotate(safe);
        return;
      }
      useApp.getState().setHeading(toHeading(rad2deg(here.yaw)));
    });
    // Alejar el zoom o cambiar de tamaño ensancha el encuadre: hay que recolocarlo. Al alejar, la
    // inclinación vuelve sola a su sitio porque su rango se estrecha de forma continua.
    v.addEventListener('zoom-updated', keepInside);
    // Al cambiar de tamaño se conserva el campo de visión exacto (Photo Sphere Viewer lo redondearía a
    // un nivel entero): así encajar el visor en media pantalla no altera la imagen.
    v.addEventListener('size-updated', () => {
      const fov = v.dataHelper.zoomLevelToFov(v.getZoomLevel());
      applyLimits(v);
      const { minFov, maxFov } = limitsOf(v);
      v.zoom(((maxFov - clamp(fov, minFov, maxFov)) / (maxFov - minFov)) * 100);
      keepInside();
    });

    viewer.current = v;
    return () => {
      v.destroy();
      viewer.current = null;
      current.current = null;
    };
  }, []);

  // Plano ampliado: al abrirse, el panel crece y después el visor se encaja en su mitad; al cerrarse,
  // primero se libera y después el panel vuelve. Así el visor nunca deja un hueco junto al panel.
  useEffect(() => {
    const v = viewer.current;
    const host = stage.current;
    if (!v || !host) return;
    let live = true;
    const transition = reduceMotion ? { duration: 0 } : springSheet;
    void (async () => {
      if (splitWanted) {
        await animate(split, 1, transition);
        if (live) await dock(v, host, true);
      } else {
        await dock(v, host, false);
        if (live) await animate(split, 0, transition);
      }
    })();
    return () => {
      live = false;
    };
  }, [splitWanted, reduceMotion]);

  useEffect(() => {
    const v = viewer.current;
    if (!v || level == null) return;
    const { pano } = resolveView(level, position, time);
    if (!pano?.pano) {
      setFailed(true);
      return;
    }
    const ac = new AbortController();
    setFailed(false);

    const previous = current.current;
    const previousPitch = previous ? rad2deg(v.getPosition().pitch) : null;
    // Otra residencia del mismo piso y hora: la cámara gira hacia donde mira esa residencia.
    const turning = previous !== null && previous.level === pano.level && previous.time === pano.time && previous.position !== pano.position;
    const oriented = previous?.northOffset != null && pano.northOffset != null;
    const { view } = pano.pano;

    const reveal = async (image: StitchResult) => {
      applyLimits(v);
      // El zoom se conserva exacto: todas las vistas comparten su rango.
      const fov = previous ? v.dataHelper.zoomLevelToFov(v.getZoomLevel()) : limitsOf(v).restFov;
      const heading = useApp.getState().heading;
      const aimYaw = turning || heading == null ? view.h : yawForHeading(heading, view, pano.northOffset);
      const aimPitch = turning || previousPitch == null ? viewOf(pano).restPitch : previousPitch;
      const target = clampFor(v, pano, aimYaw, aimPitch, fov);
      markDisplayed(image);

      if (!previous) {
        await v.setPanorama(toPanorama(image), { transition: ENTRY, position: toWorld(pano, target), zoom: v.dataHelper.fovToZoomLevel(fov), sphereCorrection: correctionOf(pano), showLoader: false });
        if (ac.signal.aborted) return;
        current.current = pano;
        return;
      }

      // Giro entre residencias: hacia dónde gira la cámara y desde dónde entra la nueva imagen.
      const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const arc = norm(rad2deg(toWorld(pano, target).yaw - v.getPosition().yaw));
      const direction = arc < 0 ? -1 : 1;
      const sweep = turning && oriented && !reduceMotion;
      const start = sweep ? clampFor(v, pano, target.yaw - direction * TURN_SWEEP, target.pitch, fov) : target;
      const duration = sweep ? turnDuration(arc) : FADE_MS;

      const layer = frozen.current;
      const covered = layer && el.current ? await freezeFrame(v, el.current, layer) : false;
      if (ac.signal.aborted) return;
      current.current = pano;
      await v.setPanorama(toPanorama(image), { transition: false, position: toWorld(pano, start), sphereCorrection: correctionOf(pano), showLoader: false });
      if (ac.signal.aborted) return;

      if (sweep) v.animate({ ...toWorld(pano, target), speed: duration });
      if (covered && layer) {
        const out = sweep ? `translateX(${-direction * TURN_SLIDE * 100}%)` : 'none';
        await layer.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: out }], { duration, easing: EASE, fill: 'forwards' }).finished.catch(() => {});
      }
    };

    const settle = () => {
      v.rotate(v.getPosition());
      // Sin movimiento no hay 'position-updated': el rumbo de entrada se publica aquí para la brújula y la URL.
      useApp.getState().setHeading(toHeading(rad2deg(v.getPosition().yaw)));
      if (el.current) showTilt(v, pano, el.current);
      useApp.getState().setViewReady(true);
    };

    const run = async () => {
      const target = pickLevel(pano);
      setLoading(true);
      if (isReady(pano, target) || target === 0) {
        await reveal(await getStitched(pano, target, ac.signal));
        if (ac.signal.aborted) return;
        settle();
      } else {
        await reveal(await getStitched(pano, 0, ac.signal));
        if (ac.signal.aborted) return;
        settle();
        const sharp = await getStitched(pano, target, ac.signal);
        if (ac.signal.aborted) return;
        markDisplayed(sharp);
        await v.setPanorama(toPanorama(sharp), { transition: SHARPEN, sphereCorrection: correctionOf(pano), showLoader: false });
      }
      if (ac.signal.aborted) return;
      setLoading(false);
      prefetchAround(level, position, time);
    };

    run().catch(() => {
      if (ac.signal.aborted) return;
      setLoading(false);
      setFailed(true);
    });

    return () => {
      ac.abort();
      cancelPrefetch();
    };
  }, [level, position, time, attempt]);

  return (
    // Con el plano ampliado, el centro de la vista sigue al centro de su media pantalla (ver `dock`).
    <div ref={stage} className="absolute inset-0 translate-x-[calc(var(--split,0)*-25vw)] overflow-hidden data-docked:right-[50vw] data-docked:translate-x-0">
      <div ref={el} className="absolute inset-0" />
      <canvas ref={frozen} className="pointer-events-none absolute inset-0 size-full opacity-0" aria-hidden="true" />
      <div className={`absolute inset-x-0 top-0 z-2 h-0.5 transition-opacity duration-300 ${loading ? 'progress-sweep opacity-100' : 'opacity-0'}`} aria-hidden="true" />
      {failed && (
        <div className="material-sheet absolute top-1/2 left-1/2 z-3 flex -translate-1/2 items-center gap-4 rounded-full py-3 pr-3 pl-5 text-sm" role="alert">
          <span>This view could not be loaded.</span>
          <button className="press rounded-full bg-paper px-3.5 py-1.5 font-medium text-ink" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
