/** Sincroniza el store con el hash de la URL: #m=view&l=58&p=B-W&t=twilight&h=212 */
import { keepPosition, useApp } from './store';
import { POSITION_ORDER, selectableLevels } from '../data/catalog';
import type { PositionId, TimeOfDay } from '../data/types';
import { SPLIT_QUERY } from '../lib/split';

/** Un enlace manipulado o antiguo nunca debe romper la vista: lo inválido se ignora. */
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const rawLevel = Number(q.get('l'));
  const level = selectableLevels.includes(rawLevel) ? rawLevel : null;
  if (level == null) return {};

  const rawPosition = q.get('p') as PositionId;
  const position = keepPosition(level, POSITION_ORDER.includes(rawPosition) ? rawPosition : useApp.getState().position);
  const rawTime = q.get('t');
  const time: TimeOfDay = rawTime === 'twilight' ? 'twilight' : 'day';
  const rawHeading = Number(q.get('h'));
  return { mode: 'view' as const, level, position, time, heading: q.get('h') && Number.isFinite(rawHeading) ? rawHeading : null };
}

export function startRouter() {
  useApp.getState().hydrate(readHash());

  // Se escribe con retardo: mover la cámara actualiza el rumbo en cada frame, y
  // Next.js procesa cada replaceState (además, Safari limita cuántos se permiten).
  let timer: ReturnType<typeof setTimeout> | undefined;
  useApp.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const st = useApp.getState();
      if (st.mode === 'tower') return history.replaceState(null, '', location.pathname + location.search);
      const q = new URLSearchParams({ m: st.mode, l: String(st.level), p: st.position, t: st.time });
      if (st.heading != null) q.set('h', String(Math.round(st.heading)));
      history.replaceState(null, '', '#' + q.toString());
    }, 250);
  });
}

export function startKeyboard() {
  addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement)?.closest('input, textarea')) return;
    const s = useApp.getState();
    if (e.key === 'Escape') {
      // Un paso atrás cada vez: plano ampliado → panel lateral → vista → portada.
      if (s.plansOpen && s.plansWide && matchMedia(SPLIT_QUERY).matches) s.setPlansWide(false);
      else if (s.plansOpen) s.togglePlans(false);
      else if (s.mode === 'view') s.backToTower();
      return;
    }
    if (s.mode !== 'view') return;
    switch (e.key.toLowerCase()) {
      case 'arrowup':
        return s.stepLevel(1);
      case 'arrowdown':
        return s.stepLevel(-1);
      case 'arrowleft':
        return s.stepPosition(-1);
      case 'arrowright':
        return s.stepPosition(1);
      case 't':
        return s.toggleTime();
      case 'p':
        return s.togglePlans();
      case 'f':
        return void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
    }
  });
}
