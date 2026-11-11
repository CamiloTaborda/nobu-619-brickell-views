/**
 * Portada. Un solo gesto para ratón y táctil: al soltar sobre la torre se entra.
 * Permanece montada bajo el visor para que la salida sea inmediata y simétrica a la entrada.
 */
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { keepPosition, useApp } from '../../app/store';
import { capturedLevels, collectionOf, entryLevel, hero, HERO_ALIGN_Y, HERO_IMAGE_SIZES, levelName, residenceCollections, selectableLevels, stepFrom } from '../../data/catalog';
import { springFlight, springQuick } from '../../lib/motion';
import { warmView } from '../../lib/prefetch';
import { COMPACT_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import HeroTitle from '../../ui/HeroTitle';
import CollectionCard from './CollectionCard';
import FloorCard from './FloorCard';

const FLIGHT_ZOOM = 3.2;
const INTRO_PUSH = 1.04; // acercamiento de la cámara de entrada
const INTRO_SECONDS = 9;
const HIDE_DELAY_MS = 450; // margen para llevar el cursor de la torre o la lista a la ficha
const CANCEL_MARGIN = 48; // px fuera de la torre para cancelar al soltar
const LEADER_LENGTH = 130; // línea que une el piso con su ficha, en unidades del render
const CARD_GAP = 12; // px entre la línea y la ficha
const CARD_MARGIN = 24; // px mínimos entre la ficha y el borde de la pantalla
const WHEEL_STEP = 60; // px de rueda por piso

const toPoints = (points: [number, number][]) => points.map((p) => p.join(',')).join(' ');
const floorByLevel = new Map(hero.floors.map((f) => [f.level, f]));

function useViewport() {
  const [size, setSize] = useState({ vw: innerWidth, vh: innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ vw: innerWidth, vh: innerHeight });
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, []);
  return size;
}

export default function Home() {
  const mode = useApp((s) => s.mode);
  const level = useApp((s) => s.level);
  const selected = useApp((s) => s.hoverLevel);
  const viewReady = useApp((s) => s.viewReady);
  const introDone = useApp((s) => s.introDone);
  const { flyTo, setHeroReady, setHoverLevel: select } = useApp.getState();
  const [previewCollection, setPreviewCollection] = useState<string | null>(null);
  const pressing = useRef(false);
  const wheel = useRef(0);
  const heroImage = useRef<HTMLImageElement>(null);
  const overlay = useRef<SVGSVGElement>(null);
  const reduceMotion = useReducedMotion();
  const docked = useMediaQuery(COMPACT_QUERY);
  const { vw, vh } = useViewport();

  const inTower = mode === 'tower';

  // Si el render falla, el arranque no debe quedarse esperándolo.
  useEffect(() => {
    heroImage.current?.decode().catch(() => {}).finally(setHeroReady);
  }, [setHeroReady]);

  // El piso señalado se prepara antes de que se pulse.
  useEffect(() => {
    if (selected == null || !inTower) return;
    const { position, time } = useApp.getState();
    warmView(selected, keepPosition(selected, position), time);
  }, [selected, inTower]);

  // La ficha se va con un pequeño retraso; llegar a ella, o señalar otra cosa, lo cancela.
  // Al re-renderizarse puede emitir un pointerleave aunque el cursor siga encima: se comprueba antes de quitarla.
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const keepCard = () => clearTimeout(hideTimer.current);
  const hideCard = () => {
    keepCard();
    hideTimer.current = setTimeout(() => {
      if (card.current?.matches(':hover, :focus-within')) return;
      select(null);
      setPreviewCollection(null);
    }, HIDE_DELAY_MS);
  };
  useEffect(() => keepCard, []);

  // Misma geometría que la imagen: cover, alineada a la derecha y con la corona a la vista.
  const scale = Math.max(vw / hero.width, vh / hero.height);
  const offsetX = vw - hero.width * scale;
  const offsetY = (vh - hero.height * scale) * HERO_ALIGN_Y;
  const towerLeft = offsetX + hero.tower.x0 * scale;
  const towerCenter = { x: offsetX + hero.tower.cx * scale, y: offsetY + ((hero.tower.y0 + hero.tower.y1) / 2) * scale };

  // Cámara de entrada; la ficha aplica la misma transformación.
  const push = useMotionValue(1);
  useEffect(() => {
    if (!introDone || reduceMotion) return;
    const controls = animate(push, INTRO_PUSH, { duration: INTRO_SECONDS, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [introDone, reduceMotion, push]);

  const floor = selected != null ? floorByLevel.get(selected) : undefined;
  const collection = residenceCollections.find((c) => c.id === previewCollection);
  const collectionFloors = useMemo(() => (collection ? hero.floors.filter((f) => f.level >= collection.levels[0] && f.level <= collection.levels[1]) : []), [collection]);

  // Altura (en el render) a la que apunta la ficha: el piso, o el centro de la colección.
  const anchorCy = collection ? (collectionFloors[0].cy + collectionFloors[collectionFloors.length - 1].cy) / 2 : floor?.cy;
  const floorY = useMotionValue(anchorCy != null ? offsetY + anchorCy * scale : 0);
  const shown = useRef(false);
  useEffect(() => {
    if (anchorCy == null) {
      shown.current = false;
      return;
    }
    const target = offsetY + anchorCy * scale;
    if (!shown.current || reduceMotion) floorY.set(target);
    else animate(floorY, target, springQuick);
    shown.current = true;
  }, [anchorCy, offsetY, scale, reduceMotion, floorY]);

  // La ficha se alinea con el piso, pero nunca se sale de la pantalla (los pisos altos quedan arriba del todo).
  const card = useRef<HTMLElement>(null);
  const frame = useRef({ center: towerCenter, edge: 0, height: vh });
  frame.current = { center: towerCenter, edge: towerLeft - LEADER_LENGTH * scale - CARD_GAP, height: vh };
  const cardY = useTransform(() => {
    const { center, height } = frame.current;
    const y = center.y + (floorY.get() - center.y) * push.get();
    const half = (card.current?.offsetHeight ?? 0) / 2;
    return Math.min(Math.max(y, CARD_MARGIN + half), height - CARD_MARGIN - half);
  });
  const cardX = useTransform(() => {
    const { center, edge } = frame.current;
    return center.x + (edge - center.x) * push.get();
  });

  const anchor = level != null ? floorByLevel.get(level) : undefined;
  const origin = anchor ? `${offsetX + hero.tower.cx * scale}px ${offsetY + anchor.cy * scale}px` : '85% 50%';

  /** Punto de pantalla a coordenadas del render, con todas las transformaciones aplicadas. */
  const toRender = (clientX: number, clientY: number) => {
    const matrix = overlay.current?.getScreenCTM();
    return matrix ? new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse()) : null;
  };
  const levelAt = (clientX: number, clientY: number) => {
    const point = toRender(clientX, clientY);
    if (!point) return null;
    return hero.floors.reduce((a, b) => (Math.abs(b.cy - point.y) < Math.abs(a.cy - point.y) ? b : a)).level;
  };
  /** Señalar un piso sustituye a cualquier colección señalada. */
  const showFloor = (l: number) => {
    keepCard();
    setPreviewCollection(null);
    select(l);
  };
  const showCollection = (id: string) => {
    keepCard();
    select(null);
    setPreviewCollection(id);
  };
  const selectAt = (e: PointerEvent<SVGRectElement>) => {
    const l = levelAt(e.clientX, e.clientY);
    if (l != null) showFloor(l);
  };
  const step = (dir: 1 | -1) => showFloor(stepFrom(selected ?? selectableLevels[0], dir));
  const enter = () => {
    if (collection) flyTo(entryLevel(collection));
    else if (selected != null) flyTo(selected);
  };

  const onPointerDown = (e: PointerEvent<SVGRectElement>) => {
    if (!inTower) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pressing.current = true;
    selectAt(e);
  };
  const onPointerMove = (e: PointerEvent<SVGRectElement>) => {
    if (inTower && (pressing.current || e.pointerType === 'mouse')) selectAt(e);
  };
  const onPointerUp = (e: PointerEvent<SVGRectElement>) => {
    if (!pressing.current) return;
    pressing.current = false;
    const point = toRender(e.clientX, e.clientY);
    const margin = CANCEL_MARGIN / scale;
    if (point && point.x >= hero.tower.x0 - margin && point.x <= hero.tower.x1 + margin) enter();
    else hideCard();
  };
  const onPointerLeave = () => {
    if (!pressing.current) hideCard();
  };
  const onWheel = (e: WheelEvent<SVGRectElement>) => {
    if (!inTower) return;
    wheel.current += e.deltaY;
    if (Math.abs(wheel.current) < WHEEL_STEP) return;
    step(wheel.current < 0 ? 1 : -1);
    wheel.current = 0;
  };
  const onKeyDown = (e: KeyboardEvent<SVGRectElement>) => {
    if (!inTower) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      step(e.key === 'ArrowUp' ? 1 : -1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      enter();
    }
  };

  const visible = inTower || !viewReady;
  const floorShown = inTower && introDone && !collection && floor != null && selected != null;
  const cardShown = inTower && introDone && (collection != null || floorShown);
  const cardHandlers = { onPointerEnter: keepCard, onPointerLeave: hideCard, onFocus: keepCard, onBlur: hideCard };

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-ink will-change-transform"
      style={{ transformOrigin: origin, pointerEvents: inTower ? 'auto' : 'none' }}
      initial={false}
      animate={{
        scale: inTower || reduceMotion ? 1 : FLIGHT_ZOOM,
        ...(visible ? { opacity: 1, visibility: 'visible' as const } : { opacity: 0, transitionEnd: { visibility: 'hidden' as const } }),
      }}
      transition={{ scale: reduceMotion ? { duration: 0 } : springFlight, opacity: { duration: 0.6, ease: 'easeOut' } }}
    >
      <motion.div className="absolute inset-0" style={{ scale: push, transformOrigin: `${towerCenter.x}px ${towerCenter.y}px` }}>
        <img
          ref={heroImage}
          className="absolute inset-0 size-full object-cover object-[100%_35%]"
          src={hero.src1920}
          srcSet={`${hero.src1920} 1920w, ${hero.src3840} 3840w`}
          sizes={HERO_IMAGE_SIZES}
          alt="Rendering of Nobu Residences 619 Brickell on Biscayne Bay"
          fetchPriority="high"
        />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-shade/50 via-shade/22 via-30% to-transparent to-54% compact:hidden short:block short:from-shade/70 short:via-shade/40" />
        <div className="pointer-events-none absolute inset-0 hidden bg-linear-to-b from-shade/42 to-transparent to-30% compact:block" />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-shade/40 to-transparent to-34% compact:from-shade/88 compact:via-shade/55 compact:via-30% compact:to-52%" />

        <svg ref={overlay} className="pointer-events-none absolute inset-0 size-full" viewBox={`${-offsetX / scale} ${-offsetY / scale} ${vw / scale} ${vh / scale}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="floor-light" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.75" />
              <stop offset="0.45" stopColor="#fff3dd" stopOpacity="0.98" />
              <stop offset="1" stopColor="#ffd9a0" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {collectionFloors.map((f) => (
            <polygon key={f.level} points={toPoints(f.points)} className="fill-[#ffe2b4]/45" />
          ))}
          {floorShown && <polygon points={toPoints(floor.points)} fill="url(#floor-light)" className="drop-shadow-[0_0_14px_rgb(255_220_170/0.9)]" />}
          {cardShown && !docked && anchorCy != null && <line x1={hero.tower.x0 - LEADER_LENGTH} x2={hero.tower.x0 - 8} y1={anchorCy} y2={anchorCy} className="stroke-paper stroke-2 opacity-75" />}

          {capturedLevels.map((l) => {
            const f = floorByLevel.get(l);
            return f ? <line key={l} x1={hero.tower.x1 + 26} x2={hero.tower.x1 + 58} y1={f.cy} y2={f.cy} className="stroke-champagne stroke-3 opacity-85" /> : null;
          })}

          <rect
            x={hero.tower.x0 - 12}
            y={hero.tower.y0 - 6}
            width={hero.tower.x1 - hero.tower.x0 + 24}
            height={hero.tower.y1 - hero.tower.y0 + 12}
            className="pointer-events-auto cursor-pointer touch-none fill-transparent outline-none focus-visible:stroke-champagne focus-visible:stroke-3"
            role="slider"
            tabIndex={inTower ? 0 : -1}
            aria-label="Choose a floor"
            aria-orientation="vertical"
            aria-valuemin={selectableLevels.at(-1)}
            aria-valuemax={selectableLevels[0]}
            aria-valuenow={selected ?? selectableLevels[0]}
            aria-valuetext={selected != null ? `${levelName(selected)}, ${collectionOf(selected)?.name ?? ''}` : 'Use the arrow keys to choose a floor'}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              pressing.current = false;
              hideCard();
            }}
            onPointerLeave={onPointerLeave}
            onWheel={onWheel}
            onKeyDown={onKeyDown}
            onFocus={(e) => {
              // Con teclado no hay cursor que señale: se empieza por el piso más alto.
              keepCard();
              if (e.currentTarget.matches(':focus-visible') && useApp.getState().hoverLevel == null) showFloor(selectableLevels[0]);
            }}
            onBlur={hideCard}
          />
        </svg>
      </motion.div>

      <AnimatePresence>
        {cardShown && (
          <motion.aside
            key="floor-card"
            ref={card}
            className={docked ? 'absolute inset-x-gutter top-[max(1rem,env(safe-area-inset-top))]' : 'absolute top-0 left-0 -translate-x-full -translate-y-1/2'}
            style={docked ? undefined : { x: cardX, y: cardY }}
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
            transition={springQuick}
            aria-live="polite"
            {...cardHandlers}
          >
            {collection ? <CollectionCard collection={collection} docked={docked} onEnter={enter} /> : floorShown && <FloorCard level={selected} docked={docked} onEnter={enter} onStep={step} />}
          </motion.aside>
        )}
      </AnimatePresence>

      <HeroTitle
        revealed={introDone}
        rowProps={(c) => ({
          onPointerEnter: () => showCollection(c.id),
          onPointerLeave: hideCard,
          onFocus: () => showCollection(c.id),
          onBlur: hideCard,
          onClick: () => flyTo(entryLevel(c)),
        })}
      />
    </motion.div>
  );
}
