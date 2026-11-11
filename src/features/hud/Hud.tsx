/** Controles del visor: aparecen cuando la vista ya está en pantalla. */
import { motion, useReducedMotion } from 'motion/react';
import { useApp } from '../../app/store';
import { building, collectionOf, levelName, positionsAt, residenceFor, resolveView, viewLabel } from '../../data/catalog';
import type { TimeOfDay } from '../../data/types';
import { springSheet } from '../../lib/motion';
import { ChevronLeft } from '../../ui/icons';
import { useSplit } from '../../lib/split';
import Segmented from '../../ui/Segmented';
import Compass from './Compass';
import FloorRail from './FloorRail';

const divider = 'h-5 w-px flex-none bg-hairline compact:hidden';

export default function Hud() {
  const level = useApp((s) => s.level);
  const position = useApp((s) => s.position);
  const time = useApp((s) => s.time);
  const ready = useApp((s) => s.viewReady);
  const plansOpen = useApp((s) => s.plansOpen);
  const { backToTower, setPosition, setTime, togglePlans } = useApp.getState();
  const reduceMotion = useReducedMotion();
  // Con el plano ampliado los controles ocupan solo la media pantalla de la vista.
  const wide = useSplit();
  if (level == null) return null;

  const collection = collectionOf(level);
  const residence = residenceFor(level, position);
  const { captured, isApproximate } = resolveView(level, position, time);
  const sharesWith = building.positions[position]?.sharesPhotoWith;
  const views = positionsAt(level).map((p) => ({ value: p, label: viewLabel(level, p).replace(/^Unit /, '') }));

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 right-[calc(var(--split,0)*50vw)]"
      initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
      animate={{ opacity: ready ? 1 : 0, y: ready || reduceMotion ? 0 : 12 }}
      transition={springSheet}
    >
      <div className="absolute inset-x-0 bottom-0 h-64 bg-linear-to-t from-shade/70 to-transparent compact:h-96" />
      <div className="absolute bottom-0 left-0 h-104 w-176 max-w-full bg-[radial-gradient(ellipse_at_bottom_left,rgb(8_14_20/0.82),rgb(8_14_20/0.45)_42%,transparent_72%)] compact:hidden" />
      <div className="absolute inset-x-0 top-0 hidden h-80 bg-linear-to-b from-shade/55 to-transparent compact:block" />

      <button
        className="material press pointer-events-auto absolute top-(--safe-top) left-gutter inline-flex min-h-tap items-center gap-1 rounded-full pr-4.5 pl-3 text-sm font-medium tracking-small"
        onClick={backToTower}
      >
        <ChevronLeft />
        Building
      </button>

      <FloorRail />
      <Compass />

      {/* Con el panel abierto la barra se desplaza a la izquierda: el título sube para no quedar debajo. */}
      <header className={`absolute bottom-(--safe-bottom) left-[calc(var(--spacing-gutter)+4.5rem)] text-shadow-[0_1px_24px_rgb(0_10_25/0.55)] transition-[translate] duration-500 ease-out max-[1180px]:bottom-[calc(var(--safe-bottom)+5.25rem)] compact:top-[calc(var(--safe-top)+3.5rem)] compact:bottom-auto compact:left-gutter ${wide ? '-translate-y-21' : plansOpen ? 'min-[1181px]:max-[1700px]:-translate-y-21' : ''}`}>
        <p className="text-xs font-medium tracking-caps text-paper-2 uppercase">{collection?.residences.length ? collection.name : levelName(level)}</p>
        <h2 className="mt-0.5 text-[clamp(3rem,5.4vw,4.75rem)] leading-[1.04] font-extralight tracking-display tabular-nums max-[1180px]:text-5xl compact:text-[2.5rem]">
          <span className="align-[0.1em] text-[0.34em] font-light tracking-title">Level</span> {level}
        </h2>
        <p className="font-medium tracking-title compact:text-sm">
          {viewLabel(level, position)}
          {residence && <span className="font-normal text-paper-2"> · {residence.sf.toLocaleString('en-US')} SF</span>}
        </p>
        {isApproximate && <p className="mt-0.5 text-ui tracking-small text-paper-2">View from Level {captured}</p>}
        {sharesWith && <p className="mt-0.5 text-ui tracking-small text-paper-2">Same view as {viewLabel(level, sharesWith)}</p>}
      </header>

      <div
        className={`material pointer-events-auto absolute bottom-[calc(var(--safe-bottom)+1.5rem)] left-1/2 flex max-w-[calc(100%-2*var(--spacing-gutter))] items-center gap-2 rounded-full p-1.25 transition-[translate] duration-500 ease-out compact:right-gutter compact:bottom-[calc(var(--safe-edge)+3.25rem)] compact:left-gutter compact:max-w-none compact:translate-x-0 compact:flex-wrap compact:justify-between compact:rounded-3xl ${wide ? '-translate-x-1/2' : plansOpen ? 'max-w-[calc(100vw-var(--spacing-plans)-2*var(--spacing-gutter))] translate-x-[min(-50%,calc(-100%+50vw-var(--spacing-plans)-var(--spacing-gutter)))]' : '-translate-x-1/2'}`}
      >
        <div className="edge-fade-x no-scrollbar min-w-0 overflow-x-auto compact:flex-[1_0_100%]">
          <Segmented id="view" label="View" value={position} options={views} onChange={setPosition} className="compact:w-max compact:min-w-full compact:justify-between" />
        </div>
        <span className={divider} aria-hidden="true" />
        <Segmented<TimeOfDay> id="time" label="Time of day" value={time} options={building.times.map((t) => ({ value: t.id, label: t.label }))} onChange={setTime} />
        {!wide && <span className={divider} aria-hidden="true" />}
        <button className={`press min-h-9 flex-none rounded-full px-4 text-ui font-medium tracking-small whitespace-nowrap hover:bg-white/12 ${wide ? 'hidden' : ''}`} onClick={() => togglePlans()}>
          Floor plans
        </button>
      </div>

      <p
        className={`absolute bottom-(--safe-edge) left-1/2 w-max max-w-[calc(100vw-2*var(--spacing-gutter))] -translate-x-1/2 text-center text-2xs leading-[1.3] tracking-small text-paper-2 transition-opacity duration-300 compact:right-gutter compact:left-gutter compact:w-auto compact:translate-x-0 compact:text-[0.625rem] ${plansOpen ? 'opacity-0' : ''}`}
      >
        {building.project.disclaimer}
      </p>
    </motion.div>
  );
}
