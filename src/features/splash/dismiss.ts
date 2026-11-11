/**
 * Retira la pantalla de arranque cuando lo primero que se va a ver ya está listo:
 * fuentes, render de portada y, si se entra por un enlace a una vista, la panorámica.
 */
import { useApp } from '../../app/store';
import { preloadPlans } from '../../lib/preloadPlans';
import { SPLASH_ID } from './constants';

const MIN_VISIBLE_MS = 900; // por debajo la subida parece un parpadeo
const MAX_WAIT_MS = 15_000; // con mala conexión la portada se enseña igualmente
const RISE_FINISH_MS = 450;
const FADE_MS = 700;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const sceneReady = () =>
  new Promise<void>((resolve) => {
    const isReady = () => {
      const { heroReady, mode, viewReady } = useApp.getState();
      return heroReady && (mode === 'tower' || viewReady);
    };
    if (isReady()) return resolve();
    const unsubscribe = useApp.subscribe(() => {
      if (!isReady()) return;
      unsubscribe();
      resolve();
    });
  });

export async function dismissSplash() {
  const root = document.getElementById(SPLASH_ID);
  if (!root) return;

  await Promise.race([Promise.all([document.fonts.ready, sceneReady(), wait(MIN_VISIBLE_MS - performance.now())]), wait(MAX_WAIT_MS)]);

  // La misma animación se acelera: la torre termina de subir desde donde está, sin saltos.
  const rise = root.querySelector('.splash-rise')?.getAnimations()[0];
  if (rise?.playState === 'running') {
    const end = Number(rise.effect?.getComputedTiming().endTime ?? 0);
    rise.updatePlaybackRate(Math.max(1, (end - Number(rise.currentTime)) / RISE_FINISH_MS));
    await rise.finished.catch(() => {});
  }

  // La portada empieza su entrada mientras el arranque se desvanece sobre ella.
  useApp.getState().setIntroDone();
  await root.animate({ opacity: [1, 0] }, { duration: FADE_MS, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {});
  root.style.display = 'none';
  preloadPlans();
}
