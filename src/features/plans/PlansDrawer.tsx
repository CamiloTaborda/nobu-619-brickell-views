/**
 * Panel paralelo: no bloquea ni oscurece la vista. El plano queda fijo; solo se desplaza la lista.
 * Ampliado, ocupa media pantalla: el plano llena el alto y la lista se reduce a la residencia señalada
 * o a la que se está viendo; la otra mitad muestra esa vista.
 */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState, type CSSProperties } from 'react';
import { keepPosition, useApp } from '../../app/store';
import { building, collectionOf, entryLevel, levelName, planFor, positionsAt, residenceCollections, residenceFor, viewsOf } from '../../data/catalog';
import type { Collection, PositionId, Residence } from '../../data/types';
import { springSheet } from '../../lib/motion';
import { warmView } from '../../lib/prefetch';
import { split, SPLIT_QUERY, useSplit } from '../../lib/split';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { Close, Expand, Shrink } from '../../ui/icons';
import Segmented from '../../ui/Segmented';
import PlanFigure from './PlanFigure';
import ResidencesInvite from './ResidencesInvite';

const collectionById = (id: string): Collection | undefined => residenceCollections.find((c) => c.id === id);

interface DetailsProps {
  residence: Residence;
  views: PositionId[];
  level: number;
  highlighted: boolean;
  onLit: (views: PositionId[]) => void;
  /** En una sola fila, para dejar al plano ampliado todo el alto posible. */
  inline?: boolean;
}

function ResidenceDetails({ residence, views, level, highlighted, onLit, inline = false }: DetailsProps) {
  const position = useApp((s) => s.position);
  const { setPosition } = useApp.getState();
  const name = <h3 className={`font-medium tracking-title transition-colors duration-150 ${highlighted ? 'text-champagne' : ''}`}>Residence {residence.id}</h3>;
  const area = `${residence.sf.toLocaleString('en-US')} SF`;
  return (
    <div className={inline ? 'flex items-center gap-6' : ''}>
      {inline ? (
        <div className="min-w-0 flex-1">
          {name}
          <p className="mt-0.5 truncate text-sm text-paper-2">
            {residence.layout} · <span className="tabular-nums">{area}</span>
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-4">
            {name}
            <span className="text-sm text-paper-2 tabular-nums">{area}</span>
          </div>
          <p className="mt-0.5 text-sm text-paper-2">{residence.layout}</p>
        </>
      )}
      <div className={`flex flex-none gap-1.5 ${inline ? '' : 'mt-3'}`}>
        {views.map((p) => (
          <button
            key={p}
            className={`press min-h-9 rounded-full px-3.5 text-ui font-medium disabled:cursor-not-allowed disabled:opacity-40 ${position === p ? 'bg-paper text-ink' : 'shadow-[inset_0_0_0_1px_var(--color-hairline)] enabled:hover:bg-white/10'}`}
            disabled={!positionsAt(level).includes(p)}
            onPointerEnter={() => onLit([p])}
            onPointerLeave={() => onLit(views)}
            onClick={() => setPosition(p)}
          >
            {p.endsWith('-W') ? 'West view' : 'View'}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PlansDrawer() {
  const open = useApp((s) => s.plansOpen);
  const level = useApp((s) => s.level);
  const position = useApp((s) => s.position);
  const time = useApp((s) => s.time);
  const plansWide = useApp((s) => s.plansWide);
  const { setLevel, setPosition, setPlansWide, togglePlans } = useApp.getState();
  const reduceMotion = useReducedMotion();
  const canWiden = useMediaQuery(SPLIT_QUERY);
  const wide = useSplit();
  // Vistas señaladas con el cursor o el foco: unen plano y lista en ambos sentidos.
  const [lit, setLit] = useState<PositionId[]>([]);

  // La distribución ampliada entra al empezar a crecer y se mantiene hasta que el panel ha vuelto.
  const [wideLayout, setWideLayout] = useState(wide);
  useEffect(() => {
    if (wide) return setWideLayout(true);
    if (split.get() === 0) return setWideLayout(false);
    return split.on('change', (value) => {
      if (value === 0) setWideLayout(false);
    });
  }, [wide]);

  const current = level != null ? collectionOf(level) : undefined;
  // El panel sigue a la vista. Los niveles bajos no tienen colección a la venta ni planta.
  const collection = current?.residences.length ? current : undefined;
  const plan = collection && planFor(collection.id);
  const activeResidence = level != null ? residenceFor(level, position) : undefined;
  const litResidence = collection?.residences.find((r) => viewsOf(r, collection).some((p) => lit.includes(p)));
  const shownResidence = litResidence ?? activeResidence;

  /** Cambiar de colección es ir a ella: vista, plano y barra responden al mismo estado. */
  const showCollection = (id: string) => {
    const target = collectionById(id);
    if (target && target.id !== current?.id) setLevel(entryLevel(target));
  };

  const warmCollection = (id: string) => {
    const target = collectionById(id);
    if (!target || target.id === current?.id) return;
    const entry = entryLevel(target);
    warmView(entry, keepPosition(entry, position), time);
  };

  const collectionPicker = (
    <Segmented
      id="collection"
      label="Collection"
      value={collection?.id ?? ''}
      options={[...residenceCollections].reverse().map((c) => ({ value: c.id, label: c.tag }))}
      onChange={showCollection}
      onIntent={warmCollection}
      className={`flex-none rounded-full bg-white/6 p-0.75 ${wideLayout ? 'mt-1 w-72' : ''}`}
      stretch
    />
  );

  const iconButton = 'press grid size-tap flex-none place-items-center rounded-full text-paper-2 hover:bg-white/10 hover:text-paper';

  return (
    <AnimatePresence>
      {open && level != null && (
        <motion.aside
          className="material-sheet absolute inset-y-0 right-0 isolate flex w-[calc(var(--spacing-plans)+(50vw-var(--spacing-plans))*var(--split,0))] flex-col overflow-hidden px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[inset_1px_0_0_rgb(255_255_255/0.1),var(--sheet-shadow)] compact:w-[min(var(--spacing-plans),100vw)] short:block short:overflow-y-auto short:overscroll-contain short:bg-ink short:pt-0"
          aria-label="Floor plans"
          initial={reduceMotion ? { opacity: 0 } : { x: '100%' }}
          animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { x: '100%' }}
          transition={reduceMotion ? { duration: 0.2 } : springSheet}
        >
          {/* Al ampliarse el panel se vuelve opaco: encajado, ya no hay foto detrás y su tono no debe cambiar. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-ink opacity-[var(--split,0)]" />
          <header className="mb-4 flex flex-none items-start justify-between gap-4 short:pt-[max(1.5rem,env(safe-area-inset-top))]">
            <div>
              <h2 className="font-display text-[2.5rem] leading-[1.05] font-light tracking-display lining-nums">{current?.name ?? levelName(level)}</h2>
              <p className="mt-1 text-ui tracking-small text-paper-2">
                {current && `Levels ${current.levels[0]}–${current.levels[1]}`}
                {collection && ` · ${collection.residences.length} residences per floor`}
              </p>
            </div>
            {wideLayout && <div className="ml-auto">{collectionPicker}</div>}
            <div className="-mt-2 -mr-2 flex">
              {canWiden && (
                <button className={iconButton} onClick={() => setPlansWide(!plansWide)} aria-label={plansWide ? 'Reduce floor plan' : 'Enlarge floor plan'}>
                  {plansWide ? <Shrink /> : <Expand />}
                </button>
              )}
              <button className={iconButton} onClick={() => togglePlans(false)} aria-label="Close floor plans">
                <Close />
              </button>
            </div>
          </header>

          {!wideLayout && collectionPicker}

          {!collection && <ResidencesInvite level={level} onGoToLevel={setLevel} onShowCollection={showCollection} onIntent={warmCollection} />}

          {collection && plan && (
            <div
              className={wideLayout ? 'flex min-h-0 flex-1 flex-col justify-center [container-type:size]' : 'flex-none short:sticky short:top-0 short:z-1 short:-mx-6 short:bg-ink short:px-6 short:pt-2'}
              style={wideLayout ? ({ '--plan-height': 'calc(100cqh - 1rem)' } as CSSProperties) : undefined}
            >
              <PlanFigure key={collection.id} collection={collection} plan={plan} level={level} lit={lit} onLit={setLit} onGo={setPosition} fill={wideLayout} />
            </div>
          )}

          {collection && wideLayout && shownResidence && (
            <div className="flex-none border-t border-hairline pt-3" onPointerEnter={() => setLit(viewsOf(shownResidence, collection))} onPointerLeave={() => setLit([])}>
              <motion.div key={shownResidence.id} initial={{ opacity: reduceMotion ? 1 : 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
                <ResidenceDetails residence={shownResidence} views={viewsOf(shownResidence, collection)} level={level} highlighted onLit={setLit} inline />
              </motion.div>
              <p className="mt-2.5 text-2xs leading-[1.45] text-paper-3">Plans, areas and views are approximate and subject to change.</p>
            </div>
          )}

          {collection && !wideLayout && (
            <div className="edge-fade-y no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pt-1 pb-4 short:overflow-visible short:mask-none">
              <ul>
                {collection.residences.map((r) => {
                  const views = viewsOf(r, collection);
                  return (
                    <li key={r.id} className="border-b border-hairline py-4" onPointerEnter={() => setLit(views)} onPointerLeave={() => setLit([])}>
                      <ResidenceDetails residence={r} views={views} level={level} highlighted={activeResidence?.id === r.id || views.some((p) => lit.includes(p))} onLit={setLit} />
                    </li>
                  );
                })}
              </ul>

              <p className="mt-4 text-2xs leading-[1.45] text-paper-3">Plans and areas are approximate and subject to change. {building.project.disclaimer}</p>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
