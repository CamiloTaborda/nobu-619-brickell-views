import { create } from 'zustand';
import type { PositionId, TimeOfDay } from '../data/types';
import { DEFAULT_POSITION, POSITION_ORDER, positionsAt, stepFrom } from '../data/catalog';

type Mode = 'tower' | 'view';

interface AppState {
  mode: Mode;
  level: number | null;
  position: PositionId;
  time: TimeOfDay;
  heading: number | null; // rumbo absoluto a conservar entre escenas
  plansOpen: boolean;
  plansWide: boolean; // plano ampliado a media pantalla; se recuerda al volver a abrir el panel
  hoverLevel: number | null;
  viewReady: boolean; // la panorámica ya se ve: la portada puede desvanecerse
  heroReady: boolean; // el render de portada está decodificado: el arranque puede terminar
  introDone: boolean; // el arranque se retira: la portada hace su entrada

  flyTo: (level: number) => void;
  backToTower: () => void;
  setLevel: (level: number) => void;
  stepLevel: (dir: 1 | -1) => void;
  setPosition: (p: PositionId) => void;
  stepPosition: (dir: 1 | -1) => void;
  setTime: (t: TimeOfDay) => void;
  toggleTime: () => void;
  setHeading: (h: number) => void;
  togglePlans: (open?: boolean) => void;
  setPlansWide: (wide: boolean) => void;
  setHoverLevel: (l: number | null) => void;
  setViewReady: (ready: boolean) => void;
  setHeroReady: () => void;
  setIntroDone: () => void;
  hydrate: (s: Partial<Pick<AppState, 'mode' | 'level' | 'position' | 'time' | 'heading'>>) => void;
}

/** Si la posición no existe en el piso destino, cae a la por defecto. */
export const keepPosition = (level: number, p: PositionId): PositionId => {
  const available = positionsAt(level);
  if (available.includes(p)) return p;
  return available.includes(DEFAULT_POSITION) ? DEFAULT_POSITION : available[0];
};

export const useApp = create<AppState>((set, get) => ({
  mode: 'tower',
  level: null,
  position: DEFAULT_POSITION,
  time: 'day',
  heading: null,
  plansOpen: false,
  plansWide: false,
  hoverLevel: null,
  viewReady: false,
  heroReady: false,
  introDone: false,

  flyTo: (level) => set({ mode: 'view', level, position: keepPosition(level, get().position), viewReady: false, hoverLevel: null }),
  backToTower: () => set({ mode: 'tower', plansOpen: false, viewReady: false }),
  setLevel: (level) => set({ level, position: keepPosition(level, get().position) }),
  stepLevel: (dir) => {
    const { level } = get();
    if (level != null) get().setLevel(stepFrom(level, dir));
  },
  setPosition: (position) => set({ position }),
  stepPosition: (dir) => {
    const { level, position } = get();
    if (level == null) return;
    const list = POSITION_ORDER.filter((p) => positionsAt(level).includes(p));
    set({ position: list[(list.indexOf(position) + dir + list.length) % list.length] });
  },
  setTime: (time) => set({ time }),
  toggleTime: () => set({ time: get().time === 'day' ? 'twilight' : 'day' }),
  setHeading: (heading) => set({ heading }),
  togglePlans: (open) => set({ plansOpen: open ?? !get().plansOpen }),
  setPlansWide: (plansWide) => set({ plansWide }),
  setHoverLevel: (hoverLevel) => set({ hoverLevel }),
  setViewReady: (viewReady) => set({ viewReady }),
  setHeroReady: () => set({ heroReady: true }),
  setIntroDone: () => set({ introDone: true }),
  hydrate: (s) => set(s),
}));
