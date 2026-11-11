import { keepPosition, useApp } from '../../app/store';
import { areaRange, collectionOf, levelName, planFor, resolveView } from '../../data/catalog';
import { ArrowRight, ChevronDown, ChevronUp } from '../../ui/icons';
import PlanMark from '../../ui/PlanMark';
import ViewPreview from './ViewPreview';

interface Props {
  level: number;
  docked: boolean;
  onEnter: () => void;
  onStep: (dir: 1 | -1) => void;
}

export default function FloorCard({ level, docked, onEnter, onStep }: Props) {
  const position = useApp((s) => s.position);
  const time = useApp((s) => s.time);
  const { pano, captured } = resolveView(level, keepPosition(level, position), time);
  const collection = collectionOf(level);
  const forSale = collection?.residences.length ? collection : undefined;
  const plan = forSale && planFor(forSale.id);
  const title = forSale?.name ?? levelName(level);
  const detail = forSale ? `${forSale.residences.length} residences · ${areaRange(forSale)}` : collection ? `${collection.name} · Levels ${collection.levels[0]}–${collection.levels[1]}` : '';
  const approximate = captured !== level ? `View from Level ${captured}` : null;

  const step = (
    <div className="flex flex-col">
      <button className="press grid size-8 place-items-center rounded-full text-paper-2 hover:bg-white/10 hover:text-paper" onClick={() => onStep(1)} aria-label="Floor above">
        <ChevronUp />
      </button>
      <button className="press grid size-8 place-items-center rounded-full text-paper-2 hover:bg-white/10 hover:text-paper" onClick={() => onStep(-1)} aria-label="Floor below">
        <ChevronDown />
      </button>
    </div>
  );

  if (docked) {
    return (
      <div className="material flex items-center gap-3 rounded-panel p-2 pr-3">
        <ViewPreview pano={pano} aspect={4 / 3} className="w-24 flex-none rounded-[0.75rem]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-2xs font-medium tracking-caps text-paper-2 uppercase">{title}</p>
          <p className="text-[2rem] leading-none font-extralight tracking-display tabular-nums">
            <span className="align-[0.2em] text-sm font-light tracking-title">Level</span> {level}
          </p>
          <p className="mt-1 truncate text-2xs text-paper-2">{approximate ?? detail}</p>
        </div>
        <button className="press grid size-tap flex-none place-items-center rounded-full bg-paper text-ink" onClick={onEnter} aria-label={`Enter the view from ${levelName(level)}`}>
          <ArrowRight />
        </button>
      </div>
    );
  }

  return (
    <div className="material w-76 overflow-hidden rounded-panel">
      <div className="relative">
        <ViewPreview pano={pano} aspect={16 / 10} />
        {approximate && <span className="absolute top-3 left-3 rounded-full bg-shade/60 px-2.5 py-1 text-2xs font-medium tracking-small backdrop-blur-sm">{approximate}</span>}
      </div>
      <div className="p-4 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium tracking-caps text-paper-2 uppercase">{title}</p>
            <p className="mt-0.5 text-[3.25rem] leading-none font-extralight tracking-display tabular-nums">
              <span className="align-[0.25em] text-base font-light tracking-title">Level</span> {level}
            </p>
          </div>
          {step}
        </div>
        {detail && (
          <div className="mt-3 flex items-center gap-3">
            {plan && <PlanMark plan={plan} className="size-9 text-champagne/75" />}
            <p className="text-sm text-paper-2 tabular-nums">{detail}</p>
          </div>
        )}
        <button className="press mt-4 flex min-h-tap w-full items-center justify-center gap-2 rounded-full bg-paper text-sm font-medium text-ink" onClick={onEnter}>
          Enter the view
          <ArrowRight />
        </button>
      </div>
    </div>
  );
}
