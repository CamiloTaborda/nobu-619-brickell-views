#!/usr/bin/env node
/**
 * build-hero-floors.mjs
 * ------------------------------------------------------------------
 * Convierte las medidas de data/source/hero-floors.json en el polígono de cada
 * piso sobre el render de portada y escribe data/hero.json.
 *
 * Los bordes de cada piso son arcos, no rectas: la torre es curva y, por la
 * perspectiva, los pisos se arquean en sentido contrario a cada lado del horizonte.
 *
 * Uso:  npm run data:hero
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = JSON.parse(readFileSync(resolve(root, 'data/source/hero-floors.json'), 'utf8'));
const { cx, halfWidth } = src.tower;
const SEGMENTS = 12;

/** Puntos del arco de un borde cuya Y en el eje es `y`, de izquierda a derecha. */
function arc(y) {
  const sag = src.curvature * (src.horizonY - y);
  return Array.from({ length: SEGMENTS + 1 }, (_, i) => {
    const t = (i / SEGMENTS) * 2 - 1;
    return [Math.round(cx + t * halfWidth), Math.round(y + sag * (1 - Math.sqrt(1 - t * t)))];
  });
}

const floors = [];
for (const band of src.bands) {
  const count = band.from - band.to + 1;
  const height = (band.bottom - band.top) / count;
  for (let i = 0; i < count; i++) {
    const top = band.top + i * height;
    floors.push({
      level: band.from - i,
      cy: Math.round(top + height / 2),
      points: [...arc(top), ...arc(top + height).reverse()],
    });
  }
}

writeFileSync(
  resolve(root, 'data/hero.json'),
  JSON.stringify(
    {
      ...src.image,
      tower: { cx, x0: cx - halfWidth, x1: cx + halfWidth, y0: src.bands[0].top, y1: src.bands.at(-1).bottom },
      floors,
    },
    null,
    1,
  ) + '\n',
);
console.log(`✔ ${floors.length} pisos → data/hero.json`);
