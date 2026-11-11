/** Ficha de colección: datos comunes a todos sus pisos y la vista de su piso más alto fotografiado. */
import { keepPosition, useApp } from '../../app/store';
import { areaRange, bedroomRange, entryLevel, planFor, resolveView } from '../../data/catalog';
import type { Collection } from '../../data/types';
import { ArrowRight } from '../../ui/icons';
import PlanMark from '../../ui/PlanMark';
import ViewPreview from './ViewPreview';

interface Props {
  collection: Collection;
  docked: boolean;
  onEnter: () => void;
}

export default function CollectionCard({ collection, docked, onEnter }: Props) {
  const position = useApp((s) => s.position);
  const time = useApp((s) => s.time);
  const entry = entryLevel(collection);
  const { pano } = resolveView(entry, keepPosition(entry, position), time);
  const plan = planFor(collection.id);
  const levels = `Levels ${collection.levels[0]}–${collection.levels[1]}`;
  const specs = [`${collection.residences.length} residences per floor`, bedroomRange(collection), areaRange(collection)];

  if (docked) {
    return (
      <div className="material flex items-center gap-3 rounded-panel p-2 pr-3">
        <ViewPreview pano={pano} aspect={4 / 3} className="w-24 flex-none rounded-[0.75rem]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-2xs font-medium tracking-caps text-paper-2 uppercase">{collection.name}</p>
          <p className="text-xl leading-tight font-light tracking-title tabular-nums">{levels}</p>
          <p className="mt-0.5 truncate text-2xs text-paper-2">{specs.join(' · ')}</p>
        </div>
        <button className="press grid size-tap flex-none place-items-center rounded-full bg-paper text-ink" onClick={onEnter} aria-label={`Explore ${collection.name}`}>
          <ArrowRight />
        </button>
      </div>
    );
  }

  return (
    <div className="material w-76 overflow-hidden rounded-panel">
      <div className="relative">
        <ViewPreview pano={pano} aspect={16 / 10} />
        <span className="absolute top-3 left-3 rounded-full bg-shade/60 px-2.5 py-1 text-2xs font-medium tracking-small backdrop-blur-sm">View from Level {entry}</span>
      </div>
      <div className="p-4 pt-3">
        <p className="text-xs font-medium tracking-caps text-paper-2 uppercase">{collection.name}</p>
        <p className="mt-1 font-display text-[2.25rem] leading-none font-light tracking-display lining-nums">{levels}</p>
        <div className="mt-3 flex items-center gap-3.5">
          {plan && <PlanMark plan={plan} className="size-14 text-champagne/75" />}
          <ul className="text-sm leading-[1.5] text-paper-2 tabular-nums">
            {specs.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <button className="press mt-4 flex min-h-tap w-full items-center justify-center gap-2 rounded-full bg-paper text-sm font-medium text-ink" onClick={onEnter}>
          Explore {collection.name}
          <ArrowRight />
        </button>
      </div>
    </div>
  );
}
