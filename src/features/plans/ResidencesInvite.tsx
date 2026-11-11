/** Contenido del panel en los niveles sin planta. */
import { useState } from 'react';
import { areaRange, building, capturedLevels, hero, HERO_IMAGE_SIZES, levelName, planFor, residenceCollections } from '../../data/catalog';
import { ArrowRight } from '../../ui/icons';
import PlanMark from '../../ui/PlanMark';

interface Props {
  level: number;
  onGoToLevel: (level: number) => void;
  onShowCollection: (id: string) => void;
  onIntent: (id: string) => void;
}

export default function ResidencesInvite({ level, onGoToLevel, onShowCollection, onIntent }: Props) {
  const highest = capturedLevels[0];
  const [renderShown, setRenderShown] = useState(false);

  return (
    <div className="edge-fade-y no-scrollbar mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 short:overflow-visible short:mask-none">
      <section className="relative isolate overflow-hidden rounded-panel bg-shade">
        {/* Mismo srcset y sizes que la portada: el navegador reutiliza la imagen que ya tiene. */}
        <img
          className={`absolute inset-0 -z-1 size-full object-cover object-[100%_30%] transition-opacity duration-500 ease-out ${renderShown ? 'opacity-100' : 'opacity-0'}`}
          src={hero.src1920}
          srcSet={`${hero.src1920} 1920w, ${hero.src3840} 3840w`}
          sizes={HERO_IMAGE_SIZES}
          alt=""
          ref={(image) => {
            if (image?.complete) setRenderShown(true);
          }}
          onLoad={() => setRenderShown(true)}
        />
        <div className="absolute inset-0 -z-1 bg-linear-to-t from-shade/90 via-shade/45 to-shade/10" />
        <div className="absolute inset-0 -z-1 bg-linear-to-r from-shade/60 via-shade/25 via-55% to-transparent" />
        <div className="flex min-h-64 flex-col justify-end p-5 short:min-h-44">
          <p className="text-xs font-medium tracking-caps text-paper-2 uppercase">{building.project.name}</p>
          <h3 className="mt-2 font-display text-[2rem] leading-[1.08] font-light tracking-display lining-nums">Find your residence</h3>
          <p className="mt-1.5 text-sm leading-[1.45] text-paper-2">{levelName(level)} has no floor plan. Choose a collection to see its plans and views.</p>
          <button className="press mt-4 min-h-tap self-start rounded-full bg-paper px-5 text-sm font-medium text-ink" onClick={() => onGoToLevel(highest)}>
            See the view from Level {highest}
          </button>
        </div>
      </section>

      <ul className="mt-2">
        {residenceCollections.map((c) => {
          const plan = planFor(c.id);
          return (
            <li key={c.id} className="border-b border-hairline last:border-b-0">
              <button className="press group flex min-h-20 w-full origin-left items-center gap-4 py-2.5 text-left" onPointerEnter={() => onIntent(c.id)} onFocus={() => onIntent(c.id)} onClick={() => onShowCollection(c.id)}>
                {plan && <PlanMark plan={plan} className="size-15 text-champagne/70 transition-colors duration-200 group-hover:text-champagne" />}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium tracking-title">{c.name}</span>
                  <span className="mt-0.5 block text-sm text-paper-2 tabular-nums">
                    Levels {c.levels[0]}–{c.levels[1]} · {areaRange(c)}
                  </span>
                </span>
                <ArrowRight className="size-4 flex-none text-paper-3 transition duration-200 ease-out group-hover:translate-x-0.75 group-hover:text-paper" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
