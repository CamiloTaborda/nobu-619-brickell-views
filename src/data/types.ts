export type TimeOfDay = 'day' | 'twilight';
export type PositionId = 'A' | 'B' | 'B-W' | 'C' | 'C-W' | 'D' | 'E' | 'F';

export interface PanoLevel {
  width: number;
  height: number;
  /** Patrón krpano relativo a indexdata/: %v = fila, %u = columna (base 0) */
  url: string;
}

export interface PanoView {
  h: number; // hlookat inicial (°)
  v: number; // vlookat inicial (°, positivo = abajo en krpano)
  fov: number;
  hmin: number;
  hmax: number;
  vmin: number;
  vmax: number;
  fovmax: number;
}

export interface PanoMeta {
  scene: string;
  folder: string;
  full360: boolean;
  hfov: number;
  vfov: number;
  voffset: number;
  tileSize: number;
  levels: PanoLevel[]; // ordenados de menor a mayor resolución
  preview: string;
  thumbnail: string;
  view: PanoView;
}

export interface Panorama {
  id: string;
  level: number;
  line: string;
  variant: 'main' | 'west';
  position: PositionId;
  time: TimeOfDay;
  url: string;
  packageBase: string;
  folder: string;
  shot: string | null;
  sheet: { row: number; label: string };
  /** Disponible tras `npm run data:probe` */
  pano?: PanoMeta | null;
  source?: { file: string; floorAlias: string | null; unitInFile: string | null } | null;
  sharedWith?: string[];
  northOffset?: number;
}

export interface Residence {
  id: string;
  line: string;
  sf: number;
  layout: string;
  note?: string;
}

export interface Collection {
  id: string;
  name: string;
  /** Nombre corto para controles y guías: "C5". */
  tag: string;
  levels: [number, number];
  plan: string | null;
  positions: PositionId[];
  residences: Residence[];
}

export interface Building {
  project: {
    name: string;
    shortName: string;
    city: string;
    client: string;
    topLevel: number;
    location: { lat: number; lng: number };
    disclaimer: string;
  };
  times: { id: TimeOfDay; label: string; labelEs: string }[];
  collections: Collection[];
  capturedLevels: { level: number; collection: string; alias?: string; label?: string }[];
  positions: Record<PositionId, { label: string; sharesPhotoWith?: PositionId }>;
}

/** Piso sobre el render de portada (generado por `npm run data:hero`). */
export interface HeroFloor {
  level: number;
  cy: number;
  points: [number, number][];
}

export interface Hero {
  width: number;
  height: number;
  src1920: string;
  src3840: string;
  tower: { cx: number; x0: number; x1: number; y0: number; y1: number };
  floors: HeroFloor[];
}

/** Zona de una residencia en la planta: etiqueta en posición relativa (0–1) y contorno SVG en unidades del plano. */
export interface PlanZone {
  variant: Panorama['variant'];
  x: number;
  y: number;
  outline: string;
}

export interface PlanResidence {
  zones: PlanZone[];
}

/** Planta de una colección (generada por `scripts/build-plan-assets.py`). */
export interface Plan {
  image: string;
  width: number;
  height: number;
  residences: Record<string, PlanResidence>;
}
