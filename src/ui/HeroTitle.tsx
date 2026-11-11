/**
 * Columna de la portada. La pantalla de arranque pinta la misma columna con el
 * contenido secundario invisible: mide igual, así que el título no se mueve al
 * desvanecerse. Sin `rowProps` no hay nada interactivo.
 */
import type { ButtonHTMLAttributes } from 'react';
import { building, residenceCollections } from '../data/catalog';
import type { Collection } from '../data/types';
import { ArrowRight } from './icons';

interface Props {
  rowProps?: (collection: Collection) => ButtonHTMLAttributes<HTMLButtonElement>;
  /** El contenido secundario entra después del título, cuando la portada hace su entrada. */
  revealed?: boolean;
}

export default function HeroTitle({ rowProps, revealed = false }: Props) {
  return (
    <section className="absolute top-1/2 left-[clamp(1.25rem,5vw,5rem)] w-[min(26rem,calc(100vw-2.5rem))] -translate-y-1/2 compact:top-auto compact:bottom-[max(1.25rem,env(safe-area-inset-bottom))] compact:translate-y-0">
      <p className="text-xs font-medium tracking-caps text-paper-2 uppercase">Nobu Residences</p>
      <h1 className="mt-3 font-display text-[clamp(3.25rem,7vw,6.5rem)] leading-[0.98] font-light tracking-display lining-nums compact:mt-1.5 compact:text-[3.25rem]">{building.project.shortName}</h1>

      <div className={rowProps ? `transition-[opacity,translate] delay-300 duration-900 ease-out ${revealed ? '' : 'pointer-events-none translate-y-3 opacity-0 motion-reduce:translate-y-0'}` : 'invisible'}>
        <p className="mt-5 max-w-88 text-[1.0625rem] leading-[1.45] text-paper-2 compact:mt-2 compact:text-[0.9375rem]">Touch the tower at any height to see the view from there.</p>

        <ul className="mt-10 border-t border-hairline compact:mt-4 compact:grid compact:grid-cols-2 compact:gap-x-5">
          {residenceCollections.map((c) => (
            <li key={c.id} className="border-b border-hairline">
              <button className="press group grid min-h-13 w-full origin-left grid-cols-[1fr_auto_1rem] items-center gap-4 text-left compact:grid-cols-1 compact:content-center compact:gap-0" {...rowProps?.(c)}>
                <span className="font-medium tracking-title">{c.name}</span>
                <span className="text-ui tracking-small text-paper-2 tabular-nums">
                  Levels {c.levels[0]}–{c.levels[1]}
                </span>
                <ArrowRight className="size-4 text-paper-3 transition duration-200 ease-out group-hover:translate-x-0.75 group-hover:text-paper compact:hidden" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
