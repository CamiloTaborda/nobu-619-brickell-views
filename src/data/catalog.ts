/** Única puerta de acceso a los datos del proyecto. */
import buildingJson from '../../data/building.json';
import headingsJson from '../../data/headings.json';
import heroJson from '../../data/hero.json';
import manifestJson from '../../data/panoramas.json';
import plan2 from '../../data/plans/collection-2.json';
import plan3 from '../../data/plans/collection-3.json';
import plan4 from '../../data/plans/collection-4.json';
import plan5 from '../../data/plans/collection-5.json';
import type { Building, Collection, Hero, Panorama, Plan, PositionId, Residence, TimeOfDay } from './types';

type Manifest = { items: Panorama[] };

const manifest = manifestJson as unknown as Manifest;
const headings = headingsJson.northOffset as Record<string, number>;

export const building = buildingJson as unknown as Building;
export const hero = heroJson as unknown as Hero;
/** Encuadre vertical del render de portada; debe coincidir con su `object-position`. */
export const HERO_ALIGN_Y = 0.35;
export const HERO_IMAGE_SIZES = '(max-aspect-ratio: 4/3) 300vh, 200vw';
/** Cada vista con su orientación real (`northOffset` de data/headings.json). */
export const panoramas: Panorama[] = manifest.items.map((p) => (p.id in headings ? { ...p, northOffset: headings[p.id] } : p));

const plans = { C2: plan2, C3: plan3, C4: plan4, C5: plan5 } as unknown as Record<string, Plan>;
export const planFor = (collectionId: string): Plan | undefined => plans[collectionId];

const byId = new Map(panoramas.map((p) => [p.id, p]));

export const capturedLevels = [...new Set(panoramas.map((p) => p.level))].sort((a, b) => b - a);
export const POSITION_ORDER: PositionId[] = ['A', 'B', 'B-W', 'C', 'C-W', 'D', 'E', 'F'];
export const DEFAULT_POSITION: PositionId = 'B';

/** Colecciones con residencias a la venta, de arriba abajo. */
export const residenceCollections: Collection[] = building.collections.filter((c) => c.residences.length > 0);

/** Imágenes de planta, para tenerlas decodificadas antes de abrir el panel. */
export const planImages: string[] = residenceCollections.flatMap((c) => planFor(c.id)?.image ?? []);

/** Vistas de una residencia dentro de su colección (5CC reúne las líneas B y C). */
export const viewsOf = (r: Residence, c: Collection): PositionId[] =>
  r.line
    .split('')
    .flatMap((l) => [l, `${l}-W`] as PositionId[])
    .filter((p) => c.positions.includes(p));

/** Pisos navegables, de arriba abajo: los de cada colección y los capturados. */
export const selectableLevels: number[] = [
  ...new Set([
    ...residenceCollections.flatMap((c) => Array.from({ length: c.levels[1] - c.levels[0] + 1 }, (_, i) => c.levels[0] + i)),
    ...capturedLevels,
  ]),
].sort((a, b) => b - a);

/** Piso navegable vecino; se queda en el extremo si no hay más. */
export function stepFrom(level: number, dir: 1 | -1): number {
  const i = selectableLevels.indexOf(level);
  if (i < 0) return level;
  return selectableLevels[Math.min(selectableLevels.length - 1, Math.max(0, i - dir))];
}

const panoId = (level: number, position: PositionId, time: TimeOfDay) => `L${level}-${position}-${time}`;

/** Nivel capturado más cercano a cualquier piso (p. ej. 60 → 58) que tenga esa posición. */
export function nearestCapture(level: number, position?: PositionId): number {
  const candidates = position
    ? capturedLevels.filter((l) => byId.has(panoId(l, position, 'day')) || byId.has(panoId(l, position, 'twilight')))
    : capturedLevels;
  return candidates.reduce((a, b) => (Math.abs(b - level) < Math.abs(a - level) ? b : a), candidates[0]);
}

export function collectionOf(level: number): Collection | undefined {
  return building.collections.find((c) => level >= c.levels[0] && level <= c.levels[1]);
}

/** Pisos fotografiados agrupados por colección, de arriba abajo. */
export const floorGroups = building.collections
  .map((collection) => ({ collection, levels: capturedLevels.filter((l) => collectionOf(l)?.id === collection.id) }))
  .filter((group) => group.levels.length > 0);

/** Superficie mínima y máxima de las residencias de una colección: "2,876–5,534 SF". */
export function areaRange(c: Collection): string {
  const areas = c.residences.map((r) => r.sf);
  return `${Math.min(...areas).toLocaleString('en-US')}–${Math.max(...areas).toLocaleString('en-US')} SF`;
}

/** Dormitorios mínimos y máximos de una colección, leídos de sus distribuciones: "2–5 bedrooms". */
export function bedroomRange(c: Collection): string {
  const counts = c.residences.flatMap((r) => [...r.layout.matchAll(/(\d+)\s*Bed/g)].map((m) => Number(m[1])));
  const [min, max] = [Math.min(...counts), Math.max(...counts)];
  return min === max ? `${min} bedrooms` : `${min}–${max} bedrooms`;
}

/** Piso fotografiado que representa a un piso en el menú: el más cercano de su misma colección. */
export function railLevel(level: number): number {
  const group = floorGroups.find((g) => g.collection.id === collectionOf(level)?.id);
  if (!group) return nearestCapture(level);
  return group.levels.reduce((a, b) => (Math.abs(b - level) < Math.abs(a - level) ? b : a));
}

/** Vistas de un piso: las capturadas más cerca que además existen en su colección. */
export function positionsAt(level: number): PositionId[] {
  const lv = nearestCapture(level);
  const allowed = collectionOf(level)?.positions ?? POSITION_ORDER;
  return POSITION_ORDER.filter((p) => allowed.includes(p) && (byId.has(panoId(lv, p, 'day')) || byId.has(panoId(lv, p, 'twilight'))));
}

/** Resuelve qué panorámica mostrar para un piso cualquiera. */
export function resolveView(level: number, position: PositionId, time: TimeOfDay) {
  const captured = nearestCapture(level, position);
  const pano = byId.get(panoId(captured, position, time)) ?? byId.get(panoId(captured, position, time === 'day' ? 'twilight' : 'day'));
  return { pano, captured, isApproximate: captured !== level };
}

export function residenceFor(level: number, position: PositionId): Residence | undefined {
  const line = position[0];
  return collectionOf(level)?.residences.find((r) => r.line.includes(line));
}

/** Nombre comercial de una vista: "4CB West", o "Unit B · West" donde no hay residencias. */
export function viewLabel(level: number, position: PositionId): string {
  const residence = residenceFor(level, position);
  if (!residence) return building.positions[position].label;
  return position.endsWith('-W') ? `${residence.id} West` : residence.id;
}

/** Piso capturado más alto de una colección: el mejor punto de entrada. */
export const entryLevel = (c: Collection): number =>
  capturedLevels.find((l) => l >= c.levels[0] && l <= c.levels[1]) ?? c.levels[1];

export const levelName = (level: number): string =>
  building.capturedLevels.find((l) => l.level === level)?.label ?? `Level ${level}`;
