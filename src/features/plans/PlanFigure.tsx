/** Imagen, áreas y etiquetas aparecen a la vez, con la imagen ya decodificada; mientras tanto, trazo. */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../app/store';
import { positionsAt, viewLabel, viewsOf } from '../../data/catalog';
import type { Collection, Plan, PlanZone, PositionId, Residence } from '../../data/types';
import { springUi } from '../../lib/motion';

interface Props {
  collection: Collection;
  plan: Plan;
  level: number;
  lit: PositionId[];
  onLit: (views: PositionId[]) => void;
  onGo: (view: PositionId) => void;
  /** Plano ampliado: llena el espacio disponible, con márgenes mínimos. */
  fill?: boolean;
}

interface Zone extends PlanZone {
  view: PositionId;
  residence: Residence;
}

function zonesOf(collection: Collection, plan: Plan): Zone[] {
  return collection.residences.flatMap((residence) =>
    (plan.residences[residence.id]?.zones ?? []).flatMap((zone) => {
      const view = viewsOf(residence, collection).find((p) => p.endsWith('-W') === (zone.variant === 'west'));
      return view ? [{ ...zone, view, residence }] : [];
    }),
  );
}

export default function PlanFigure({ collection, plan, level, lit, onLit, onGo, fill = false }: Props) {
  const position = useApp((s) => s.position);
  const reduceMotion = useReducedMotion();
  const image = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);

  // Si la imagen falla, las áreas y las etiquetas siguen siendo útiles: nunca se queda cargando.
  useEffect(() => {
    let live = true;
    image.current
      ?.decode()
      .catch(() => {})
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const zones = zonesOf(collection, plan);
  const isActive = (z: Zone) => z.view === position;
  const canOpen = (z: Zone) => positionsAt(level).includes(z.view);

  const stateOf = (z: Zone) => {
    if (lit.includes(z.view)) return 'lit';
    if (isActive(z)) return 'active';
    const sibling = zones.some((o) => o.residence === z.residence && o !== z && (lit.includes(o.view) || isActive(o)));
    return sibling ? 'related' : undefined;
  };

  return (
    <figure className={`relative mx-auto w-full ${fill ? 'my-2' : 'mt-5 mb-3 short:mt-0'}`} style={{ aspectRatio: `${plan.width} / ${plan.height}`, maxWidth: `calc(var(--plan-height) * ${plan.width / plan.height})` }}>
      <AnimatePresence>
        {!ready && (
          <motion.svg key="trace" className="absolute inset-0 size-full text-champagne" viewBox={`0 0 ${plan.width} ${plan.height}`} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} role="img" aria-label="Loading floor plan">
            {zones.map((z) => (
              <path key={z.view} d={z.outline} pathLength={1} className="plan-trace stroke-5 opacity-70" />
            ))}
          </motion.svg>
        )}
      </AnimatePresence>

      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.985 }}
        animate={ready ? { opacity: 1, scale: 1 } : undefined}
        transition={springUi}
        inert={!ready}
      >
        <img ref={image} className="block size-full opacity-85" src={`/${plan.image}`} alt={`${collection.name} floor plan`} />

        {/* Las áreas son para el puntero; teclado y lectores de pantalla usan los botones de abajo. */}
        <svg className="absolute inset-0 size-full" viewBox={`0 0 ${plan.width} ${plan.height}`} aria-hidden="true">
          {zones.map((z) => {
            const open = canOpen(z);
            return (
              <path
                key={z.view}
                d={z.outline}
                data-state={stateOf(z)}
                className={`fill-transparent stroke-transparent stroke-[1.25] transition-[fill,stroke] duration-150 ease-out [vector-effect:non-scaling-stroke] data-[state=active]:fill-paper/12 data-[state=active]:stroke-paper/60 data-[state=lit]:fill-champagne/24 data-[state=lit]:stroke-champagne data-[state=related]:fill-paper/6 data-[state=related]:stroke-paper/25 ${open ? 'cursor-pointer active:fill-champagne/40' : 'pointer-events-none'}`}
                onPointerEnter={() => onLit([z.view])}
                onPointerLeave={() => onLit([])}
                onClick={() => onGo(z.view)}
              />
            );
          })}
        </svg>

        {zones.map((z) => {
          const state = stateOf(z);
          return (
            <button
              key={z.view}
              className={`press absolute min-h-7 -translate-1/2 rounded-full px-2.5 text-xs font-semibold tracking-small whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 ${state === 'lit' ? 'bg-champagne text-ink' : state === 'active' ? 'bg-paper text-ink' : 'bg-paper/16 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22)] backdrop-blur-sm'}`}
              style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%` }}
              disabled={!canOpen(z)}
              aria-label={`View ${viewLabel(collection.levels[0], z.view)}`}
              onPointerEnter={() => onLit([z.view])}
              onPointerLeave={() => onLit([])}
              onFocus={() => onLit([z.view])}
              onBlur={() => onLit([])}
              onClick={() => onGo(z.view)}
            >
              {viewLabel(collection.levels[0], z.view)}
            </button>
          );
        })}
      </motion.div>
    </figure>
  );
}
