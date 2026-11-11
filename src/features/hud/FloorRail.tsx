/** Pisos fotografiados por colección. Las flechas recorren también los pisos intermedios. */
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { keepPosition, useApp } from '../../app/store';
import { collectionOf, floorGroups, railLevel } from '../../data/catalog';
import { springUi } from '../../lib/motion';
import { warmView } from '../../lib/prefetch';
import { ChevronDown, ChevronUp } from '../../ui/icons';

const stepClass = 'press grid h-8 w-11 place-items-center text-paper-2 hover:text-paper low:hidden compact:hidden';

export default function FloorRail() {
  const level = useApp((s) => s.level);
  const { setLevel, stepLevel } = useApp.getState();
  const reduceMotion = useReducedMotion();
  const list = useRef<HTMLUListElement>(null);
  const activeButton = useRef<HTMLButtonElement>(null);
  const active = level != null ? railLevel(level) : null;

  // En móvil el menú es horizontal y no cabe entero: el piso actual siempre queda a la vista.
  useEffect(() => {
    const scroller = list.current;
    const button = activeButton.current;
    if (!scroller || !button || scroller.scrollWidth <= scroller.clientWidth) return;
    const box = scroller.getBoundingClientRect();
    const target = button.getBoundingClientRect();
    scroller.scrollBy({ left: target.left + target.width / 2 - (box.left + box.width / 2), behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [active, reduceMotion]);

  if (level == null) return null;
  const currentCollection = collectionOf(level)?.id;
  const warm = (l: number) => {
    const { position, time } = useApp.getState();
    warmView(l, keepPosition(l, position), time);
  };

  return (
    <nav
      className="material pointer-events-auto absolute top-1/2 left-gutter flex -translate-y-1/2 flex-col items-center rounded-panel p-1 compact:top-auto compact:right-gutter compact:bottom-[calc(var(--safe-edge)+9.5rem)] compact:translate-y-0 compact:flex-row compact:rounded-full"
      aria-label="Floors"
    >
      <button className={stepClass} onClick={() => stepLevel(1)} aria-label="One floor up">
        <ChevronUp />
      </button>
      <ul ref={list} className="no-scrollbar compact:edge-fade-x compact:flex compact:min-w-0 compact:flex-1 compact:overflow-x-auto">
        {floorGroups.map(({ collection, levels }) => (
          <li key={collection.id} className="border-t border-hairline first:border-t-0 compact:flex compact:items-center compact:border-t-0 compact:border-l compact:first:border-l-0">
            <span aria-hidden="true" className={`block py-1 text-center text-[0.625rem] leading-3 font-semibold tracking-[0.08em] uppercase transition-colors duration-200 compact:px-2 compact:py-0 ${collection.id === currentCollection ? 'text-champagne' : 'text-paper-2'}`}>
              {collection.tag}
            </span>
            <ul aria-label={collection.name} className="compact:flex">
              {levels.map((l) => {
                const on = l === active;
                return (
                  <li key={l}>
                    <button
                      ref={on ? activeButton : undefined}
                      className={`press relative grid h-7.5 w-11 place-items-center rounded-control text-ui font-medium tabular-nums low:h-6.5 compact:size-9 compact:rounded-full ${on ? 'text-ink' : 'text-paper-2 hover:text-paper'}`}
                      aria-current={on ? 'true' : undefined}
                      aria-label={`Level ${l}, ${collection.name}`}
                      onPointerEnter={() => warm(l)}
                      onFocus={() => warm(l)}
                      onClick={() => setLevel(l)}
                    >
                      {on && <motion.span layoutId="rail-thumb" className="absolute inset-0 rounded-[inherit] bg-paper" transition={springUi} />}
                      <span className="relative">{l}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      <button className={stepClass} onClick={() => stepLevel(-1)} aria-label="One floor down">
        <ChevronDown />
      </button>
    </nav>
  );
}
